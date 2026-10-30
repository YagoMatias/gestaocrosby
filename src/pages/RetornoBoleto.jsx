// Retorno Boleto — boletos emitidos na Pagar.me (Envio de Remessa) e a
// situação de cada um: em aberto, vencido, pago, cancelado. Os pagos são
// baixados no TOTVS automaticamente pelo backend (job a cada 30 min);
// "Atualizar retorno" força a consulta à Pagar.me e a baixa na hora.
// "Baixa em massa na Pagar.me" cancela boletos pendentes lá (cliente pagou por
// outro meio, renegociou...): cola uma lista de clientes ou faturas, confere o
// que seria cancelado e confirma. O título no TOTVS não muda.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Barcode,
  MagnifyingGlass,
  Spinner,
  Warning,
  CheckCircle,
  ArrowsClockwise,
  Copy,
  ArrowSquareOut,
  Prohibit,
  CaretDown,
  CaretUp,
  ArrowUp,
  ArrowDown,
  FileXls,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { TotvsURL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import FiltroEmpresa from '../components/FiltroEmpresa';
import { useAuth } from '../components/AuthContext';

const iso = (dias) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

function fmtBRL(v) {
  const n = Number(v);
  if (v == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(s) {
  if (!s) return '—';
  if (String(s).length > 10) return new Date(s).toLocaleDateString('pt-BR');
  const [a, m, d] = String(s).split('-');
  return d ? `${d}/${m}/${a}` : s;
}

const SITUACOES = {
  aberto: { label: 'Em aberto', cls: 'bg-blue-100 text-blue-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-800' },
  pago: { label: 'Pago', cls: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-200 text-gray-700' },
  falhou: { label: 'Não emitido', cls: 'bg-amber-100 text-amber-800' },
};

// Conta Pagar.me em que o boleto foi emitido — cor diferente por conta
const CONTAS = {
  crosby: { label: 'Crosby', nome: 'Crosby (FERREIRA)', cls: 'bg-sky-100 text-sky-800 border-sky-300', row: 'border-l-4 border-l-sky-400' },
  fabio: { label: 'FA MODA', nome: 'FA MODA (Fábio)', cls: 'bg-violet-100 text-violet-800 border-violet-300', row: 'border-l-4 border-l-violet-500' },
};
const contaDe = (id) => CONTAS[id] || { label: id || '—', nome: id || '—', cls: 'bg-gray-100 text-gray-700 border-gray-300', row: '' };
// Boleto cancelado (baixado no banco / na Pagar.me) não está em conta nenhuma — regra do João, 21/10/2026
const SEM_CONTA = { label: '—', nome: 'Cancelado (sem conta)', cls: 'bg-gray-100 text-gray-500 border-gray-200', row: '' };
const contaDoBoleto = (b) =>
  b.situacao === 'cancelado' || b.situacao === 'falhou' || b.status === 'canceled' || b.status === 'failed' ? SEM_CONTA : contaDe(b.conta);
// quem pode ser marcado: pendente (p/ baixar na Pagar.me) ou cancelado/não emitido (p/ reemitir)
const PODE_BAIXAR = (b) => b.situacao === 'aberto' || b.situacao === 'vencido';
// Título já renegociado/baixado/cancelado no TOTVS (conferido pela sincronização): não reemitir
const TITULO_FECHADO_TOTVS = (b) => !!b.totvs_situacao && b.totvs_situacao !== 'aberto' && b.totvs_situacao !== 'nao_encontrado';
const CANCELADO_OU_FALHOU = (b) => b.situacao === 'cancelado' || b.situacao === 'falhou';
// Yago/João (27/10/2026): só reemite se o título continua aberto no TOTVS
const PODE_REEMITIR = (b) => CANCELADO_OU_FALHOU(b) && !TITULO_FECHADO_TOTVS(b);
const LOTE_REMESSA = 25;

// Situação do título no TOTVS (conferida a cada "Atualizar retorno" / job)
const TOTVS_SIT = {
  aberto: { label: 'Aberto no TOTVS', cls: 'text-gray-400' },
  pago: { label: 'PAGO no TOTVS', cls: 'bg-red-100 text-red-800 border border-red-300' },
  renegociado: { label: 'RENEGOCIADO no TOTVS', cls: 'bg-red-100 text-red-800 border border-red-300' },
  cancelado: { label: 'CANCELADO no TOTVS', cls: 'bg-red-100 text-red-800 border border-red-300' },
  devolvido: { label: 'DEVOLVIDO no TOTVS', cls: 'bg-red-100 text-red-800 border border-red-300' },
  quebrado: { label: 'QUEBRADO no TOTVS', cls: 'bg-red-100 text-red-800 border border-red-300' },
  nao_encontrado: { label: 'não achei no TOTVS', cls: 'bg-amber-100 text-amber-800' },
};
const FECHADO_TOTVS = (b) => b.situacao !== 'pago' && b.situacao !== 'cancelado' && b.situacao !== 'falhou' && b.totvs_situacao && b.totvs_situacao !== 'aberto' && b.totvs_situacao !== 'nao_encontrado';

const BAIXAS = {
  processada: { label: 'Baixada no TOTVS', cls: 'text-green-700' },
  processando: { label: 'Baixando...', cls: 'text-blue-700' },
  erro: { label: 'Erro na baixa', cls: 'text-red-600' },
  pendente: { label: 'Aguardando baixa', cls: 'text-amber-600' },
  // 23/10/2026: boleto pago vira Solicitação de Baixa (cartão PAGARME, data do crédito)
  solicitada: { label: 'Recebido · a baixar (Solicitações de Baixa)', cls: 'text-amber-700' },
  aguardando_credito: { label: 'Pago · aguardando crédito Pagar.me', cls: 'text-gray-600' },
};
const A_BAIXAR = new Set(['solicitada', 'pendente']);

export default function RetornoBoleto() {
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [modo, setModo] = useState('vencimento');
  const [dataInicio, setDataInicio] = useState(iso(-30));
  const [dataFim, setDataFim] = useState(iso(60));
  const [situacao, setSituacao] = useState('todos');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [tabelaAusente, setTabelaAusente] = useState(false);
  const [boletos, setBoletos] = useState([]);
  const [filtroConta, setFiltroConta] = useState('todas'); // todas | crosby | fabio
  const [ordem, setOrdem] = useState({ campo: 'vencimento', dir: 'asc' });
  // Cancelado/não emitido que já foi substituído por um boleto novo da mesma
  // fatura (ex.: cancelou na Crosby e reemitiu na FA MODA) fica escondido por
  // padrão — senão a fatura aparece "duplicada" (João, 21/10/2026).
  const [verSubstituidos, setVerSubstituidos] = useState(false);
  const [soFechadosTotvs, setSoFechadosTotvs] = useState(false);
  const ordenarPor = (campo) =>
    setOrdem((o) => ({ campo, dir: o.campo === campo && o.dir === 'asc' ? 'desc' : 'asc' }));
  const [contasPagarme, setContasPagarme] = useState(null); // { emissao, contas:[{id,nome,configurada}] }
  const [copiado, setCopiado] = useState(null);

  // ── baixa em massa na Pagar.me ──
  const { user } = useAuth();
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [baixaTipo, setBaixaTipo] = useState('clientes'); // 'clientes' | 'faturas'
  const [baixaLista, setBaixaLista] = useState('');
  const [baixaMotivo, setBaixaMotivo] = useState('');
  const [baixaConferencia, setBaixaConferencia] = useState(null); // resposta de confirmar=false
  const [baixaResultado, setBaixaResultado] = useState(null); // resposta de confirmar=true
  const [baixaErro, setBaixaErro] = useState('');
  const [baixaCarregando, setBaixaCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [reemitindo, setReemitindo] = useState(false);
  const [reemitProgresso, setReemitProgresso] = useState('');
  const [reemitResultado, setReemitResultado] = useState(null);
  // na conferência: quais títulos entram na baixa (todos marcados por padrão)
  const [confSelecionados, setConfSelecionados] = useState(() => new Set());
  const [confOrdem, setConfOrdem] = useState({ campo: 'cliente', dir: 'asc' });

  // "1234", "1234/2", "5-1234-2" (empresa-fatura-parcela), separados por
  // linha, vírgula, ponto e vírgula ou espaço
  const listaParseada = useMemo(() => {
    const tokens = baixaLista
      .split(/[\n,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (baixaTipo === 'clientes') {
      return { clientes: [...new Set(tokens.map((t) => parseInt(t, 10)).filter((n) => n > 0))], faturas: [] };
    }
    const faturas = [];
    for (const t of tokens) {
      const m3 = t.match(/^(\d+)-(\d+)-(\d+)$/);
      const m2 = t.match(/^(\d+)\/(\d+)$/);
      const m1 = t.match(/^(\d+)$/);
      if (m3) faturas.push({ cd_empresa: +m3[1], nr_fatura: +m3[2], nr_parcela: +m3[3] });
      else if (m2) faturas.push({ nr_fatura: +m2[1], nr_parcela: +m2[2] });
      else if (m1) faturas.push({ nr_fatura: +m1[1] });
    }
    return { clientes: [], faturas };
  }, [baixaLista, baixaTipo]);

  const chamarBaixa = async (body) => {
    const resp = await fetch(`${TotvsURL}remessa-boletos/baixar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, usuario: user?.name || user?.email || '' }),
    });
    const json = await resp.json();
    if (!resp.ok || json.success === false) {
      throw new Error(json.message || `HTTP ${resp.status}`);
    }
    return json.data || {};
  };

  const selPendentes = useMemo(() => boletos.filter((b) => selecionados.has(b.id) && PODE_BAIXAR(b)), [boletos, selecionados]);
  const selReemitir = useMemo(() => boletos.filter((b) => selecionados.has(b.id) && PODE_REEMITIR(b)), [boletos, selecionados]);
  const naoReemitir = useMemo(() => boletos.filter((b) => CANCELADO_OU_FALHOU(b) && TITULO_FECHADO_TOTVS(b)).length, [boletos]);

  const criterio = () => {
    if (selPendentes.length) return { ids: selPendentes.map((b) => b.id) };
    return listaParseada;
  };

  // Reemite (na conta de emissão atual, ex.: FA MODA) as faturas dos boletos cancelados / não emitidos marcados.
  const reemitir = async () => {
    const lista = selReemitir;
    if (!lista.length) return;
    const contaNome = contasPagarme ? contaDe(contasPagarme.emissao).nome : 'conta de emissão';
    const valor = lista.reduce((t, b) => t + Number(b.vl_fatura || 0), 0);
    if (
      !window.confirm(
        `Reemitir ${lista.length} boleto(s) na Pagar.me ${contaNome}?\n\nValor: ${fmtBRL(valor)}\n` +
          'Cada fatura é relida no TOTVS: só emite se ainda estiver em aberto, a vencer e no portador da remessa. Os boletos são emitidos de verdade.',
      )
    )
      return;
    setReemitindo(true);
    setReemitResultado(null);
    setErro('');
    const remessaId = `R${Date.now()}`;
    const todos = [];
    try {
      for (let i = 0; i < lista.length; i += LOTE_REMESSA) {
        const lote = lista.slice(i, i + LOTE_REMESSA);
        setReemitProgresso(`${Math.min(i + lote.length, lista.length)}/${lista.length}`);
        const resp = await fetch(`${TotvsURL}remessa-boletos/gerar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            remessaId,
            usuario: user?.email || user?.name || null,
            faturas: lote.map((b) => ({ cd_empresa: b.cd_empresa, cd_cliente: b.cd_cliente, nr_fatura: b.nr_fatura, nr_parcela: b.nr_parcela })),
          }),
        });
        const json = await resp.json();
        if (!resp.ok || json.success === false) throw new Error(json.message || `HTTP ${resp.status}`);
        todos.push(...(json.data?.resultados || []));
      }
    } catch (e) {
      setErro(`Reemissão interrompida: ${e.message}`);
    } finally {
      const ok = todos.filter((r) => r.ok).length;
      setReemitResultado({ emitidos: ok, falhas: todos.filter((r) => !r.ok) });
      setAviso(`${ok} boleto(s) reemitido(s) na Pagar.me ${contaNome}${todos.length - ok ? `, ${todos.length - ok} não emitido(s) (veja os motivos)` : ''}.`);
      setSelecionados(new Set());
      setReemitindo(false);
      setReemitProgresso('');
      await carregar();
    }
  };

  const conferirBaixa = async () => {
    setBaixaErro('');
    setBaixaResultado(null);
    setBaixaConferencia(null);
    const c = criterio();
    if (!c.ids?.length && !c.clientes?.length && !c.faturas?.length) {
      setBaixaErro('Selecione boletos na tabela ou cole uma lista de clientes/faturas.');
      return;
    }
    setBaixaCarregando(true);
    try {
      const r = await chamarBaixa({ ...c, confirmar: false });
      setBaixaConferencia(r);
      setConfSelecionados(new Set((r.itens || []).map((i) => i.id)));
    } catch (e) {
      setBaixaErro(`Erro na conferência: ${e.message}`);
    } finally {
      setBaixaCarregando(false);
    }
  };

  // itens da conferência ordenados + resumo do que está marcado
  const confItens = useMemo(() => {
    const itens = [...(baixaConferencia?.itens || [])];
    const { campo, dir } = confOrdem;
    const sinal = dir === 'asc' ? 1 : -1;
    itens.sort((a, b) => {
      let r = 0;
      if (campo === 'valor') r = Number(a.vl_fatura || 0) - Number(b.vl_fatura || 0);
      else if (campo === 'vencimento') r = String(a.dt_vencimento || '').localeCompare(String(b.dt_vencimento || ''));
      else if (campo === 'fatura') r = Number(a.nr_fatura) - Number(b.nr_fatura) || Number(a.nr_parcela) - Number(b.nr_parcela);
      else r = String(a.nm_cliente || '').localeCompare(String(b.nm_cliente || ''), 'pt-BR', { sensitivity: 'base' });
      if (r === 0 && campo !== 'cliente') {
        r = String(a.nm_cliente || '').localeCompare(String(b.nm_cliente || ''), 'pt-BR', { sensitivity: 'base' });
      }
      return r * sinal;
    });
    return itens;
  }, [baixaConferencia, confOrdem]);

  const confResumo = useMemo(() => {
    const marcados = (baixaConferencia?.itens || []).filter((i) => confSelecionados.has(i.id));
    return {
      qtd: marcados.length,
      valor: marcados.reduce((a, i) => a + Number(i.vl_fatura || 0), 0),
      clientes: new Set(marcados.map((i) => i.cd_cliente)).size,
    };
  }, [baixaConferencia, confSelecionados]);

  const ordenarConf = (campo) =>
    setConfOrdem((o) => ({
      campo,
      dir: o.campo === campo && o.dir === 'asc' ? 'desc' : 'asc',
    }));

  const alternarConf = (id) =>
    setConfSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const confirmarBaixa = async () => {
    if (!confResumo.qtd) return;
    const ok = window.confirm(
      `Cancelar ${confResumo.qtd} boleto(s) na Pagar.me (${fmtBRL(confResumo.valor)})?\n` +
        'Os clientes não conseguirão mais pagar esses boletos. Os títulos no TOTVS continuam em aberto.',
    );
    if (!ok) return;
    setBaixaErro('');
    setBaixaCarregando(true);
    try {
      // cancela só os títulos marcados na conferência (ids), mesmo que a lista tenha mudado
      const r = await chamarBaixa({
        ids: baixaConferencia.itens.filter((i) => confSelecionados.has(i.id)).map((i) => i.id),
        confirmar: true,
        motivo: baixaMotivo,
      });
      setBaixaResultado(r);
      setBaixaConferencia(null);
      setConfSelecionados(new Set());
      setSelecionados(new Set());
      setAviso(
        `${r.qtd} boleto(s) baixado(s) na Pagar.me (${fmtBRL(r.valor)})` +
          (r.erros?.length ? `, ${r.erros.length} com erro` : '') +
          '.',
      );
      await carregar();
    } catch (e) {
      setBaixaErro(`Erro ao baixar: ${e.message}`);
    } finally {
      setBaixaCarregando(false);
    }
  };

  const alternarSelecao = (id) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams({ modo, dt_inicio: dataInicio, dt_fim: dataFim });
      if (empresasSelecionadas.length) {
        params.append('branches', empresasSelecionadas.map((e) => e.cd_empresa).join(','));
      }
      const resp = await fetch(`${TotvsURL}remessa-boletos/boletos?${params}`);
      const json = await resp.json();
      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }
      setBoletos(json.data?.items || []);
      setTabelaAusente(Boolean(json.data?.tabelaAusente));
      if (json.data?.contasPagarme) setContasPagarme(json.data.contasPagarme);
    } catch (e) {
      setErro(`Erro ao carregar boletos: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sincronizar = async () => {
    setSincronizando(true);
    setErro('');
    setAviso('');
    try {
      const resp = await fetch(`${TotvsURL}remessa-boletos/sincronizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentarErros: true }),
      });
      const json = await resp.json();
      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }
      const r = json.data || {};
      setAviso(
        `${r.consultados || 0} boleto(s) consultado(s) na Pagar.me: ${r.pagos || 0} pago(s), ` +
          `${r.cancelados || 0} cancelado(s), ${r.baixados || 0} baixa(s) no TOTVS` +
          (r.totvsFechados ? `, ${r.totvsFechados} pendente(s) com título já fechado no TOTVS (baixar na Pagar.me)` : '') +
          (r.errosBaixa ? `, ${r.errosBaixa} erro(s) de baixa` : '') +
          (r.errosConsulta ? `, ${r.errosConsulta} sem resposta da Pagar.me` : '') +
          '.',
      );
      await carregar();
    } catch (e) {
      setErro(`Erro ao atualizar retorno: ${e.message}`);
    } finally {
      setSincronizando(false);
    }
  };

  const copiar = async (b) => {
    try {
      await navigator.clipboard.writeText(b.linha_digitavel);
      setCopiado(b.id);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* clipboard indisponível */
    }
  };

  // Excel com exatamente o que está na tela (período, status, busca e filtros)
  const baixarExcel = () => {
    const linhas = visiveis.map((b) => ({
      'Conta Pagar.me': contaDoBoleto(b).nome,
      Empresa: b.cd_empresa,
      'Cód. cliente': b.cd_cliente,
      Cliente: b.nm_cliente || '',
      'CPF/CNPJ': b.nr_documento || '',
      Fatura: b.nr_fatura,
      Parcela: b.nr_parcela,
      'Emissão boleto': fmtData(b.created_at),
      Vencimento: fmtData(b.dt_vencimento),
      Valor: Number(b.vl_fatura || 0),
      'Acréscimo no boleto': Number(b.vl_acrescimo || 0),
      'Valor do boleto': Number(b.vl_fatura || 0) + Number(b.vl_acrescimo || 0),
      Status: (SITUACOES[b.situacao] || { label: b.status }).label,
      'Pago em': b.dt_pagamento ? fmtData(b.dt_pagamento) : '',
      'Valor pago': b.vl_pago != null ? Number(b.vl_pago) : '',
      'Baixa TOTVS': b.situacao === 'pago' ? (BAIXAS[b.baixa_status]?.label || b.baixa_status || '') : '',
      'Título no TOTVS': b.totvs_situacao ? `${b.totvs_situacao}${b.totvs_baixa_em ? ` (${fmtData(b.totvs_baixa_em)})` : ''}` : '',
      'Erro da baixa': b.baixa_erro || '',
      'Portador TOTVS': b.cd_portador_totvs ?? '',
      'Nome portador': b.nm_portador_totvs || '',
      'Carteira Simples OK': b.carteira_ok ? 'Sim' : 'Não',
      'Nosso número': b.nosso_numero || '',
      'Linha digitável': b.linha_digitavel || '',
      'Link do boleto': b.boleto_url || '',
      'Pedido Pagar.me': b.order_id || '',
      'Cobrança Pagar.me': b.charge_id || '',
      'Cancelado em': b.cancelado_em ? fmtData(b.cancelado_em) : '',
      'Cancelado por': b.cancelado_por || '',
      'Motivo cancelamento': b.cancel_motivo || '',
      'Erro emissão': b.erro_descricao || b.erro || '',
      Remessa: b.remessa_id || '',
      'Criado por': b.criado_por || '',
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Retorno Boleto');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const sufixo = situacao === 'todos' ? '' : `-${situacao}`;
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `retorno-boleto-${modo}-${dataInicio}_${dataFim}${sufixo}.xlsx`,
    );
  };

  const contagem = useMemo(() => {
    const c = {};
    for (const b of boletos) {
      c[b.situacao] = c[b.situacao] || { qtd: 0, valor: 0 };
      c[b.situacao].qtd++;
      c[b.situacao].valor += Number(b.vl_fatura || 0);
    }
    return c;
  }, [boletos]);

  const chaveFat = (b) => `${b.cd_empresa}-${b.nr_fatura}-${b.nr_parcela}`;
  const substituidos = useMemo(() => {
    const vivas = new Set(boletos.filter((b) => !PODE_REEMITIR(b)).map(chaveFat));
    return new Set(boletos.filter((b) => PODE_REEMITIR(b) && vivas.has(chaveFat(b))).map((b) => b.id));
  }, [boletos]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = boletos.filter(
      (b) =>
        (verSubstituidos || !substituidos.has(b.id)) &&
        (!soFechadosTotvs || FECHADO_TOTVS(b)) &&
        (situacao === 'todos' || b.situacao === situacao) &&
        // cancelado não está em conta nenhuma: só aparece em "todas"
        (filtroConta === 'todas' || (b.situacao !== 'cancelado' && (b.conta || 'crosby') === filtroConta)) &&
        (!q ||
          [b.nm_cliente, b.nr_documento, b.cd_cliente, b.nr_fatura, b.nosso_numero]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
    );
    const num = (v) => (v == null || v === '' ? -Infinity : Number(v));
    const txt = (v) => String(v || '');
    const chave = {
      cliente: (b) => txt(b.nm_cliente).toLowerCase(),
      fatura: (b) => num(b.nr_fatura) * 1000 + num(b.nr_parcela),
      emissao: (b) => txt(b.created_at),
      vencimento: (b) => txt(b.dt_vencimento),
      valor: (b) => num(b.vl_fatura),
      status: (b) => (SITUACOES[b.situacao]?.label || txt(b.status)).toLowerCase(),
      pago_em: (b) => txt(b.dt_pagamento),
      valor_pago: (b) => num(b.vl_pago),
      empresa: (b) => num(b.cd_empresa),
      conta: (b) => contaDoBoleto(b).label,
    }[ordem.campo];
    if (chave) {
      const sinal = ordem.dir === 'asc' ? 1 : -1;
      lista.sort((a, b) => {
        const x = chave(a);
        const y = chave(b);
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
        return (r || num(a.id) - num(b.id)) * sinal;
      });
    }
    return lista;
  }, [boletos, situacao, busca, filtroConta, ordem, verSubstituidos, substituidos, soFechadosTotvs]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-4">
      <PageTitle
        title="Retorno Boleto"
        subtitle="Boletos emitidos na Pagar.me, situação de cada um e baixa automática dos pagos"
        icon={Barcode}
        iconColor="text-green-600"
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 items-center">
          <div className="lg:col-span-2">
            <FiltroEmpresa
              empresasSelecionadas={empresasSelecionadas}
              onSelectEmpresas={setEmpresasSelecionadas}
              presets={[{ nome: 'Crosby', codigos: [1, 99, 100, 101] }]}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Período por</label>
            <select
              value={modo}
              onChange={(e) => setModo(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            >
              <option value="vencimento">Vencimento</option>
              <option value="emissao">Emissão do boleto</option>
              <option value="pagamento">Pagamento</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">De</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Até</label>
            <input
              type="date"
              value={dataFim}
              min={dataInicio}
              onChange={(e) => setDataFim(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Status</label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
            >
              <option value="todos">Todos</option>
              {Object.entries(SITUACOES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={carregar}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 bg-[#000638] text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-[#fe0000] transition-colors disabled:opacity-60 lg:mt-4"
          >
            {loading ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <MagnifyingGlass size={14} weight="bold" />
            )}
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {erro && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
            <Warning size={14} weight="fill" /> {erro}
          </div>
        )}
        {aviso && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle size={14} weight="fill" /> {aviso}
          </div>
        )}
        {reemitResultado?.falhas?.length > 0 && (
          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            <div className="font-semibold mb-1">Não reemitidos ({reemitResultado.falhas.length}):</div>
            <ul className="list-disc pl-5">
              {reemitResultado.falhas.map((f) => (
                <li key={f.chave}>
                  {f.chave}: {f.descricao || f.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}
        {tabelaAusente && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
            <Warning size={14} weight="fill" /> A tabela pagarme_boletos ainda não existe no Supabase
            — rode a migration.
          </div>
        )}
      </div>

      {/* Baixa em massa na Pagar.me */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 mb-3">
        <button
          type="button"
          onClick={() => setBaixaAberta((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-left"
        >
          <span className="flex items-center gap-2 text-xs font-bold text-[#000638]">
            <Prohibit size={16} weight="bold" className="text-red-600" />
            Baixa em massa na Pagar.me
            {selPendentes.length > 0 && (
              <span className="ml-1 rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px]">
                {selPendentes.length} pendente(s) marcado(s) na tabela
              </span>
            )}
          </span>
          {baixaAberta ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </button>
        {baixaAberta && (
          <div className="px-3 pb-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-500 mt-2">
              Cancela na Pagar.me os boletos <b>pendentes</b> (em aberto ou vencidos) dos
              clientes ou faturas informados — o cliente não consegue mais pagar o boleto.
              O título no TOTVS <b>não</b> muda. Marque os boletos na tabela abaixo ou cole
              uma lista; clique em <b>Conferir</b>, desmarque o que não quiser baixar
              (dá pra ordenar por cliente, fatura, vencimento ou valor) e, se estiver
              certo, <b>Confirmar baixa</b>.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-2 mt-2 items-start">
              <div>
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Lista de</label>
                <select
                  value={baixaTipo}
                  onChange={(e) => setBaixaTipo(e.target.value)}
                  disabled={selPendentes.length > 0}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
                >
                  <option value="clientes">Códigos de cliente</option>
                  <option value="faturas">Números de fatura</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  {baixaTipo === 'clientes'
                    ? 'Um código por linha (ou separados por vírgula). Pega todos os boletos pendentes do cliente.'
                    : 'Uma fatura por linha: 1234 (todas as parcelas), 1234/2 (parcela) ou 5-1234-2 (empresa-fatura-parcela).'}
                </p>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                  Lista {selPendentes.length > 0 && '(ignorada: usando os pendentes marcados na tabela)'}
                </label>
                <textarea
                  value={baixaLista}
                  onChange={(e) => setBaixaLista(e.target.value)}
                  disabled={selPendentes.length > 0}
                  rows={4}
                  placeholder={baixaTipo === 'clientes' ? '12345\n67890' : '123456\n123457/2'}
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs font-mono disabled:bg-gray-50"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Motivo (opcional)</label>
                <input
                  type="text"
                  value={baixaMotivo}
                  onChange={(e) => setBaixaMotivo(e.target.value)}
                  maxLength={200}
                  placeholder="Ex.: pago por PIX, renegociado, fatura cancelada"
                  className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full text-xs"
                />
              </div>
              <div className="flex flex-col gap-2 lg:mt-4">
                <button
                  onClick={conferirBaixa}
                  disabled={baixaCarregando || tabelaAusente}
                  className="flex items-center justify-center gap-1.5 bg-[#000638] text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-[#fe0000] transition-colors disabled:opacity-50"
                >
                  {baixaCarregando && !baixaConferencia ? (
                    <Spinner size={14} className="animate-spin" />
                  ) : (
                    <MagnifyingGlass size={14} weight="bold" />
                  )}
                  Conferir
                </button>
                <button
                  onClick={confirmarBaixa}
                  disabled={baixaCarregando || !confResumo.qtd}
                  className="flex items-center justify-center gap-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-red-700 transition-colors disabled:opacity-40"
                >
                  {baixaCarregando && baixaConferencia ? (
                    <Spinner size={14} className="animate-spin" />
                  ) : (
                    <Prohibit size={14} weight="bold" />
                  )}
                  Confirmar baixa{confResumo.qtd ? ` (${confResumo.qtd})` : ''}
                </button>
              </div>
            </div>
            {baixaErro && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                <Warning size={14} weight="fill" /> {baixaErro}
              </div>
            )}
            {baixaConferencia && (
              <div className="mt-2 border border-gray-200 rounded-lg p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[#000638]">
                    {baixaConferencia.qtd} boleto(s) pendente(s) encontrado(s) de{' '}
                    {baixaConferencia.clientes} cliente(s), {fmtBRL(baixaConferencia.valor)}.
                  </div>
                  <div className="text-xs font-bold text-red-700">
                    Marcados para baixa: {confResumo.qtd} boleto(s) de {confResumo.clientes}{' '}
                    cliente(s), {fmtBRL(confResumo.valor)}
                  </div>
                </div>
                {(baixaConferencia.naoEncontrados?.clientes?.length > 0 ||
                  baixaConferencia.naoEncontrados?.faturas?.length > 0) && (
                  <div className="text-[11px] text-amber-700 mt-1">
                    Sem boleto pendente:{' '}
                    {[
                      ...(baixaConferencia.naoEncontrados.clientes || []).map((c) => `cliente ${c}`),
                      ...(baixaConferencia.naoEncontrados.faturas || []).map((f) => `fatura ${f}`),
                    ].join(', ')}
                  </div>
                )}
                {baixaConferencia.qtd > 0 && (
                  <div className="overflow-x-auto max-h-[70vh] overflow-y-auto mt-2 border border-gray-100 rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 text-gray-700 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-center w-8">
                            <input
                              type="checkbox"
                              aria-label="Marcar todos"
                              checked={
                                confItens.length > 0 && confItens.every((i) => confSelecionados.has(i.id))
                              }
                              onChange={(e) =>
                                setConfSelecionados(
                                  e.target.checked ? new Set(confItens.map((i) => i.id)) : new Set(),
                                )
                              }
                            />
                          </th>
                          <th className="px-2 py-1.5 text-left">Conta</th>
                          <th className="px-2 py-1.5 text-left">Empresa</th>
                          {[
                            ['cliente', 'Cliente', 'text-left'],
                            ['fatura', 'Fatura', 'text-left'],
                            ['vencimento', 'Vencimento', 'text-left'],
                            ['valor', 'Valor', 'text-right'],
                          ].map(([campo, rotulo, al]) => (
                            <th
                              key={campo}
                              className={`px-2 py-1.5 ${al} cursor-pointer select-none hover:text-[#fe0000]`}
                              onClick={() => ordenarConf(campo)}
                              title="Clique para ordenar"
                            >
                              <span className="inline-flex items-center gap-0.5">
                                {rotulo}
                                {confOrdem.campo === campo &&
                                  (confOrdem.dir === 'asc' ? (
                                    <ArrowUp size={11} weight="bold" />
                                  ) : (
                                    <ArrowDown size={11} weight="bold" />
                                  ))}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {confItens.map((i) => (
                          <tr
                            key={i.id}
                            onClick={() => alternarConf(i.id)}
                            className={`border-b border-gray-100 cursor-pointer ${
                              confSelecionados.has(i.id) ? 'bg-red-50' : 'opacity-60'
                            }`}
                          >
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="checkbox"
                                aria-label="Baixar este título"
                                checked={confSelecionados.has(i.id)}
                                onChange={() => alternarConf(i.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <span className={`inline-block text-[10px] font-bold rounded border px-1.5 py-0.5 ${contaDe(i.conta).cls}`}>
                                {contaDe(i.conta).label}
                              </span>
                            </td>
                            <td className="px-2 py-1.5">{i.cd_empresa}</td>
                            <td className="px-2 py-1.5">
                              <span className="text-gray-500">{i.cd_cliente} - </span>
                              <span className="font-semibold text-[#000638]">{i.nm_cliente || '—'}</span>
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {i.nr_fatura}/{i.nr_parcela}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(i.dt_vencimento)}</td>
                            <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                              {fmtBRL(i.vl_fatura)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {baixaResultado && (
              <div className="mt-2 text-xs">
                <div className="flex items-center gap-1.5 text-green-700 font-semibold">
                  <CheckCircle size={14} weight="fill" />
                  {baixaResultado.qtd} boleto(s) cancelado(s) na Pagar.me ({fmtBRL(baixaResultado.valor)}).
                </div>
                {baixaResultado.erros?.length > 0 && (
                  <ul className="mt-1 text-red-600 list-disc pl-5">
                    {baixaResultado.erros.map((e) => (
                      <li key={e.id}>
                        {e.fatura}: {e.erro}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* João (23/10/2026): recebidos que ainda precisam de baixa (vão pela aba Solicitações de Baixa) */}
      {(() => {
        const pagos = boletos.filter((b) => b.situacao === 'pago');
        const aBaixar = pagos.filter((b) => A_BAIXAR.has(b.baixa_status));
        const aguardando = pagos.filter((b) => b.baixa_status === 'aguardando_credito');
        const soma = (l) => l.reduce((a, b) => a + Number(b.vl_fatura || 0), 0);
        if (!aBaixar.length && !aguardando.length) return null;
        return (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-amber-900">
            <div>
              <div className="text-[11px] font-semibold">Boletos recebidos a baixar (cartão débito PAGARME, na data do recebimento)</div>
              <div className="text-lg font-bold">
                {aBaixar.length} <span className="text-xs font-semibold opacity-80">{fmtBRL(soma(aBaixar))}</span>
              </div>
            </div>
            {aguardando.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold">Pagos, aguardando crédito na Pagar.me</div>
                <div className="text-lg font-bold">
                  {aguardando.length} <span className="text-xs font-semibold opacity-80">{fmtBRL(soma(aguardando))}</span>
                </div>
              </div>
            )}
            <a href="/solicitacao-baixa" className="ml-auto text-[11px] font-bold underline decoration-dotted">
              abrir Solicitações de Baixa →
            </a>
          </div>
        );
      })()}

      {/* João (30/10/2026): boleto aberto na Pagar.me mas título já PAGO no TOTVS
          (ex.: cliente pagou por Pix) → cancelar o boleto na Pagar.me num clique. */}
      {(() => {
        const pagosPorFora = boletos.filter((b) => PODE_BAIXAR(b) && TITULO_FECHADO_TOTVS(b));
        if (!pagosPorFora.length) return null;
        const soma = pagosPorFora.reduce((a, b) => a + Number(b.vl_fatura || 0), 0);
        return (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-red-900">
            <div>
              <div className="text-[11px] font-semibold">Pago por fora (ex.: Pix) — boleto ainda aberto na Pagar.me, cancelar</div>
              <div className="text-lg font-bold">
                {pagosPorFora.length} <span className="text-xs font-semibold opacity-80">{fmtBRL(soma)}</span>
              </div>
            </div>
            <button
              onClick={() => {
                setSoFechadosTotvs(true);
                setSelecionados(new Set(pagosPorFora.map((b) => b.id)));
                setBaixaAberta(true);
              }}
              className="ml-auto flex items-center gap-1.5 bg-red-700 text-white text-xs font-bold rounded-lg px-3 py-2 hover:bg-red-800 transition-colors"
              title="Marca todos os boletos abertos na Pagar.me cujo título já está pago no TOTVS (ex.: Pix) para cancelar na Pagar.me"
            >
              Cancelar na Pagar.me ({pagosPorFora.length})
            </button>
          </div>
        );
      })()}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {['aberto', 'vencido', 'pago', 'cancelado'].map((k) => (
          <button
            key={k}
            onClick={() => setSituacao(situacao === k ? 'todos' : k)}
            className={`text-left bg-white rounded-lg border p-3 ${
              situacao === k ? 'border-[#000638] ring-1 ring-[#000638]' : 'border-gray-200'
            }`}
          >
            <div className="text-[11px] text-gray-500">{SITUACOES[k].label}</div>
            <div className="text-lg font-bold text-[#000638]">
              {contagem[k]?.qtd || 0}{' '}
              <span className="text-xs font-semibold text-gray-500">
                {fmtBRL(contagem[k]?.valor || 0)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-2 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por cliente, CPF/CNPJ ou nº da fatura"
            className="border border-gray-300 rounded-lg px-2 py-1.5 w-full sm:w-80 text-xs"
          />
          <select
            value={filtroConta}
            onChange={(e) => setFiltroConta(e.target.value)}
            title="Conta Pagar.me em que o boleto foi emitido"
            className={`border rounded-lg px-2 py-1.5 text-xs ${filtroConta === 'todas' ? 'border-gray-300' : contaDe(filtroConta).cls}`}
          >
            <option value="todas">Conta: todas</option>
            <option value="crosby">Crosby (FERREIRA)</option>
            <option value="fabio">FA MODA (Fábio)</option>
          </select>
          {(() => {
            const n = boletos.filter(FECHADO_TOTVS).length;
            return (
              <label
                className={`flex items-center gap-1 text-[11px] cursor-pointer ${n ? 'text-red-700 font-semibold' : 'text-gray-600'}`}
                title="Boleto pendente cujo título já está pago, renegociado ou cancelado no TOTVS — precisa ser baixado na Pagar.me"
              >
                <input type="checkbox" checked={soFechadosTotvs} onChange={(e) => setSoFechadosTotvs(e.target.checked)} />
                Só título fechado no TOTVS{n ? ` (${n})` : ''}
                {n > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelecionados(new Set(boletos.filter(FECHADO_TOTVS).map((b) => b.id)));
                      setBaixaAberta(true);
                    }}
                    className="ml-1 underline decoration-dotted"
                    title="Marca todos esses na tabela para a baixa em massa"
                  >
                    marcar p/ baixar
                  </button>
                )}
              </label>
            );
          })()}
          <label
            className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer"
            title="Cancelados / não emitidos de faturas que já têm um boleto novo (ex.: cancelou na Crosby e reemitiu na FA MODA)"
          >
            <input type="checkbox" checked={verSubstituidos} onChange={(e) => setVerSubstituidos(e.target.checked)} />
            Mostrar cancelados substituídos{substituidos.size ? ` (${substituidos.size})` : ''}
          </label>
          {naoReemitir > 0 && (
            <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded px-2 py-0.5" title="Cancelados cujo título já foi renegociado/baixado no TOTVS — ficam fora da reemissão">
              {naoReemitir} não reemitir (título fechado no TOTVS)
            </span>
          )}
          {contasPagarme && (
            <span
              className={`text-[11px] font-semibold rounded px-2 py-1 border ${contaDe(contasPagarme.emissao).cls}`}
              title={contasPagarme.contas.map((c) => `${c.nome}: ${c.configurada ? 'conectada' : 'sem chave'}`).join(' · ')}
            >
              Emissão nova sai pela {contaDe(contasPagarme.emissao).label}
              {contasPagarme.contas.some((c) => !c.configurada) ? ` · ${contasPagarme.contas.filter((c) => !c.configurada).map((c) => c.label || c.nome).join(', ')} sem chave` : ''}
            </span>
          )}
          <button
            onClick={reemitir}
            disabled={reemitindo || selReemitir.length === 0}
            title="Reemite na Pagar.me (conta de emissão atual) as faturas dos boletos cancelados / não emitidos marcados na tabela"
            className="flex items-center gap-1.5 bg-violet-700 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-violet-800 transition-colors disabled:opacity-50"
          >
            {reemitindo ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} weight="bold" />}
            {reemitindo
              ? `Reemitindo ${reemitProgresso}...`
              : `Reemitir na ${contasPagarme ? contaDe(contasPagarme.emissao).label : 'Pagar.me'} (${selReemitir.length})`}
          </button>
          <button
            onClick={baixarExcel}
            disabled={visiveis.length === 0}
            title="Exporta para Excel exatamente os boletos da consulta filtrada na tela"
            className="flex items-center gap-1.5 bg-white text-[#000638] border border-[#000638]/30 text-xs font-semibold rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <FileXls size={14} weight="bold" /> Baixar Excel ({visiveis.length})
          </button>
          <button
            onClick={sincronizar}
            disabled={sincronizando || tabelaAusente}
            title="Consulta a Pagar.me agora e baixa no TOTVS os boletos pagos"
            className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {sincronizando ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={14} weight="bold" />
            )}
            {sincronizando ? 'Atualizando...' : 'Atualizar retorno'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#000638] text-white">
              <tr>
                <th className="px-2 py-2 text-center" title="Marcar para baixa na Pagar.me">
                  <input
                    type="checkbox"
                    aria-label="Marcar todos os pendentes visíveis"
                    checked={
                      visiveis.some((b) => PODE_BAIXAR(b) || PODE_REEMITIR(b)) &&
                      visiveis.filter((b) => PODE_BAIXAR(b) || PODE_REEMITIR(b)).every((b) => selecionados.has(b.id))
                    }
                    onChange={(e) => {
                      const pend = visiveis.filter((b) => PODE_BAIXAR(b) || PODE_REEMITIR(b));
                      setSelecionados((prev) => {
                        const n = new Set(prev);
                        for (const b of pend) {
                          if (e.target.checked) n.add(b.id);
                          else n.delete(b.id);
                        }
                        return n;
                      });
                    }}
                  />
                </th>
                {[
                  ['conta', 'Conta', 'text-left'],
                  ['empresa', 'Empresa', 'text-left'],
                  ['cliente', 'Cliente', 'text-left'],
                  ['fatura', 'Fatura', 'text-left'],
                  ['emissao', 'Emissão boleto', 'text-left'],
                  ['vencimento', 'Vencimento', 'text-left'],
                  ['valor', 'Valor', 'text-right'],
                  ['status', 'Status', 'text-left'],
                  ['pago_em', 'Pago em', 'text-left'],
                  ['valor_pago', 'Valor pago', 'text-right'],
                ].map(([campo, rotulo, al]) => (
                  <th
                    key={campo}
                    className={`px-2 py-2 ${al} cursor-pointer select-none hover:text-amber-300 whitespace-nowrap`}
                    onClick={() => ordenarPor(campo)}
                    title="Clique para ordenar (clique de novo para inverter)"
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {rotulo}
                      {ordem.campo === campo &&
                        (ordem.dir === 'asc' ? <ArrowUp size={11} weight="bold" /> : <ArrowDown size={11} weight="bold" />)}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-2 text-left">Baixa TOTVS</th>
                <th className="px-2 py-2 text-left">Boleto</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-2 py-16 text-center text-gray-500">
                    {loading
                      ? 'Carregando...'
                      : boletos.length === 0
                        ? 'Nenhum boleto no período. Ajuste empresa, período e status e clique em Buscar.'
                        : 'Nenhum boleto no filtro.'}
                  </td>
                </tr>
              )}
              {visiveis.map((b) => {
                const sit = SITUACOES[b.situacao] || { label: b.status, cls: 'bg-gray-100' };
                const bx = BAIXAS[b.baixa_status];
                return (
                  <tr
                    key={b.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${contaDoBoleto(b).row} ${
                      selecionados.has(b.id) ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-2 py-1.5 text-center">
                      {(PODE_BAIXAR(b) || PODE_REEMITIR(b)) && (
                        <input
                          type="checkbox"
                          aria-label={PODE_BAIXAR(b) ? 'Marcar para baixa na Pagar.me' : 'Marcar para reemitir'}
                          title={PODE_BAIXAR(b) ? 'Pendente: marque para baixar (cancelar) na Pagar.me' : 'Cancelado / não emitido: marque para reemitir'}
                          checked={selecionados.has(b.id)}
                          onChange={() => alternarSelecao(b.id)}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span
                        className={`inline-block text-[10px] font-bold rounded border px-1.5 py-0.5 ${contaDoBoleto(b).cls}`}
                        title={b.situacao === 'cancelado' ? 'Boleto cancelado: não está em nenhuma conta' : `Boleto emitido na conta ${contaDoBoleto(b).nome}`}
                      >
                        {contaDoBoleto(b).label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{b.cd_empresa}</td>
                    <td className="px-2 py-1.5">
                      <span className="text-gray-500">{b.cd_cliente} - </span>
                      <span className="font-semibold text-[#000638]">{b.nm_cliente || '—'}</span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {b.nr_fatura}/{b.nr_parcela}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(b.created_at)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(b.dt_vencimento)}</td>
                    <td
                      className="px-2 py-1.5 text-right font-semibold whitespace-nowrap"
                      title={Number(b.vl_acrescimo) > 0 ? `Fatura ${fmtBRL(b.vl_fatura)} + acréscimo ${fmtBRL(b.vl_acrescimo)} = boleto ${fmtBRL(Number(b.vl_fatura || 0) + Number(b.vl_acrescimo || 0))}` : 'Valor da fatura (boleto emitido sem acréscimo)'}
                    >
                      {fmtBRL(b.vl_fatura)}
                      {Number(b.vl_acrescimo) > 0 && <span className="ml-1 text-[10px] text-violet-700 font-normal">+{fmtBRL(b.vl_acrescimo)}</span>}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span
                        className={`inline-block font-semibold rounded px-1.5 py-0.5 ${sit.cls}`}
                        title={b.erro || ''}
                      >
                        {sit.label}
                      </span>
                      {CANCELADO_OU_FALHOU(b) && TITULO_FECHADO_TOTVS(b) && (
                        <span
                          className="ml-1 inline-block text-[10px] font-bold rounded px-1 py-0.5 bg-gray-800 text-white"
                          title={`Título ${(TOTVS_SIT[b.totvs_situacao] || TOTVS_SIT.nao_encontrado).label.toLowerCase()} no TOTVS${b.totvs_baixa_em ? ` em ${fmtData(b.totvs_baixa_em)}` : ''} — não reemitir (as parcelas novas aparecem na Remessa)`}
                        >
                          {(TOTVS_SIT[b.totvs_situacao] || TOTVS_SIT.nao_encontrado).label} · não reemitir
                        </span>
                      )}
                      {b.totvs_situacao && b.situacao !== 'pago' && b.situacao !== 'cancelado' && b.situacao !== 'falhou' && b.totvs_situacao !== 'aberto' && (
                        <span
                          className={`ml-1 inline-block text-[10px] font-bold rounded px-1 py-0.5 ${(TOTVS_SIT[b.totvs_situacao] || TOTVS_SIT.nao_encontrado).cls}`}
                          title={`Conferido no TOTVS em ${b.totvs_conferido_em ? new Date(b.totvs_conferido_em).toLocaleString('pt-BR') : '—'}${b.totvs_baixa_em ? ` · baixa em ${fmtData(b.totvs_baixa_em)}` : ''}`}
                        >
                          {(TOTVS_SIT[b.totvs_situacao] || TOTVS_SIT.nao_encontrado).label}
                        </span>
                      )}
                      {b.situacao !== 'falhou' && !b.carteira_ok && (
                        <span
                          className="ml-1 text-amber-600"
                          title={`Carteira não mudou para Simples no TOTVS: ${b.carteira_erro || 'não processado'}`}
                        >
                          <Warning size={13} weight="fill" className="inline" />
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(b.dt_pagamento)}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmtBRL(b.vl_pago)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {b.situacao === 'pago' && bx ? (
                        <span className={`font-semibold ${bx.cls}`} title={b.baixa_erro || ''}>
                          {bx.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {b.boleto_url ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={b.boleto_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir boleto"
                            className="text-[#000638] hover:text-[#fe0000]"
                          >
                            <ArrowSquareOut size={15} weight="bold" />
                          </a>
                          <button
                            onClick={() => copiar(b)}
                            title="Copiar linha digitável"
                            className="text-[#000638] hover:text-[#fe0000]"
                          >
                            {copiado === b.id ? (
                              <CheckCircle size={15} weight="fill" className="text-green-700" />
                            ) : (
                              <Copy size={15} weight="bold" />
                            )}
                          </button>
                        </div>
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
      </div>
    </div>
  );
}
