// Página: Financeiro → New Extrato Bancário
// Reconstrução do Extrato Bancário do zero (pedido do Yago, 05/11/2026).
// Backend próprio: /api/novo-extrato (routes/novoExtrato.routes.js) com
// tabelas neb_importacoes / neb_lancamentos. Por enquanto lê só o PDF do
// Banco do Brasil; a importação só é aceita quando o saldo recalculado bate
// com o saldo impresso (dia a dia e final).
// Mesmos filtros e visual da página antiga (componentes reaproveitados).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import { Wallet, X, ArrowsClockwise, MagnifyingGlass, FunnelSimple, Export, UploadSimple, Info, ArrowDown, ArrowUp, ArrowsLeftRight, ArrowRight, Receipt, Bank, Warning, CheckCircle, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { MultiSelect, SeletorCnpj, BANCOS, bancoCfg, docDaConta, fmt, fmtData, fmtDoc, Th, Kpi, Badge, TIPOS, hoje, primeiroDiaMes } from './FluxoCaixaExt';

const API = `${API_BASE_URL}/api/novo-extrato`;
const SUBTITULO = 'Nova versão do Extrato Bancário, montada do zero. Entradas, saídas e resultado somam só as linhas de lançamento; o saldo fica na última coluna. Lê o PDF do Banco do Brasil, do Itaú (extrato mensal), do Sicredi, do Santander (consolidado) e da Unicred, e o OFX da Caixa e do Santander. Nada da Shopping Recife entra.';
const LINHAS_POR_PAGINA = 100;
const headersUsuario = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || localStorage.getItem('usuario') || 'null');
    const nome = u?.name || u?.nome || u?.email || null;
    return nome ? { 'x-user-name': nome } : {};
  } catch {
    return {};
  }
};

const NewExtratoBancario = () => {
  const [de, setDe] = useState(primeiroDiaMes());
  const [ate, setAte] = useState(hoje());
  const [bancos, setBancos] = useState([]);
  const [contasSel, setContasSel] = useState([]);
  const [cnpjsSel, setCnpjsSel] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [formas, setFormas] = useState([]);
  const [contraparte, setContraparte] = useState('');
  const [busca, setBusca] = useState('');
  const [contasLista, setContasLista] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [importando, setImportando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [aba, setAba] = useState('lancamentos'); // lancamentos | transferencias
  const [recasando, setRecasando] = useState(false);
  const inputRef = useRef(null);

  // contas = importações já gravadas (agrupadas por banco + conta)
  const carregarContas = useCallback(async () => {
    try {
      const r = await fetch(`${API}/contas`);
      const j = await r.json();
      if (j?.success) {
        setContasLista(
          (j.data || []).map((c) => ({
            id: c.chave,
            conta: c.conta,
            apelido: `${bancoCfg(c.banco).label} ${c.conta}${c.contaDv ? `-${c.contaDv}` : ''}`,
            banco: c.banco,
            titular_nome: c.titular,
            titular_cnpj: null,
            qtdImportacoes: c.importacoes.length,
            periodoInicio: c.periodoInicio,
            periodoFim: c.periodoFim,
            importacoes: c.importacoes,
          })),
        );
      }
    } catch {
      /* sem opções por enquanto */
    }
  }, []);
  useEffect(() => {
    carregarContas();
  }, [carregarContas]);

  const bancosPresentes = useMemo(() => [...new Set(contasLista.map((c) => c.banco))], [contasLista]);
  const limparFiltros = () => {
    setBancos([]);
    setContasSel([]);
    setCnpjsSel([]);
    setTipos([]);
    setFormas([]);
    setContraparte('');
    setBusca('');
  };
  const filtrosAtivos = bancos.length + contasSel.length + cnpjsSel.length + tipos.length + formas.length + (contraparte ? 1 : 0) + (busca ? 1 : 0);

  const buscar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const q = new URLSearchParams({ de, ate });
      if (bancos.length) q.set('bancos', bancos.join(','));
      if (contasSel.length) q.set('contas', contasSel.map((k) => contasLista.find((c) => c.id === k)?.conta || k).join(','));
      if (tipos.length) q.set('tipos', tipos.join(','));
      if (busca.trim()) q.set('busca', busca.trim());
      const r = await fetch(`${API}/lancamentos?${q}`);
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao buscar.');
      setDados(j.data);
      setPagina(1);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  const importar = async (files) => {
    if (!files?.length) return;
    setImportando(true);
    setErro(null);
    setAviso(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('arquivos', f);
      const r = await fetch(`${API}/importar`, { method: 'POST', body: fd, headers: headersUsuario() });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao importar.');
      const linhas = j.data.resultados.map((x) =>
        x.ok
          ? `${x.arquivo}: ${x.conta} ${x.titular || ''} · ${x.mesReferencia || ''} · ${x.qtd} lançamentos · saldo inicial ${fmt(x.saldoInicial)} → final ${fmt(x.saldoFinal)} ✔ bateu${x.encadeamento ? (x.encadeamento.bate ? ' · encadeia com o mês anterior' : ` · NÃO encadeia (anterior ${fmt(x.encadeamento.saldoFinalAnterior)})`) : ''}${x.descartados ? ` · ${x.descartados} linha(s) já importada(s) no mês anterior descartada(s)` : ''}${x.substituidas ? ' (substituiu importação anterior)' : ''}`
          : `${x.arquivo}: ${x.erro}`,
      );
      setAviso({ ok: j.data.falhas === 0, texto: linhas.join('\n') });
      await carregarContas();
      if (j.data.ok) {
        const okImp = j.data.resultados.find((x) => x.ok);
        if (okImp?.periodo?.inicio && okImp?.periodo?.fim) {
          setDe(okImp.periodo.inicio);
          setAte(okImp.periodo.fim);
        }
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setImportando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // depois da importação, com o período já ajustado, carrega a tabela
  useEffect(() => {
    if (aviso?.ok && !dados) buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aviso]);

  const lancamentos = dados?.lancamentos || [];
  const resumo = dados?.resumo;
  const transferencias = dados?.transferencias || [];
  const semPar = dados?.semPar || [];
  const nomeConta = (banco, conta, dv) => `${bancoCfg(banco).label} ${conta}${dv ? `-${dv}` : ''}`;
  const recasar = async () => {
    setRecasando(true);
    setErro(null);
    try {
      const r = await fetch(`${API}/transferencias/recasar`, { method: 'POST', headers: headersUsuario() });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha ao recasar.');
      setAviso({ ok: true, texto: `${j.data.pares} par(es) entre contas importadas (${fmt(j.data.valor)}) · ${j.data.atualizados} linha(s) atualizada(s)` });
      await buscar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setRecasando(false);
    }
  };
  const totalPaginas = Math.max(1, Math.ceil(lancamentos.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * LINHAS_POR_PAGINA;
  const lancamentosPagina = lancamentos.slice(inicio, inicio + LINHAS_POR_PAGINA);
  // último "saldo após" de CADA conta no período; o card soma as contas do filtro
  const saldosPorConta = useMemo(() => {
    const porConta = new Map();
    for (const l of lancamentos) porConta.set(`${l.banco}|${l.conta}`, { banco: l.banco, conta: l.conta, dv: l.conta_dv, titular: l.titular, data: l.data, saldo: Number(l.saldo_apos) || 0 });
    return [...porConta.values()];
  }, [lancamentos]);
  const saldoFinal = useMemo(() => saldosPorConta.reduce((s, c) => s + c.saldo, 0), [saldosPorConta]);

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6">
      <PageTitle title="New Extrato Bancário" subtitle={SUBTITULO} icon={Wallet} />

      {/* Filtros — tudo num card só */}
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
          <button onClick={buscar} disabled={carregando || !de || !ate} className="px-4 py-1.5 text-xs rounded-lg bg-[#000638] text-white hover:bg-[#000638]/90 disabled:opacity-50 flex items-center gap-1 font-semibold">
            {carregando ? <ArrowsClockwise size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} {carregando ? 'Buscando…' : 'Buscar'}
          </button>
          <button disabled className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white disabled:opacity-50 flex items-center gap-1" title="Em breve">
            <Export size={14} /> Excel
          </button>
          <label className={`px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 font-medium cursor-pointer ${importando ? 'opacity-60 pointer-events-none' : ''}`} title="PDF do extrato do Banco do Brasil, Itaú, Sicredi, Santander (consolidado) ou Unicred, ou OFX da Caixa e do Santander (um ou vários; importe em ordem de mês)">
            {importando ? <ArrowsClockwise size={14} className="animate-spin" /> : <UploadSimple size={14} weight="bold" />} {importando ? 'Importando…' : 'Importar extratos'}
            <input ref={inputRef} type="file" accept=".pdf,.ofx,application/pdf" multiple className="hidden" onChange={(e) => importar(Array.from(e.target.files || []))} />
          </label>
        </div>

        {/* busca */}
        <div className="relative mb-3">
          <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Pesquisar histórico, documento ou valor…"
            className="w-full pl-8 pr-8 py-2 text-sm border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#000638]"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* campos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-2.5">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]" />
          </div>
          <MultiSelect
            label="Banco"
            opcoes={(bancosPresentes.length ? bancosPresentes : Object.keys(BANCOS)).map((b) => ({ value: b, label: bancoCfg(b).label, banco: b }))}
            valor={bancos}
            onChange={setBancos}
            renderOpcao={(o) => (
              <span className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${bancoCfg(o.banco).ponto}`} />
                <span className="truncate">{o.label}</span>
              </span>
            )}
            larguraMin="w-full"
          />
          <SeletorCnpj contas={contasLista.filter((c) => !bancos.length || bancos.includes(c.banco))} valor={cnpjsSel} onChange={setCnpjsSel} />
          <MultiSelect
            label="Conta"
            busca
            opcoes={contasLista
              .filter((c) => !bancos.length || bancos.includes(c.banco))
              .filter((c) => !cnpjsSel.length || cnpjsSel.includes(docDaConta(c)))
              .map((c) => ({ value: c.id, label: c.apelido, banco: c.banco, sub: c.titular_nome }))}
            valor={contasSel}
            onChange={setContasSel}
            renderOpcao={(o) => (
              <span className="flex items-center gap-2 min-w-0">
                <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${bancoCfg(o.banco).ponto}`} />
                <span className="font-medium text-gray-800 shrink-0">{o.label}</span>
                {o.sub && <span className="text-gray-400 truncate">· {o.sub}</span>}
              </span>
            )}
            placeholder={contasLista.length ? 'Todas as contas' : 'Nenhuma conta importada'}
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
          <MultiSelect label="Forma de pagamento" busca opcoes={[]} valor={formas} onChange={setFormas} placeholder="Todas as formas" larguraMin="w-full" />
          <div className="col-span-2 lg:col-span-5">
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Fornecedor / contraparte</label>
            <input
              list="neb-contrapartes"
              value={contraparte}
              onChange={(e) => setContraparte(e.target.value)}
              placeholder="Digite para escolher…"
              className="w-full px-2 py-1.5 text-xs border border-[#000638]/30 rounded-lg bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#000638]"
            />
            <datalist id="neb-contrapartes" />
          </div>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <span className="flex-1 whitespace-pre-line">{erro}</span>
          <button onClick={() => setErro(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}
      {aviso && (
        <div className={`flex items-start gap-2 px-4 py-3 mb-4 rounded-lg text-sm border ${aviso.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
          {aviso.ok ? <CheckCircle size={18} className="shrink-0 mt-0.5" /> : <Warning size={18} className="shrink-0 mt-0.5" />}
          <span className="flex-1 whitespace-pre-line">{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPIs — só linhas de lançamento; saldo na coluna da tabela */}
      {resumo && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5 md:gap-3 mb-4">
          <Kpi label="Recebido (entradas)" value={fmt(resumo.entradas)} sub={`${resumo.qtdEntradas} lançamentos · sem transferências`} tone="text-green-600" Icon={ArrowDown} accent="bg-green-50 text-green-600" />
          <Kpi label="Pago (saídas)" value={fmt(resumo.saidas)} sub={`${resumo.qtdSaidas} lançamentos · sem transferências`} tone="text-red-600" Icon={ArrowUp} accent="bg-red-50 text-red-600" />
          <Kpi label="Resultado" value={fmt(resumo.resultado)} sub="entradas − saídas (sem transferências)" tone={resumo.resultado >= 0 ? 'text-blue-700' : 'text-red-700'} Icon={Receipt} accent="bg-blue-50 text-blue-600" />
          <Kpi
            label="Transferido entre contas"
            value={fmt(resumo.transfEnviadas)}
            sub={`${transferencias.length} par(es), contado uma vez${resumo.transfParteLote ? ` · ${fmt(resumo.transfParteLote)} em partes de lote SISPAG` : ''}${resumo.transfSemParEnviadas || resumo.transfSemParRecebidas ? ` · sem par: ${fmt(resumo.transfSemParEnviadas)} enviado / ${fmt(resumo.transfSemParRecebidas)} recebido` : ''}`}
            tone="text-amber-700"
            Icon={ArrowsLeftRight}
            accent="bg-amber-50 text-amber-600"
          />
          <Kpi
            label={saldosPorConta.length > 1 ? `Saldo final (soma de ${saldosPorConta.length} contas)` : 'Saldo final da conta'}
            value={fmt(saldoFinal)}
            sub={saldosPorConta.length > 1 ? saldosPorConta.map((c) => `${bancoCfg(c.banco).label} ${c.conta}: ${fmt(c.saldo)}`).join(' · ') : saldosPorConta[0] ? `último lançamento em ${fmtData(saldosPorConta[0].data)}` : ''}
            Icon={Bank}
            accent="bg-slate-100 text-slate-600"
          />
        </div>
      )}

      {/* saldo final por conta (o card acima é a soma; aqui cada conta separada) */}
      {resumo && saldosPorConta.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">Saldo final por conta no período</div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>Conta</Th>
                <Th>Titular</Th>
                <Th>Último lançamento</Th>
                <Th right>Saldo após</Th>
              </tr>
            </thead>
            <tbody>
              {saldosPorConta.map((c) => (
                <tr key={`${c.banco}|${c.conta}`} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <Badge cfg={bancoCfg(c.banco)}>
                      {bancoCfg(c.banco).label} {c.conta}
                      {c.dv ? `-${c.dv}` : ''}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5">{c.titular || '—'}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(c.data)}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${c.saldo < 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmt(c.saldo)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                <td className="px-3 py-1.5" colSpan={3}>Soma das contas</td>
                <td className="px-3 py-1.5 text-right">{fmt(saldoFinal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-gray-200 bg-gray-50">
          {[
            { id: 'lancamentos', label: `Lançamentos (${lancamentos.length})` },
            { id: 'transferencias', label: `Transferências (${transferencias.length}${semPar.length ? ` + ${semPar.length} sem par` : ''})` },
          ].map((a) => (
            <button key={a.id} onClick={() => setAba(a.id)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${aba === a.id ? 'bg-white shadow-sm text-blue-700 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
              {a.label}
            </button>
          ))}
          {carregando && <ArrowsClockwise size={14} className="animate-spin text-blue-600 ml-2" />}
          {aba === 'transferencias' && (
            <button onClick={recasar} disabled={recasando} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50" title="Refaz o casamento entre todas as contas importadas">
              {recasando ? <ArrowsClockwise size={12} className="animate-spin" /> : <ArrowsLeftRight size={12} />} Recasar transferências
            </button>
          )}
          {aba === 'lancamentos' && totalPaginas > 1 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
              <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaAtual <= 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-40">
                <CaretLeft size={14} />
              </button>
              página {paginaAtual} de {totalPaginas}
              <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaAtual >= totalPaginas} className="p-1 rounded hover:bg-gray-200 disabled:opacity-40">
                <CaretRight size={14} />
              </button>
            </span>
          )}
        </div>
        {aba === 'transferencias' && (
          <div className="p-3 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Entre contas importadas — saiu de uma conta e entrou em outra ({transferencias.length})</p>
              {transferencias.length ? (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <Th>Data</Th>
                        <Th right>Valor</Th>
                        <Th>Saiu da conta</Th>
                        <Th />
                        <Th>Entrou na conta</Th>
                        <Th>Como aparece nos extratos</Th>
                        <Th>Evidência</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferencias.map((t) => (
                        <tr key={t.id} className="border-t border-gray-100 hover:bg-amber-50/40">
                          <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(t.data)}{t.data_entrada && t.data_entrada !== t.data ? <span className="block text-[10px] text-gray-400">entrou {fmtData(t.data_entrada)}</span> : null}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-amber-700 whitespace-nowrap">{fmt(t.valor)}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{t.origem ? <Badge cfg={bancoCfg(t.origem.banco)} title={t.origem.titular || ''}>{nomeConta(t.origem.banco, t.origem.conta, t.origem.conta_dv)}</Badge> : '—'}</td>
                          <td className="px-1 py-1.5 text-gray-400"><ArrowRight size={14} /></td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{t.destino ? <Badge cfg={bancoCfg(t.destino.banco)} title={t.destino.titular || ''}>{nomeConta(t.destino.banco, t.destino.conta, t.destino.conta_dv)}</Badge> : '—'}</td>
                          <td className="px-3 py-1.5 text-gray-600">
                            <span className="block">− {t.origem?.historico || '—'}</span>
                            <span className="block">+ {t.destino?.historico || '—'}</span>
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">{t.evidencia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 px-1 py-2">Nenhuma transferência entre as contas importadas no período.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Para empresas do grupo em conta ainda não importada — só uma ponta ({semPar.length})</p>
              <p className="text-[11px] text-gray-400 mb-1.5">Ficam fora de Recebido/Pago. Quando o extrato da outra conta for importado, viram pares automaticamente. Entrada vinda do próprio CNPJ fica como entrada, porque pode ser Pix de cliente pelo QR Code do TOTVS.</p>
              {semPar.length ? (
                <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600 sticky top-0">
                      <tr>
                        <Th>Data</Th>
                        <Th>Conta</Th>
                        <Th>Sentido</Th>
                        <Th>Histórico</Th>
                        <Th>Contraparte (empresa do grupo)</Th>
                        <Th right>Valor</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {semPar.map((l) => (
                        <tr key={l.id} className="border-t border-gray-100 hover:bg-amber-50/40">
                          <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(l.data)}{l.hora ? <span className="text-gray-400"> {l.hora}</span> : null}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap"><Badge cfg={bancoCfg(l.banco)} title={l.titular || ''}>{nomeConta(l.banco, l.conta, l.conta_dv)}</Badge></td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{l.valor < 0 ? <span className="text-red-600">enviou</span> : <span className="text-green-700">recebeu</span>}</td>
                          <td className="px-3 py-1.5 text-gray-700">{l.historico_base || l.historico}</td>
                          <td className="px-3 py-1.5">{l.contraparte_nome || '—'}{l.contraparte_doc ? <span className="block text-[10px] text-gray-400">{fmtDoc(l.contraparte_doc)}</span> : null}</td>
                          <td className={`px-3 py-1.5 text-right font-semibold whitespace-nowrap ${l.valor < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(Math.abs(l.valor))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 px-1 py-2">Nenhuma.</p>
              )}
            </div>
          </div>
        )}
        {aba === 'lancamentos' && (
        <div className="overflow-x-auto">
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
              {!dados && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Info size={14} /> Importe um extrato ou clique em Buscar.
                    </span>
                  </td>
                </tr>
              )}
              {dados && !lancamentos.length && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-xs text-gray-400">
                    Nenhum lançamento no período com esses filtros.
                  </td>
                </tr>
              )}
              {lancamentosPagina.map((l) => {
                const cfg = TIPOS[l.tipo] || TIPOS.ENTRADA;
                return (
                  <tr key={l.id} className={`border-b border-gray-100 hover:bg-gray-50 text-xs ${l.tipo === 'TRANSFERENCIA' ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtData(l.data)} <span className="text-gray-400">{l.seq}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge cfg={bancoCfg(l.banco)} title={l.titular || ''}>
                        {bancoCfg(l.banco).label} {l.conta}
                        {l.conta_dv ? `-${l.conta_dv}` : ''}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge cfg={cfg}>
                        <cfg.Icon size={11} weight="bold" /> {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">{l.historico_codigo || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{l.historico_base || l.historico}{l.hora ? <span className="text-gray-400 font-normal"> {l.hora}</span> : null}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {l.contraparte_nome || (l.contraparte_doc ? '' : '—')}
                      {l.contraparte_doc ? <span className="block text-[10px] text-gray-400">{fmtDoc(l.contraparte_doc)}</span> : null}
                      {l.tipo === 'TRANSFERENCIA' && !l.transferencia_id ? <span className="block text-[10px] text-amber-700">entre contas · outra ponta não importada</span> : null}
                      {l.valor_transferido > 0 ? <span className="block text-[10px] text-amber-700">lote SISPAG: {fmt(l.valor_transferido)} foi para conta do grupo (entre contas); o resto é pagamento</span> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500 font-mono">{l.documento || '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-green-700 font-semibold">{l.valor > 0 ? fmt(l.valor) : ''}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-red-600 font-semibold">{l.valor < 0 ? fmt(-l.valor) : ''}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${l.saldo_apos < 0 ? 'text-red-600' : 'text-gray-600'}`}>{l.saldo_apos != null ? fmt(l.saldo_apos) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            {resumo && lancamentos.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200 text-xs font-semibold text-gray-700">
                  <td className="px-3 py-2" colSpan={7}>
                    Total do filtro ({lancamentos.length})
                  </td>
                  <td className="px-3 py-2 text-right text-green-700">{fmt(resumo.entradas)}</td>
                  <td className="px-3 py-2 text-right text-red-600">{fmt(resumo.saidas)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt(saldoFinal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        )}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          {lancamentos.length} lançamentos{resumo ? ` · entradas ${fmt(resumo.entradas)} · saídas ${fmt(resumo.saidas)}` : ''}
        </div>
      </div>
    </div>
  );
};

export default NewExtratoBancario;
