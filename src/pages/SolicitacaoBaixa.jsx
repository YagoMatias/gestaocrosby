import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabase, supabaseAdmin } from '../lib/supabase';
import PageTitle from '../components/ui/PageTitle';
import Notification from '../components/ui/Notification';
import { TotvsURL } from '../config/constants';
import {
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  Funnel,
  Eye,
  Spinner,
  ArrowClockwise,
  Trash,
  X,
  Image,
  FileText,
  CaretUp,
  CaretDown,
  Bank,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOut,
  CalendarBlank,
  PencilSimple, CreditCard, ClockCounterClockwise } from '@phosphor-icons/react';

const SolicitacaoBaixa = () => {
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  // João (23/10/2026): caixas por origem (Pix BlueCard / boleto Pagar.me recebido)
  const [filtroOrigem, setFiltroOrigem] = useState('');
  const [filtroPortador, setFiltroPortador] = useState('TODOS');
  // João (23/10/2026): filtrar por forma de pagamento (p/ contar as baixas feitas por forma)
  const [filtroForma, setFiltroForma] = useState('TODAS');
  // João (26/10/2026): baixar dia a dia — filtro por data de pagamento (de/até)
  const [filtroDataDe, setFiltroDataDe] = useState('');
  // Histórico de lotes (João, 26/10/2026): cada Processar vira 1 lote com os itens e os erros
  const [modalHistorico, setModalHistorico] = useState(false);
  const [lotes, setLotes] = useState([]);
  const [loteAberto, setLoteAberto] = useState(null);
  const [carregandoLotes, setCarregandoLotes] = useState(false);
  const [loteCopiado, setLoteCopiado] = useState(null);
  // Copia os números dos títulos do lote no formato que o Retorno Boleto aceita
  // colar (empresa-fatura-parcela, um por linha) — João, 30/10/2026.
  const copiarTitulosLote = async (l) => {
    const linhas = [...new Set((l.itens || []).map((it) => String(it.titulo || '').replace('/', '-').trim()).filter(Boolean))];
    if (!linhas.length) return;
    const txt = linhas.join('\n');
    try {
      await navigator.clipboard.writeText(txt);
      setLoteCopiado(l.id);
      setTimeout(() => setLoteCopiado(null), 2000);
    } catch {
      window.prompt('Copie os títulos (cole no Retorno Boleto):', txt);
    }
  };
  const carregarLotes = async () => {
    setCarregandoLotes(true);
    try {
      const r = await fetch(`${TotvsURL.replace(/totvs\/?$/, '')}baixa-lotes?dias=60`);
      const j = await r.json();
      setLotes(j.lotes || []);
    } catch (e) {
      setLotes([]);
    } finally {
      setCarregandoLotes(false);
    }
  };
  const [filtroDataAte, setFiltroDataAte] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [processingBaixa, setProcessingBaixa] = useState(false);

  // Modal de comprovante
  const [modalComprovante, setModalComprovante] = useState(null);
  const [zoomImagem, setZoomImagem] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Modal de rejeição
  const [modalRejeicao, setModalRejeicao] = useState(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  // Edição inline de data de pagamento
  const [editandoData, setEditandoData] = useState(null); // id da solicitação em edição

  // Edição inline de forma de pagamento
  const [editandoFormaPgto, setEditandoFormaPgto] = useState(null);

  // Modal de seleção de forma de pagamento para processamento
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [formaPagamentoProcessamento, setFormaPagamentoProcessamento] =
    useState('');
  const [bancoSelecionado, setBancoSelecionado] = useState(null);
  const [dadosCartaoProcessamento, setDadosCartaoProcessamento] = useState({
    bandeira: '',
    autorizacao: '',
    nsu: '',
    operadora: '',
  });
  // "Pagamento real" do TOTVS: data da baixa. Vazio = data de pagamento de cada solicitação.
  const [dataPagamentoReal, setDataPagamentoReal] = useState('');

  // Localizar/escolher título manualmente (João, 16/11/2026): para as linhas que
  // não casaram no match automático (fatura 0 / "a conferir") — escolher o título
  // certo no TOTVS, ajustar o cliente (pessoa errada) e somar vários títulos quando
  // o pagamento cobre mais de um.
  const [modalLocalizar, setModalLocalizar] = useState(null);
  const [locCod, setLocCod] = useState('');
  const [locNome, setLocNome] = useState('');
  const [locPessoas, setLocPessoas] = useState([]);
  const [locTitulos, setLocTitulos] = useState([]);
  const [locSel, setLocSel] = useState({});
  const [locLoading, setLocLoading] = useState(false);
  const [locBuscandoPessoa, setLocBuscandoPessoa] = useState(false);
  // valor a baixar por título (permite baixa PARCIAL — João, 16/11/2026): default = saldo em aberto
  const [locValor, setLocValor] = useState({});

  const FORMAS_PAGAMENTO = [
    {
      id: 'confianca',
      label: 'Confiança',
      paidType: 4,
      bank: { bankNumber: 422, agencyNumber: 1610, account: '005818984' },
    },
    {
      id: 'sicredi',
      label: 'Sicredi',
      paidType: 4,
      bank: { bankNumber: 748, agencyNumber: 2207, account: '367338' },
    },
    { id: 'adiantamento', label: 'Adiantamento (PIX TOTVS)', paidType: 3 },
    { id: 'cartao_credito', label: 'Cartão de Crédito', paidType: 1 },
    // João (22/10/2026): escolher "Cartão de Débito" já vem tudo preenchido como
    // PAGARME DEBITO — só a data real é informada (NSU/autorização = ddmmaaaa).
    {
      id: 'cartao_debito',
      label: 'Cartão de Débito (PAGARME DEBITO)',
      // 23/10/2026: provado com sonda na API (fatura inexistente) que o tipo
      // (1/2) não muda nada e que a API só acha cartão com Bandeira preenchida
      // no cadastro (FCXFL002). O backend resolve operadora/bandeira lendo o
      // cadastro do cartão do portador 9901 na hora da baixa (`portador`).
      paidType: 2,
      cardAuto: true,
      portador: 9901,
      // TOTVS: cartão seq 63 (portador 9901 "PAGARME DEBITO"), operatorName PAGARME.
      // Combinação ainda em acerto — os dois campos ficam editáveis.
      // Fixos = exatamente o cadastro de cartões do TOTVS (payment-cards, débito
      // seq 63, portador 9901): operadora "PAGARME", SEM bandeira. João (23/10/2026):
      // só a data real é editável; o resto vai padrão.
      operadora: 'PAGARME',
      bandeira: '',
    },
    { id: 'credev', label: 'CREDEV', paidType: 5 },
    // Pix pago dentro do app BlueCard, pela conta Pagar.me da Crosby. O dinheiro
    // cai na conta da Pagar.me, não num banco do TOTVS — por isso sem `bank`.
    // 23/10/2026 — ESCONDIDA do seletor (João): baixava em conta corrente
    // (banco fixo do backend), caminho errado. Tudo que entra pela Pagar.me
    // deve baixar como Cartão de Débito PAGARME. Mantida só pro rótulo das
    // solicitações antigas (forma_pagamento = 'pix_pagarme').
    { id: 'pix_pagarme', label: 'Pix Pagar.me (BlueCard)', paidType: 4, oculta: true },
    // Regra do João (Contas a Receber, 22/10/2026): tudo que é recebido pela
    // Pagar.me (Pix do BlueCard, boleto Stone) baixa no TOTVS como CARTÃO DE
    // DÉBITO, operadora PAGARME DEBITO, NSU e autorização = data do pagamento
    // de cada título. Sem digitação: os dados vão automáticos.
    // Cadastro no TOTVS (FCRFP, cartões): tipo 5 (débito), seq. 63, descrição
    // "PAGARME DEBITO", operadora "PAGARME", bandeira vazia, 1 parcela, portador
    // 9901. O TOTVS acha o cartão por bandeira / operadora / parcelas — tem que
    // ser exatamente isso (teste de 22/10/2026: "PAGARME / PAGARME DEBITO / 1
    // not found").
  ];
  // NSU/autorização = data do pagamento (NSU só aceita números no TOTVS)
  const ddmmaaaa = (d) => {
    const [a, m, dia] = String(d || '').slice(0, 10).split('-');
    return dia ? `${dia}${m}${a}` : '';
  };
  const nsuDaData = ddmmaaaa;
  const autorizacaoDaData = ddmmaaaa;
  // NSU real da transação Pagar.me, quando a Solicitação trouxe o ID gerado
  // (tag [nsu-pagarme:<id>] na observação). A baixa por cartão usa esse ID como
  // NSU/autorização, em vez da data (João, 04/11/2026). Vazio = usa a data.
  const nsuExternoDe = (s) => {
    const m = /\[nsu-pagarme:(\d+)\]/.exec(String(s?.observacao || ''));
    return m ? m[1].slice(0, 20) : '';
  };

  const FORMAS_PAGAMENTO_LABELS = {
    confianca: 'Confiança',
    sicredi: 'Sicredi',
    conta_corrente: 'Conta Corrente',
    adiantamento: 'Adiantamento (PIX)',
    cartao_credito: 'Cartão de Créd.',
    cartao_debito: 'Cartão Déb. (PAGARME)',
    credev: 'CREDEV',
    pix_pagarme: 'Pix Pagar.me',
  };

  // Carregar solicitações
  // Pagamento único por Pix (João, 27/10/2026): títulos pagos pelo MESMO Pix/cobrança
  // Pagar.me (mesma ref_externa base) são baixados numa chamada só no TOTVS — N faturas,
  // 1 pagamento com a soma. Pix separados = baixas separadas. Boleto é 1 título.
  const grupoDoPix = (sol) => {
    const ref = String(sol?.ref_externa || '');
    if (!ref || ref.startsWith('descartado:')) return '';
    const p = ref.split(':');
    if (p[0] === 'pagarme' && p[1] === 'pix' && p.length >= 4) return p.slice(0, 3).join(':'); // pagarme:pix:<pedido>:<fat-parc>
    if (p[0] === 'pagarme' && p[1] !== 'boleto' && p[1] !== 'pix' && p.length === 3) return p.slice(0, 2).join(':'); // BlueCard: pagarme:<cobrança>:<parcela>
    // Somatória manual (João, 17/11/2026): quando UM pagamento cobre vários títulos
    // (botão "localizar título" → somar), todas as linhas levam manual:grp:<id>:<fat-parc>
    // e baixam como UM pagamento só no TOTVS. Pagamentos separados têm grupos diferentes.
    if (p[0] === 'manual' && p[1] === 'grp' && p.length >= 4) return p.slice(0, 3).join(':'); // manual:grp:<id>:<fat-parc>
    return '';
  };

  const carregarSolicitacoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('solicitacoes_baixa')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      setNotification({
        type: 'error',
        message: 'Erro ao carregar solicitações.',
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSolicitacoes();
  }, []);

  // Lista de portadores únicos
  const portadoresUnicos = useMemo(() => {
    const map = {};
    solicitacoes.forEach((s) => {
      if (s.cd_portador || s.nm_portador) {
        const key = s.cd_portador || s.nm_portador;
        map[key] = s.nm_portador || `Portador ${s.cd_portador}`;
      }
    });
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]));
  }, [solicitacoes]);

  // Solicitações filtradas
  const solicitacoesFiltradas = useMemo(() => {
    let lista = solicitacoes;
    if (filtroStatus !== 'TODOS') {
      lista = lista.filter((s) => s.status === filtroStatus);
    }
    if (filtroPortador !== 'TODOS') {
      lista = lista.filter(
        (s) =>
          String(s.cd_portador) === filtroPortador ||
          s.nm_portador === filtroPortador,
      );
    }
    if (filtroOrigem) {
      const grupo = filtroOrigem === 'pix' ? ['bluecard_pagarme', 'pix_pagarme_tadeu'] : [filtroOrigem];
      lista = lista.filter((x) => grupo.includes(x.origem));
    }
    if (filtroForma !== 'TODAS') lista = lista.filter((x) => (x.forma_pagamento || 'sem_forma') === filtroForma);
    if (filtroDataDe) lista = lista.filter((x) => (x.dt_pagamento || '') >= filtroDataDe);
    if (filtroDataAte) lista = lista.filter((x) => (x.dt_pagamento || '') <= filtroDataAte);
    return lista;
  }, [solicitacoes, filtroStatus, filtroPortador, filtroOrigem, filtroForma, filtroDataDe, filtroDataAte]);

  // Totais por status
  const pendentesPorOrigem = useMemo(() => {
    const soma = (lista) => lista.reduce((a, x) => a + (parseFloat(x.vl_fatura) || 0), 0);
    const pend = solicitacoes.filter((x) => x.status === 'pendente');
    const pix = pend.filter((x) => x.origem === 'bluecard_pagarme' || x.origem === 'pix_pagarme_tadeu');
    const boleto = pend.filter((x) => x.origem === 'pagarme_boleto');
    return { pix: { n: pix.length, valor: soma(pix) }, boleto: { n: boleto.length, valor: soma(boleto) } };
  }, [solicitacoes]);

  const formasPresentes = useMemo(() => {
    const m = new Map();
    for (const x of solicitacoes) {
      const k = x.forma_pagamento || 'sem_forma';
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [solicitacoes]);
  const resumoLista = useMemo(
    () => ({
      n: solicitacoesFiltradas.length,
      valor: solicitacoesFiltradas.reduce((a, x) => a + (parseFloat(x.vl_fatura) || 0), 0),
    }),
    [solicitacoesFiltradas],
  );

  const totais = useMemo(() => {
    return {
      pendente: solicitacoes.filter((s) => s.status === 'pendente').length,
      aprovada: solicitacoes.filter((s) => s.status === 'aprovada').length,
      rejeitada: solicitacoes.filter((s) => s.status === 'rejeitada').length,
      processada: solicitacoes.filter((s) => s.status === 'processada').length,
      total: solicitacoes.length,
    };
  }, [solicitacoes]);

  // Valor total selecionado
  const valorTotalSelecionado = useMemo(() => {
    return solicitacoesFiltradas
      .filter((s) => selectedItems.has(s.id))
      .reduce((acc, s) => acc + (parseFloat(s.vl_fatura) || 0), 0);
  }, [solicitacoesFiltradas, selectedItems]);

  // Selecionar/desselecionar item
  // Baixa bloqueada (João, 30/10/2026): boleto Pagar.me pago mas ainda não
  // creditado — fica na lista, mas não pode baixar até o dinheiro cair na conta.
  const hojeISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const baixaBloqueada = (s) =>
    s.status === 'pendente' && s.bloqueado && (!s.liberar_em || String(s.liberar_em).slice(0, 10) > hojeISO);

  const toggleItem = (id) => {
    const sol = solicitacoes.find((s) => s.id === id);
    if (sol && baixaBloqueada(sol)) return; // bloqueada: não seleciona
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Selecionar todos filtrados (pula os bloqueados)
  const toggleSelectAll = () => {
    const ids = solicitacoesFiltradas.filter((s) => !baixaBloqueada(s)).map((s) => s.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedItems.has(id));
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(ids));
    }
  };

  // Aprovar solicitação
  const aprovarSolicitacao = async (id) => {
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_baixa')
        .update({ status: 'aprovada' })
        .eq('id', id);

      if (error) throw error;
      await carregarSolicitacoes();
      setNotification({ type: 'success', message: 'Solicitação aprovada!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      setNotification({
        type: 'error',
        message: 'Erro ao aprovar solicitação.',
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Rejeitar solicitação
  const rejeitarSolicitacao = async () => {
    if (!modalRejeicao) return;
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_baixa')
        .update({
          status: 'rejeitada',
          motivo_rejeicao: motivoRejeicao || 'Sem motivo informado',
        })
        .eq('id', modalRejeicao.id);

      if (error) throw error;
      setModalRejeicao(null);
      setMotivoRejeicao('');
      await carregarSolicitacoes();
      setNotification({ type: 'success', message: 'Solicitação rejeitada.' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      setNotification({
        type: 'error',
        message: 'Erro ao rejeitar solicitação.',
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Reprocessar solicitação individual (volta status para aprovada)
  const reprocessarSolicitacao = async (sol) => {
    if (
      !window.confirm(
        `Reprocessar fatura ${sol.nr_fat} do cliente ${sol.nm_cliente || sol.cd_cliente}?\n\nA solicitação voltará ao status "Aprovada" para ser processada novamente.`,
      )
    )
      return;
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_baixa')
        .update({
          status: 'aprovada',
          processado_por: null,
          processado_em: null,
          forma_pagamento: null,
        })
        .eq('id', sol.id);

      if (error) throw error;
      await carregarSolicitacoes();
      setNotification({
        type: 'success',
        message: `Fatura ${sol.nr_fat} disponível para reprocessamento!`,
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Erro ao reprocessar:', error);
      setNotification({
        type: 'error',
        message: 'Erro ao reprocessar solicitação.',
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // ── Localizar/escolher título manualmente (João, 16/11/2026) ──
  // Para solicitações que não casaram no match automático (fatura 0 / "a conferir"):
  // escolher o título certo no TOTVS, ajustar o cliente e somar vários títulos.
  const tituloKey = (t) => `${t.branchCode}-${t.receivableCode}-${t.installmentCode}`;

  const abrirLocalizar = (sol) => {
    setModalLocalizar(sol);
    setLocCod(sol.cd_cliente ? String(sol.cd_cliente) : '');
    setLocNome('');
    setLocPessoas([]);
    setLocTitulos([]);
    setLocSel({});
    setLocValor({});
    if (sol.cd_cliente) carregarTitulosCliente(String(sol.cd_cliente));
  };

  const carregarTitulosCliente = async (cod) => {
    const code = parseInt(String(cod).replace(/\D/g, ''), 10);
    if (!code) {
      setNotification({ type: 'error', message: 'Informe o código do cliente (TOTVS).' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    setLocLoading(true);
    try {
      // Pagina TODAS as páginas: cliente grande (ex.: SANTOS E LEMOS 1178) tem
      // centenas de títulos e os ABERTOS podem estar numa página posterior — pegar
      // só a página 1 trazia os mais antigos (já baixados) e dava "nenhum título".
      const items = [];
      for (let page = 1; page <= 20; page++) {
        const resp = await fetch(`${TotvsURL}accounts-receivable/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filter: { customerCodeList: [code], statusList: [1] },
            page,
            pageSize: 100,
            order: '-issueDate',
            expand: 'invoice,calculateValue',
          }),
        });
        const j = await resp.json();
        const lote = j.data?.items || j.items || [];
        items.push(...lote);
        const totalPages = j.data?.totalPages || j.data?.pages || 1;
        if (lote.length === 0 || page >= totalPages) break;
      }
      // Títulos com SALDO EM ABERTO (installmentValue - paidValue > 0). Inclui os
      // parcialmente pagos (TOTVS mantém o saldo aberto) — não só os intocados.
      const abertos = items
        .map((t) => {
          const valor = Number(t.installmentValue || 0);
          const pago = Number(t.paidValue || 0);
          return {
            branchCode: t.branchCode,
            receivableCode: Number(t.receivableCode),
            installmentCode: Number(t.installmentCode ?? 1),
            customerCode: t.customerCode,
            customerName: t.customerName,
            installmentValue: valor,
            paidValue: pago,
            saldoAberto: Math.max(0, Math.round((valor - pago) * 100) / 100),
            settlementDate: t.settlementDate || null,
            // valor corrigido pelo TOTVS (com juros/multa por atraso) — o invoices-payment
            // espera esse valor na baixa cheia de um título vencido, não o nominal.
            calc: t.calculatedValues || null,
            expiredDate: (t.expiredDate || '').slice(0, 10),
            issueDate: (t.issueDate || '').slice(0, 10),
            bearerCode: t.bearerCode ?? null,
            bearerName: t.bearerName ?? null,
          };
        })
        .filter((t) => !t.settlementDate && t.saldoAberto > 0.01)
        .sort((a, b) => String(a.expiredDate).localeCompare(String(b.expiredDate)));
      setLocTitulos(abertos);
      setLocSel({});
      setLocValor({});
      if (!abertos.length) {
        setNotification({ type: 'error', message: `Cliente ${code} não tem título em aberto no TOTVS.` });
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (e) {
      console.error('Erro ao buscar títulos do cliente:', e);
      setNotification({ type: 'error', message: 'Erro ao buscar títulos do cliente no TOTVS.' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setLocLoading(false);
    }
  };

  const buscarPessoaPorNome = async () => {
    const nome = locNome.trim();
    if (nome.length < 2) return;
    setLocBuscandoPessoa(true);
    try {
      const [rPf, rPj] = await Promise.all([
        fetch(`${TotvsURL}individual/search-by-name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nome }),
        })
          .then((r) => r.json())
          .catch(() => ({})),
        fetch(`${TotvsURL}legal-entity/search-by-name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fantasyName: nome }),
        })
          .then((r) => r.json())
          .catch(() => ({})),
      ]);
      const pf = (rPf.data?.items || rPf.items || []).map((p) => ({
        code: p.code ?? p.id,
        name: p.name || p.fantasyName || '',
        doc: p.cpf || p.cpfNumber || '',
      }));
      const pj = (rPj.data?.items || rPj.items || []).map((p) => ({
        code: p.code ?? p.id,
        name: p.fantasyName || p.name || p.companyName || '',
        doc: p.cnpj || p.cnpjNumber || '',
      }));
      const todos = [...pf, ...pj].filter((p) => p.code);
      setLocPessoas(todos.slice(0, 40));
      if (!todos.length) {
        setNotification({ type: 'error', message: 'Nenhum cliente com esse nome.' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (e) {
      console.error('Erro ao buscar pessoa:', e);
    } finally {
      setLocBuscandoPessoa(false);
    }
  };

  const escolherPessoa = (p) => {
    setLocCod(String(p.code));
    setLocPessoas([]);
    setLocNome('');
    carregarTitulosCliente(String(p.code));
  };

  const toggleTitulo = (t) => {
    const k = tituloKey(t);
    const estaSel = !!locSel[k];
    setLocSel((prev) => {
      const n = { ...prev };
      if (n[k]) delete n[k];
      else n[k] = t;
      return n;
    });
    setLocValor((prev) => {
      const n = { ...prev };
      if (estaSel) delete n[k];
      else n[k] = String((t.saldoAberto ?? t.installmentValue ?? 0).toFixed(2));
      return n;
    });
  };

  const setValorTitulo = (k, v) => setLocValor((prev) => ({ ...prev, [k]: v }));

  // valor (número) a baixar de um título: o digitado, senão o saldo em aberto
  const valorBaixar = (t) => {
    const raw = locValor[tituloKey(t)];
    const v = parseFloat(String(raw ?? t.saldoAberto ?? t.installmentValue).replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
  };

  const aplicarLocalizacao = async () => {
    const sol = modalLocalizar;
    if (!sol) return;
    const titulos = Object.values(locSel);
    if (!titulos.length) {
      setNotification({ type: 'error', message: 'Selecione pelo menos um título.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    const quem = user?.email || user?.nome || 'usuário';
    const hoje = new Date().toLocaleDateString('sv-SE');
    const codCli = parseInt(String(locCod).replace(/\D/g, ''), 10) || null;
    const obsBase = (sol.observacao || '').replace(/\s*\[titulo-manual[^\]]*\]/g, '');
    const notaParcial = (t) => {
      const v = valorBaixar(t);
      const saldo = t.saldoAberto || t.installmentValue || 0;
      return v + 0.01 < saldo ? ` · baixa PARCIAL R$ ${v.toFixed(2)} de R$ ${saldo.toFixed(2)}` : '';
    };
    const t0 = titulos[0];
    // Somatória de UM pagamento (João, 17/11/2026): quando mais de um título é
    // vinculado, todas as linhas levam uma ref de GRUPO comum pra baixar como UM
    // pagamento só no TOTVS (grupoDoPix). Mantém a base pagarme:pix:<pedido> quando
    // a solicitação já é de Pix (preserva a dedupe); senão usa manual:grp:<id>.
    const somando = titulos.length > 1;
    const refOrig = String(sol.ref_externa || '');
    const grupoBase = /^pagarme:pix:/.test(refOrig)
      ? refOrig.split(':').slice(0, 3).join(':')
      : `manual:grp:${sol.id}`;
    try {
      // 1º título fica na própria solicitação (vl_fatura = valor a baixar; parcial se menor que o saldo)
      const { error: e1 } = await supabaseAdmin
        .from('solicitacoes_baixa')
        .update({
          cd_empresa: t0.branchCode,
          cd_cliente: t0.customerCode ?? codCli,
          nm_cliente: t0.customerName || sol.nm_cliente,
          nr_fat: t0.receivableCode,
          nr_parcela: t0.installmentCode,
          vl_fatura: valorBaixar(t0),
          dt_vencimento: t0.expiredDate || null,
          dt_emissao: t0.issueDate || null,
          cd_portador: t0.bearerCode,
          nm_portador: t0.bearerName,
          observacao: `${obsBase} [titulo-manual por ${quem} em ${hoje}: ${tituloKey(t0)}${notaParcial(t0)}]`.trim(),
          // só agrupa quando há mais de um título (um pagamento, N faturas)
          ...(somando ? { ref_externa: `${grupoBase}:${tituloKey(t0)}` } : {}),
        })
        .eq('id', sol.id);
      if (e1) throw e1;

      // demais títulos (somar) viram novas solicitações do mesmo pagamento
      for (let i = 1; i < titulos.length; i++) {
        const t = titulos[i];
        const { error: e2 } = await supabaseAdmin.from('solicitacoes_baixa').insert({
          cd_empresa: t.branchCode,
          cd_cliente: t.customerCode ?? codCli,
          nm_cliente: t.customerName || sol.nm_cliente,
          nr_fat: t.receivableCode,
          nr_parcela: t.installmentCode,
          vl_fatura: valorBaixar(t),
          vl_juros: 0,
          dt_vencimento: t.expiredDate || null,
          dt_emissao: t.issueDate || null,
          cd_portador: t.bearerCode,
          nm_portador: t.bearerName,
          comprovante_url: sol.comprovante_url || '',
          comprovante_path: sol.comprovante_path || '',
          status: 'pendente',
          user_id: sol.user_id ?? null,
          user_nome: sol.user_nome,
          user_email: sol.user_email,
          observacao: `${obsBase} [titulo-manual por ${quem} em ${hoje}: ${tituloKey(t)}${notaParcial(t)} · somado ao pagamento da solicitação ${sol.id}]`.trim(),
          dt_pagamento: sol.dt_pagamento,
          forma_pagamento: sol.forma_pagamento,
          dados_cartao: sol.dados_cartao ?? null,
          origem: sol.origem,
          ref_externa: `${grupoBase}:${tituloKey(t)}`,
        });
        if (e2 && e2.code !== '23505') throw e2; // 23505 = já vinculado antes
      }

      setModalLocalizar(null);
      await carregarSolicitacoes();
      setNotification({
        type: 'success',
        message: `Título${titulos.length > 1 ? 's' : ''} vinculado${titulos.length > 1 ? 's' : ''} (${titulos.length}). Agora é só aprovar e processar a baixa.`,
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (e) {
      console.error('Erro ao aplicar localização:', e);
      setNotification({ type: 'error', message: `Erro ao vincular título: ${e.message}` });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Reprocessar em lote (volta status das processadas selecionadas para aprovada)
  const reprocessarLote = async () => {
    const selecionadas = solicitacoesFiltradas.filter(
      (s) => selectedItems.has(s.id) && s.status === 'processada',
    );
    if (selecionadas.length === 0) {
      setNotification({
        type: 'error',
        message: 'Nenhuma solicitação processada selecionada.',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (
      !window.confirm(
        `Reprocessar ${selecionadas.length} fatura(s)?\n\nElas voltarão ao status "Aprovada" para serem processadas novamente.`,
      )
    )
      return;

    setProcessingBaixa(true);
    let successCount = 0;

    try {
      for (const sol of selecionadas) {
        const { error } = await supabaseAdmin
          .from('solicitacoes_baixa')
          .update({
            status: 'aprovada',
            processado_por: null,
            processado_em: null,
            forma_pagamento: null,
          })
          .eq('id', sol.id);

        if (!error) successCount++;
      }

      await carregarSolicitacoes();
      setSelectedItems(new Set());
      setNotification({
        type: 'success',
        message: `${successCount} fatura(s) disponíveis para reprocessamento!`,
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      console.error('Erro ao reprocessar em lote:', error);
      setNotification({
        type: 'error',
        message: `Erro ao reprocessar: ${error.message}`,
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setProcessingBaixa(false);
    }
  };

  // Excluir solicitação
  const excluirSolicitacao = async (sol) => {
    if (!window.confirm(`Excluir solicitação da fatura ${sol.nr_fat}?`)) return;
    try {
      // Deletar arquivo do storage
      if (sol.comprovante_path) {
        await supabaseAdmin.storage
          .from('comprovantes_baixa')
          .remove([sol.comprovante_path]);
      }
      const { error } = await supabaseAdmin
        .from('solicitacoes_baixa')
        .delete()
        .eq('id', sol.id);
      if (error) throw error;
      await carregarSolicitacoes();
      setSelectedItems((prev) => {
        const next = new Set(prev);
        next.delete(sol.id);
        return next;
      });
      setNotification({ type: 'success', message: 'Solicitação excluída.' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setNotification({ type: 'error', message: 'Erro ao excluir.' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Processar baixa em lote via TOTVS
  const processarBaixaLote = async () => {
    const selecionadas = solicitacoesFiltradas.filter(
      (s) => selectedItems.has(s.id) && !baixaBloqueada(s),
    );
    if (selecionadas.length === 0) return;

    const pendentes = selecionadas.filter(
      (s) => s.status === 'pendente' || s.status === 'aprovada',
    );
    if (pendentes.length === 0) {
      setNotification({
        type: 'error',
        message: 'Nenhuma solicitação pendente/aprovada selecionada.',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    // Abrir modal de seleção de forma de pagamento
    setFormaPagamentoProcessamento('');
    setBancoSelecionado(null);
    setDadosCartaoProcessamento({ bandeira: '', autorizacao: '', nsu: '', operadora: '' });
    setDataPagamentoReal('');
    setModalPagamentoAberto(true);
  };

  // Confirmar processamento após selecionar forma de pagamento
  const confirmarProcessamento = async () => {
    if (!formaPagamentoProcessamento) {
      setNotification({
        type: 'error',
        message: 'Selecione a forma de pagamento.',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (
      formaPagamentoProcessamento === 'cartao_credito' &&
      (!dadosCartaoProcessamento.bandeira ||
        !dadosCartaoProcessamento.operadora ||
        !dadosCartaoProcessamento.autorizacao ||
        !dadosCartaoProcessamento.nsu)
    ) {
      setNotification({
        type: 'error',
        message: 'Preencha todos os dados do cartão (bandeira, operadora, autorização e NSU).',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }


    const selecionadas = solicitacoesFiltradas.filter(
      (s) => selectedItems.has(s.id) && !baixaBloqueada(s),
    );
    const pendentes = selecionadas.filter(
      (s) => s.status === 'pendente' || s.status === 'aprovada',
    );

    const formaSelecionada = FORMAS_PAGAMENTO.find(
      (f) => f.id === formaPagamentoProcessamento,
    );
    const formaLabel = formaSelecionada?.label || formaPagamentoProcessamento;
    setModalPagamentoAberto(false);

    const qtdPagamentos = new Set(pendentes.map((s) => grupoDoPix(s) || s.id)).size;
    if (
      !window.confirm(
        `Processar baixa de ${pendentes.length} fatura(s) no TOTVS?\n\nForma: ${formaLabel}\nValor total: ${valorTotalSelecionado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${qtdPagamentos !== pendentes.length ? `\nPagamentos no TOTVS: ${qtdPagamentos} (títulos do mesmo Pix em um pagamento só)` : ''}\n\nEssa ação não pode ser desfeita.`,
      )
    )
      return;

    setProcessingBaixa(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const items = pendentes.map((s) => {
        const dataUnica = pendentes.length > 1 ? '' : dataPagamentoReal; // lote = cada um na sua data
        const dataBaixa = dataUnica || s.dt_pagamento || new Date().toISOString().slice(0, 10);
        return {
          branchCode: s.cd_empresa,
          customerCode: s.cd_cliente,
          receivableCode: s.nr_fat,
          installmentCode: s.nr_parcela || 1,
          paidValue: parseFloat(s.vl_fatura) || 0,
          // João (26/10/2026): baixa com juros — o valor baixado tem que ser o recebido
          interestValue: parseFloat(s.vl_juros) || 0,
          nomeCliente: s.nm_cliente,
          solicitacaoId: s.id,
          // mesmo Pix → um pagamento só no TOTVS (ver grupoDoPix)
          grupo: grupoDoPix(s) || undefined,
          settlementDate: dataBaixa,
          ...(formaSelecionada?.cardAuto
            ? {
                card: {
                  // NSU = ID real da transação Pagar.me quando houver; senão a data.
                  nsu: nsuExternoDe(s) || nsuDaData(dataBaixa),
                  autorizacao: nsuExternoDe(s) || autorizacaoDaData(dataBaixa),
                  bandeira: formaSelecionada.bandeira,
                  operadora: formaSelecionada.operadora,
                  parcelas: 1,
                  portador: formaSelecionada.portador,
                },
              }
            : {}),
        };
      });

      const response = await fetch(`${TotvsURL}invoices-settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          // histórico de lotes (João, 26/10/2026)
          usuario: user?.email || user?.nome || null,
          origem: 'solicitacoes-baixa',
          formaLabel: formaSelecionada?.label || formaPagamentoProcessamento,
          paidType: formaSelecionada?.paidType || 4,
          // cartão PAGARME débito liquida na empresa 1 (onde o cartão está cadastrado)
          ...(formaSelecionada?.cardAuto ? { cardSettlementBranch: 1 } : {}),
          bank: formaSelecionada?.bank
            ? {
                bankNumber: formaSelecionada.bank.bankNumber,
                agencyNumber: formaSelecionada.bank.agencyNumber,
                account: formaSelecionada.bank.account,
              }
            : undefined,
          dadosCartao:
            formaPagamentoProcessamento === 'cartao_credito'
              ? dadosCartaoProcessamento
              : formaSelecionada?.cardAuto
                ? { bandeira: formaSelecionada.bandeira, operadora: formaSelecionada.operadora, parcelas: 1, portador: formaSelecionada.portador }
                : undefined,
        }),
      });

      const result = await response.json();

      // Atualizar status no Supabase baseado nos resultados
      if (result.results) {
        const jaProcessados = new Set();
        for (const r of result.results) {
          const sol = pendentes.find(
            (s) =>
              !jaProcessados.has(s.id) &&
              String(s.nr_fat) === String(r.receivableCode) &&
              String(s.cd_empresa) === String(r.branchCode) &&
              String(s.nr_parcela || 1) === String(r.installmentCode || 1),
          );
          if (sol) {
            jaProcessados.add(sol.id);
            await supabaseAdmin
              .from('solicitacoes_baixa')
              .update({
                status: 'processada',
                processado_por: user?.id || null,
                processado_em: new Date().toISOString(),
                forma_pagamento: formaPagamentoProcessamento || null,
              })
              .eq('id', sol.id);
            successCount++;
          }
        }
      }

      if (result.errors) {
        errorCount = result.errors.length;
      }

      await carregarSolicitacoes();
      setSelectedItems(new Set());

      if (errorCount === 0) {
        setNotification({
          type: 'success',
          message: `${successCount} baixa(s) processada(s) com sucesso!`,
        });
      } else {
        // Traduz o erro mais comum do TOTVS: valor mandado != valor esperado na baixa
        // (título tem juros/multa por atraso, ou saldo de uma baixa parcial anterior).
        const traduzTotvs = (m) => {
          const mm = /does not match the expected value of ([\d.]+)/i.exec(m || '');
          if (mm) {
            const v = parseFloat(mm[1]);
            const fmt = Number.isFinite(v)
              ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : `R$ ${mm[1]}`;
            return `o TOTVS espera ${fmt} neste título (juros/multa por atraso ou saldo de baixa parcial). Ajuste o "baixar R$" para esse valor — ou menos, para baixa parcial — pelo botão de lupa.`;
          }
          return m;
        };
        // Montar mensagem detalhada com erros traduzidos por fatura
        const detalhesErros = (result.errors || [])
          .map((err) => {
            const msgs =
              err.errorMessages && err.errorMessages.length > 0
                ? err.errorMessages.map(traduzTotvs).join('; ')
                : 'Erro desconhecido';
            return `Fatura ${err.receivableCode}: ${msgs}`;
          })
          .join('\n');

        setNotification({
          type: 'error',
          message: `${successCount} sucesso, ${errorCount} erro(s):\n${detalhesErros}`,
        });
      }
      setTimeout(() => setNotification(null), 8000);
    } catch (error) {
      console.error('Erro ao processar baixa em lote:', error);
      setNotification({ type: 'error', message: `Erro: ${error.message}` });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setProcessingBaixa(false);
    }
  };

  const formatarMoeda = (valor) =>
    parseFloat(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  const formatarData = (data) => {
    if (!data) return '--';
    // Evitar problema de timezone: parsear partes da string diretamente
    const str = String(data).split('T')[0]; // pegar só "YYYY-MM-DD"
    const [ano, mes, dia] = str.split('-');
    if (!ano || !mes || !dia) return '--';
    return `${dia}/${mes}/${ano}`;
  };

  const formatarDataHora = (data) => {
    if (!data) return '--';
    const d = new Date(data);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleString('pt-BR');
  };

  const statusConfig = {
    pendente: {
      label: 'Pendente',
      color: 'bg-yellow-100 text-yellow-800',
      icon: Clock,
    },
    aprovada: {
      label: 'Aprovada',
      color: 'bg-blue-100 text-blue-800',
      icon: CheckCircle,
    },
    rejeitada: {
      label: 'Rejeitada',
      color: 'bg-red-100 text-red-800',
      icon: XCircle,
    },
    processada: {
      label: 'Processada',
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle,
    },
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Solicitação de Baixa"
        subtitle="Gerencie solicitações de baixa de faturas"
        icon={Receipt}
        iconColor="text-indigo-600"
      />

      {/* Pendentes por origem — Pix (BlueCard) × boleto Pagar.me recebido (João, 23/10/2026) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {[
          { key: 'pix', label: 'Pix a baixar (BlueCard + Pix do Tadeu)', hint: 'Pix pagos no app BlueCard e Pix da Pagar.me pelos links/Gerador do Dryland — baixar como cartão débito PAGARME na data do pagamento', dados: pendentesPorOrigem.pix, cor: 'border-sky-300 bg-sky-50 text-sky-900', dot: 'bg-sky-500' },
          { key: 'pagarme_boleto', label: 'Boleto recebido a baixar (Pagar.me)', hint: 'Boletos pagos que já creditaram — baixar como cartão débito PAGARME na data do recebimento', dados: pendentesPorOrigem.boleto, cor: 'border-amber-300 bg-amber-50 text-amber-900', dot: 'bg-amber-500' },
        ].map((c) => (
          <button
            key={c.key}
            type="button"
            title={c.hint}
            onClick={() => {
              const ativo = filtroOrigem === c.key;
              setFiltroOrigem(ativo ? '' : c.key);
              setFiltroStatus('pendente');
              setSelectedItems(new Set());
            }}
            className={`text-left rounded-lg border p-3 transition-all ${c.cor} ${filtroOrigem === c.key ? 'ring-2 ring-[#000638]' : 'hover:shadow'}`}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className={`inline-block w-2 h-2 rounded-full ${c.dot}`} />
              {c.label}
              {filtroOrigem === c.key && <span className="ml-auto text-[10px] font-bold">filtrando · clique p/ limpar</span>}
            </div>
            <div className="text-lg font-bold">
              {c.dados.n}{' '}
              <span className="text-xs font-semibold opacity-80">{formatarMoeda(c.dados.valor)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          {
            label: 'Total',
            value: totais.total,
            color: 'bg-gray-100 text-gray-800',
          },
          {
            label: 'Pendentes',
            value: totais.pendente,
            color: 'bg-yellow-100 text-yellow-800',
            filter: 'pendente',
          },
          {
            label: 'Aprovadas',
            value: totais.aprovada,
            color: 'bg-blue-100 text-blue-800',
            filter: 'aprovada',
          },
          {
            label: 'Rejeitadas',
            value: totais.rejeitada,
            color: 'bg-red-100 text-red-800',
            filter: 'rejeitada',
          },
          {
            label: 'Processadas',
            value: totais.processada,
            color: 'bg-green-100 text-green-800',
            filter: 'processada',
          },
        ].map((card) => (
          <button
            key={card.label}
            onClick={() => setFiltroStatus(card.filter || 'TODOS')}
            className={`p-3 rounded-xl border shadow-sm text-center transition-all hover:shadow-md ${
              filtroStatus === (card.filter || 'TODOS')
                ? 'ring-2 ring-[#000638]'
                : ''
            }`}
          >
            <p className="text-xs font-medium text-gray-500">{card.label}</p>
            <p
              className={`text-2xl font-extrabold mt-1 ${card.color.split(' ')[1]}`}
            >
              {card.value}
            </p>
          </button>
        ))}
      </div>

      {/* Barra de ações */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por portador */}
          <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
            <Bank size={14} className="text-gray-500" />
            <select
              value={filtroPortador}
              onChange={(e) => setFiltroPortador(e.target.value)}
              className="text-xs border-none bg-transparent focus:ring-0 pr-6"
            >
              <option value="TODOS">Todos Portadores</option>
              {portadoresUnicos.map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {/* Filtro por forma de pagamento (João, 23/10/2026) */}
          <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
            <CreditCard size={14} className="text-gray-500" />
            <select
              value={filtroForma}
              onChange={(e) => setFiltroForma(e.target.value)}
              className="text-xs border-none bg-transparent focus:ring-0 pr-6"
              title="Filtrar pela forma de pagamento (ex.: só as baixas por Cartão de Débito PAGARME)"
            >
              <option value="TODAS">Todas as formas</option>
              {formasPresentes.map(([k, n]) => (
                <option key={k} value={k}>
                  {k === 'sem_forma' ? 'Sem forma' : FORMAS_PAGAMENTO_LABELS[k] || k} ({n})
                </option>
              ))}
            </select>
          </div>
          {/* Filtro por data de pagamento (João, 26/10/2026: baixar dia a dia) */}
          <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1" title="Data do pagamento/recebimento da solicitação (de / até)">
            <CalendarBlank size={14} className="text-gray-500" />
            <input
              type="date"
              value={filtroDataDe}
              onChange={(e) => {
                setFiltroDataDe(e.target.value);
                if (e.target.value && !filtroDataAte) setFiltroDataAte(e.target.value);
                setSelectedItems(new Set());
              }}
              className="text-xs border-none bg-transparent focus:ring-0 p-0"
            />
            <span className="text-[10px] text-gray-400">até</span>
            <input
              type="date"
              value={filtroDataAte}
              onChange={(e) => {
                setFiltroDataAte(e.target.value);
                setSelectedItems(new Set());
              }}
              className="text-xs border-none bg-transparent focus:ring-0 p-0"
            />
            {(filtroDataDe || filtroDataAte) && (
              <button
                type="button"
                onClick={() => {
                  setFiltroDataDe('');
                  setFiltroDataAte('');
                  setSelectedItems(new Set());
                }}
                className="text-[10px] font-bold text-red-600 ml-1"
                title="Limpar datas"
              >
                ×
              </button>
            )}
          </div>
          <span
            className="text-xs font-bold text-[#000638] bg-white border rounded-lg px-2 py-1"
            title="Quantidade e valor do que está na lista com os filtros atuais"
          >
            {resumoLista.n} na lista · {formatarMoeda(resumoLista.valor)}
            {filtroStatus === 'processada' && filtroForma !== 'TODAS' ? ' baixadas' : ''}
          </span>
          <button
            type="button"
            onClick={() => {
              setModalHistorico(true);
              setLoteAberto(null);
              carregarLotes();
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#000638] bg-white border rounded-lg hover:bg-gray-50 transition-colors"
            title="Histórico dos lotes processados: quantidade, valores, títulos e motivos de erro"
          >
            <ClockCounterClockwise size={14} weight="bold" />
            Histórico
          </button>
          <button
            onClick={carregarSolicitacoes}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#000638] bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowClockwise size={14} weight="bold" />
            Atualizar
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <span className="text-xs text-gray-500">
              {selectedItems.size} selecionada(s) —{' '}
              {formatarMoeda(valorTotalSelecionado)}
            </span>
          )}
          {selectedItems.size > 0 && filtroStatus !== 'processada' && (
            <button
              onClick={processarBaixaLote}
              disabled={processingBaixa}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#000638] hover:bg-[#fe0000] rounded-lg transition-colors disabled:opacity-50"
            >
              {processingBaixa ? (
                <>
                  <Spinner size={14} className="animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle size={14} weight="bold" />
                  Processar Baixa ({selectedItems.size})
                </>
              )}
            </button>
          )}
          {selectedItems.size > 0 && filtroStatus === 'processada' && (
            <button
              onClick={reprocessarLote}
              disabled={processingBaixa}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {processingBaixa ? (
                <>
                  <Spinner size={14} className="animate-spin" />
                  Reprocessando...
                </>
              ) : (
                <>
                  <ArrowClockwise size={14} weight="bold" />
                  Reprocessar ({selectedItems.size})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} className="animate-spin text-[#000638]" />
          <span className="ml-3 text-gray-500">Carregando solicitações...</span>
        </div>
      ) : solicitacoesFiltradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Receipt size={48} className="mx-auto mb-3" />
          <p className="font-medium">Nenhuma solicitação encontrada</p>
          <p className="text-sm mt-1">
            Altere os filtros ou envie solicitações pela tela de Inadimplentes.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-[#000638] text-white sticky top-0">
              <tr>
                <th className="px-3 py-2.5 text-center w-8">
                  <input
                    type="checkbox"
                    className="accent-white cursor-pointer"
                    checked={
                      solicitacoesFiltradas.length > 0 &&
                      solicitacoesFiltradas.every((s) =>
                        selectedItems.has(s.id),
                      )
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold">Cliente</th>
                <th className="px-3 py-2.5 text-left font-semibold">Fatura</th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Parcela
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Vencimento
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Dt. Pagamento
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Forma Pgto.
                </th>
                <th className="px-3 py-2.5 text-left font-semibold">
                  Portador
                </th>
                <th className="px-3 py-2.5 text-left font-semibold">
                  Solicitante
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">Data</th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Comprovante
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {solicitacoesFiltradas.map((sol) => {
                const config =
                  statusConfig[sol.status] || statusConfig.pendente;
                const StatusIcon = config.icon;
                const isSelected = selectedItems.has(sol.id);
                return (
                  <tr
                    key={sol.id}
                    className={`border-b hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="accent-[#000638] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        checked={isSelected}
                        disabled={baixaBloqueada(sol)}
                        onChange={() => toggleItem(sol.id)}
                        title={baixaBloqueada(sol) ? `Baixa bloqueada até ${String(sol.liberar_em).slice(0, 10).split('-').reverse().join('/')} (aguardando o crédito na conta)` : undefined}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.color}`}
                      >
                        <StatusIcon size={12} weight="bold" />
                        {config.label}
                      </span>
                      {baixaBloqueada(sol) && (
                        <span
                          className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300"
                          title="Boleto pago, mas o dinheiro ainda não caiu na conta. Libera para baixa na data do crédito."
                        >
                          🔒 libera {String(sol.liberar_em).slice(0, 10).split('-').reverse().slice(0, 2).join('/')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium">
                        {sol.nm_cliente || '--'}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Cód: {sol.cd_cliente}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-semibold">{sol.nr_fat}</td>
                    <td className="px-3 py-2 text-center">{sol.nr_parcela}</td>
                    <td className="px-3 py-2 text-right font-bold text-red-600">
                      {formatarMoeda(sol.vl_fatura)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatarData(sol.dt_vencimento)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {editandoData === sol.id ? (
                        <input
                          type="date"
                          autoFocus
                          defaultValue={
                            sol.dt_pagamento
                              ? sol.dt_pagamento.split('T')[0]
                              : ''
                          }
                          max={new Date().toISOString().split('T')[0]}
                          className="border border-[#000638] rounded px-1.5 py-0.5 text-xs w-[120px] focus:ring-2 focus:ring-[#000638] focus:outline-none"
                          onBlur={async (e) => {
                            const novaData = e.target.value;
                            setEditandoData(null);
                            if (
                              novaData ===
                              (sol.dt_pagamento
                                ? sol.dt_pagamento.split('T')[0]
                                : '')
                            )
                              return;
                            try {
                              const { error } = await supabaseAdmin
                                .from('solicitacoes_baixa')
                                .update({ dt_pagamento: novaData || null })
                                .eq('id', sol.id);
                              if (error) throw error;
                              setSolicitacoes((prev) =>
                                prev.map((s) =>
                                  s.id === sol.id
                                    ? { ...s, dt_pagamento: novaData || null }
                                    : s,
                                ),
                              );
                              setNotification({
                                type: 'success',
                                message: `Data de pagamento ${novaData ? 'atualizada' : 'removida'}!`,
                              });
                              setTimeout(() => setNotification(null), 2000);
                            } catch (err) {
                              console.error('Erro ao atualizar data:', err);
                              setNotification({
                                type: 'error',
                                message: 'Erro ao salvar data.',
                              });
                              setTimeout(() => setNotification(null), 3000);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                            if (e.key === 'Escape') setEditandoData(null);
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setEditandoData(sol.id)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                            sol.dt_pagamento
                              ? 'text-green-700 hover:bg-green-50'
                              : 'text-orange-500 bg-orange-50 hover:bg-orange-100'
                          }`}
                          title="Clique para editar a data de pagamento"
                        >
                          {sol.dt_pagamento ? (
                            <>
                              <CalendarBlank size={12} />
                              {formatarData(sol.dt_pagamento)}
                              <PencilSimple size={10} className="opacity-50" />
                            </>
                          ) : (
                            <>
                              <CalendarBlank size={12} />
                              Definir
                            </>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {editandoFormaPgto === sol.id ? (
                        <select
                          autoFocus
                          defaultValue={sol.forma_pagamento || ''}
                          className="border border-[#000638] rounded px-1 py-0.5 text-[10px] font-bold w-[110px] focus:ring-2 focus:ring-[#000638] focus:outline-none"
                          onBlur={async (e) => {
                            const novaForma = e.target.value;
                            setEditandoFormaPgto(null);
                            if (novaForma === (sol.forma_pagamento || ''))
                              return;
                            try {
                              const { error } = await supabaseAdmin
                                .from('solicitacoes_baixa')
                                .update({ forma_pagamento: novaForma || null })
                                .eq('id', sol.id);
                              if (error) throw error;
                              setSolicitacoes((prev) =>
                                prev.map((s) =>
                                  s.id === sol.id
                                    ? {
                                        ...s,
                                        forma_pagamento: novaForma || null,
                                      }
                                    : s,
                                ),
                              );
                              setNotification({
                                type: 'success',
                                message: `Forma de pagamento ${novaForma ? 'atualizada' : 'removida'}!`,
                              });
                              setTimeout(() => setNotification(null), 2000);
                            } catch (err) {
                              console.error(
                                'Erro ao atualizar forma pgto:',
                                err,
                              );
                              setNotification({
                                type: 'error',
                                message: 'Erro ao salvar forma de pagamento.',
                              });
                              setTimeout(() => setNotification(null), 3000);
                            }
                          }}
                          onChange={(e) => {
                            e.target.blur();
                          }}
                        >
                          <option value="">Selecione...</option>
                          {Object.entries(FORMAS_PAGAMENTO_LABELS).map(
                            ([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      ) : sol.forma_pagamento ? (
                        <button
                          onClick={() =>
                            sol.status === 'processada'
                              ? setEditandoFormaPgto(sol.id)
                              : null
                          }
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            sol.forma_pagamento === 'confianca'
                              ? 'bg-blue-100 text-blue-800'
                              : sol.forma_pagamento === 'sicredi'
                                ? 'bg-green-100 text-green-800'
                                : sol.forma_pagamento === 'conta_corrente'
                                  ? 'bg-blue-100 text-blue-800'
                                  : sol.forma_pagamento === 'adiantamento'
                                    ? 'bg-purple-100 text-purple-800'
                                    : sol.forma_pagamento === 'cartao_credito'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : sol.forma_pagamento === 'cartao_debito'
                                        ? 'bg-orange-100 text-orange-800'
                                        : sol.forma_pagamento === 'credev'
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : sol.forma_pagamento === 'pix_pagarme'
                                            ? 'bg-sky-100 text-sky-800'
                                            : 'bg-gray-100 text-gray-800'
                          } ${sol.status === 'processada' ? 'cursor-pointer hover:opacity-80' : ''}`}
                          title={
                            sol.status === 'processada'
                              ? 'Clique para alterar'
                              : ''
                          }
                        >
                          {FORMAS_PAGAMENTO_LABELS[sol.forma_pagamento] ||
                            sol.forma_pagamento}
                          {sol.status === 'processada' && (
                            <PencilSimple size={9} className="opacity-50" />
                          )}
                        </button>
                      ) : sol.status === 'processada' ? (
                        <button
                          onClick={() => setEditandoFormaPgto(sol.id)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-orange-500 bg-orange-50 hover:bg-orange-100 cursor-pointer transition-colors"
                          title="Definir forma de pagamento"
                        >
                          <PencilSimple size={10} />
                          Definir
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium text-[10px]">
                        {sol.nm_portador || sol.cd_portador || '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium flex items-center gap-1">
                        {sol.origem === 'bluecard_pagarme' && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-sky-500 flex-shrink-0"
                            title="Aberta automaticamente: Pix Pagar.me pago no app BlueCard"
                          />
                        )}
                        {sol.origem === 'dryland_link' && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
                            title="Pedido pelo link de baixa do Dryland (vendedor mandou o comprovante)"
                          />
                        )}
                        {sol.origem === 'pagarme_boleto' && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"
                            title="Aberta automaticamente: boleto Pagar.me pago (retorno)"
                          />
                        )}
                        {sol.origem === 'pix_pagarme_tadeu' && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0"
                            title="Pix recebido na Pagar.me pelos links/Gerador do Dryland (Pix do Tadeu)"
                          />
                        )}
                        {sol.user_nome || '--'}
                        {Number(sol.nr_fat) >= 9000000000 && (
                          <span
                            className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800"
                            title="Fatura do HeadCoach (não existe no TOTVS): ao processar, a baixa é feita no Contas a Receber do HeadCoach"
                          >
                            HeadCoach
                          </span>
                        )}
                        {Number(sol.nr_fat) === 0 && (
                          <span
                            className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800"
                            title="Título não localizado no TOTVS — conferir pela observação/comprovante e tratar manualmente"
                          >
                            a conferir
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {sol.origem === 'bluecard_pagarme'
                          ? 'automático · app BlueCard'
                          : sol.origem === 'dryland_link'
                            ? 'automático · link Dryland'
                            : sol.origem === 'pagarme_boleto'
                              ? 'automático · boleto Pagar.me'
                              : sol.origem === 'pix_pagarme_tadeu'
                                ? (() => {
                                    const m = /—\s*R\$\s*([\d.]+)/.exec(sol.observacao || '');
                                    const rec = m
                                      ? ` · Pix recebido R$ ${Number(m[1]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : '';
                                    return `automático · Pix do Tadeu (Pagar.me)${rec}`;
                                  })()
                                : sol.user_email}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-[10px]">
                      {formatarDataHora(sol.created_at)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {sol.comprovante_url && (
                        <button
                          onClick={() => setModalComprovante(sol)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                        >
                          <Eye size={12} />
                          Ver
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {sol.status === 'pendente' && (
                          <>
                            <button
                              onClick={() => aprovarSolicitacao(sol.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Aprovar"
                            >
                              <CheckCircle size={16} weight="bold" />
                            </button>
                            <button
                              onClick={() => {
                                setModalRejeicao(sol);
                                setMotivoRejeicao('');
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Rejeitar"
                            >
                              <XCircle size={16} weight="bold" />
                            </button>
                          </>
                        )}
                        {sol.status === 'processada' && (
                          <button
                            onClick={() => reprocessarSolicitacao(sol)}
                            className="p-1 text-orange-500 hover:bg-orange-50 rounded transition-colors"
                            title="Reprocessar"
                          >
                            <ArrowClockwise size={16} weight="bold" />
                          </button>
                        )}
                        {(sol.status === 'pendente' || sol.status === 'aprovada') && (
                          <button
                            onClick={() => abrirLocalizar(sol)}
                            className={`p-1 rounded transition-colors ${
                              Number(sol.nr_fat) === 0
                                ? 'text-sky-700 bg-sky-50 hover:bg-sky-100'
                                : 'text-sky-600 hover:bg-sky-50'
                            }`}
                            title="Localizar/escolher título no TOTVS (ajustar pessoa, somar títulos)"
                          >
                            <MagnifyingGlassPlus size={15} weight="bold" />
                          </button>
                        )}
                        <button
                          onClick={() => excluirSolicitacao(sol)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Observação se houver */}
      {solicitacoesFiltradas.some((s) => s.observacao) && (
        <div className="mt-3 text-xs text-gray-400">
          * Algumas solicitações possuem observações. Clique no comprovante para
          ver detalhes.
        </div>
      )}

      {/* Modal Histórico de lotes */}
      {modalHistorico && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-lg font-bold">Histórico de lotes processados</h3>
              <button onClick={() => setModalHistorico(false)} className="text-white hover:text-red-300">
                <X size={22} weight="bold" />
              </button>
            </div>
            <div className="p-4 space-y-2 text-sm">
              {carregandoLotes && <p className="text-gray-500">Carregando…</p>}
              {!carregandoLotes && lotes.length === 0 && <p className="text-gray-500">Nenhum lote nos últimos 60 dias.</p>}
              {lotes.map((l) => {
                const aberto = loteAberto === l.id;
                const em = new Date(l.em);
                return (
                  <div key={l.id} className={`rounded-lg border ${l.falhas > 0 ? 'border-red-200' : 'border-gray-200'}`}>
                    <button
                      type="button"
                      onClick={() => setLoteAberto(aberto ? null : l.id)}
                      className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <span className="font-bold text-[#000638]">
                        {em.toLocaleDateString('pt-BR')} {em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-gray-600">{l.forma || '—'}</span>
                      <span className="text-gray-500 text-xs">{l.usuario || ''}</span>
                      <span className="ml-auto text-xs">
                        <b>{l.qtd}</b> título(s) · <span className="text-green-700 font-semibold">{l.sucesso} ok</span>
                        {l.falhas > 0 && <span className="text-red-600 font-semibold"> · {l.falhas} erro(s)</span>}
                        {' · '}
                        {formatarMoeda(Number(l.valor_ok || 0))}
                        {Number(l.valor_falha || 0) > 0 && <span className="text-red-600"> (+{formatarMoeda(Number(l.valor_falha))} com erro)</span>}
                      </span>
                    </button>
                    {aberto && (
                      <div className="border-t border-gray-100 overflow-x-auto">
                        <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-100">
                          <button
                            type="button"
                            onClick={() => copiarTitulosLote(l)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${loteCopiado === l.id ? 'bg-green-100 border-green-400 text-green-800' : 'bg-white hover:bg-gray-100 border-gray-300 text-[#000638]'}`}
                            title="Copia os números dos títulos deste lote (empresa-fatura-parcela, um por linha) para colar no Retorno Boleto e baixar na Pagar.me"
                          >
                            {loteCopiado === l.id ? 'Copiado!' : `Copiar títulos p/ Retorno Boleto (${(l.itens || []).length})`}
                          </button>
                        </div>
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="px-2 py-1 text-left">Título</th>
                              <th className="px-2 py-1 text-left">Cliente</th>
                              <th className="px-2 py-1 text-right">Valor</th>
                              <th className="px-2 py-1 text-right">Juros</th>
                              <th className="px-2 py-1 text-center">Data</th>
                              <th className="px-2 py-1 text-center">Resultado</th>
                              <th className="px-2 py-1 text-left">Motivo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(l.itens || []).map((it, i) => (
                              <tr key={i} className={it.ok ? '' : 'bg-red-50'}>
                                <td className="px-2 py-1 font-mono">{it.titulo}</td>
                                <td className="px-2 py-1">{it.nm_cliente || it.cd_cliente || '—'}</td>
                                <td className="px-2 py-1 text-right">{formatarMoeda(Number(it.valor || 0))}</td>
                                <td className="px-2 py-1 text-right">{Number(it.juros || 0) > 0 ? formatarMoeda(Number(it.juros)) : '—'}</td>
                                <td className="px-2 py-1 text-center">{it.data ? it.data.split('-').reverse().join('/') : '—'}</td>
                                <td className="px-2 py-1 text-center">
                                  {it.ok ? <span className="text-green-700 font-bold">OK</span> : <span className="text-red-600 font-bold">ERRO</span>}
                                </td>
                                <td className="px-2 py-1 text-red-700">{it.motivo || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Comprovante */}
      {modalComprovante && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-lg font-bold">
                Comprovante - Fatura {modalComprovante.nr_fat}
              </h3>
              <button
                onClick={() => setModalComprovante(null)}
                className="text-white hover:text-red-300"
              >
                <X size={22} weight="bold" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Cliente:</span>{' '}
                  <span className="font-semibold">
                    {modalComprovante.nm_cliente}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Fatura:</span>{' '}
                  <span className="font-semibold">
                    {modalComprovante.nr_fat}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Valor:</span>{' '}
                  <span className="font-bold text-red-600">
                    {formatarMoeda(modalComprovante.vl_fatura)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Portador:</span>{' '}
                  <span className="font-semibold">
                    {modalComprovante.nm_portador ||
                      modalComprovante.cd_portador ||
                      '--'}
                  </span>
                </div>
                {modalComprovante.observacao && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Observação:</span>{' '}
                    <span className="font-medium">
                      {modalComprovante.observacao}
                    </span>
                  </div>
                )}
                {modalComprovante.motivo_rejeicao && (
                  <div className="col-span-2">
                    <span className="text-red-500 font-bold">
                      Motivo rejeição:
                    </span>{' '}
                    <span className="font-medium text-red-700">
                      {modalComprovante.motivo_rejeicao}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                {modalComprovante.comprovante_url?.match(
                  /\.(jpg|jpeg|png|gif|webp)/i,
                ) ? (
                  <div className="space-y-3 w-full">
                    <div
                      className="relative cursor-pointer"
                      onClick={() => {
                        setZoomImagem(true);
                        setZoomLevel(1);
                      }}
                    >
                      <img
                        src={modalComprovante.comprovante_url}
                        alt="Comprovante"
                        className="max-w-full max-h-[55vh] rounded-lg shadow-lg mx-auto hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                        <MagnifyingGlassPlus size={14} />
                        Clique para ampliar
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <a
                        href={modalComprovante.comprovante_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#000638] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <ArrowsOut size={14} />
                        Abrir em nova aba
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText
                      size={48}
                      className="mx-auto text-gray-400 mb-3"
                    />
                    <a
                      href={modalComprovante.comprovante_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#000638] rounded-lg hover:bg-[#fe0000] transition-colors"
                    >
                      <Eye size={16} />
                      Abrir Comprovante (PDF)
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de Zoom da Imagem */}
      {zoomImagem && modalComprovante && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-[60]"
          onClick={() => setZoomImagem(false)}
        >
          {/* Controles de zoom */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-[61]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              className="bg-white bg-opacity-20 hover:bg-opacity-40 text-white p-2 rounded-lg transition-colors"
              title="Diminuir zoom"
            >
              <MagnifyingGlassMinus size={22} />
            </button>
            <span className="text-white text-sm font-bold min-w-[50px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(4, z + 0.25))}
              className="bg-white bg-opacity-20 hover:bg-opacity-40 text-white p-2 rounded-lg transition-colors"
              title="Aumentar zoom"
            >
              <MagnifyingGlassPlus size={22} />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="bg-white bg-opacity-20 hover:bg-opacity-40 text-white px-3 py-2 rounded-lg transition-colors text-sm font-bold"
              title="Resetar zoom"
            >
              100%
            </button>
            <button
              onClick={() => setZoomImagem(false)}
              className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors ml-2"
              title="Fechar"
            >
              <X size={22} weight="bold" />
            </button>
          </div>

          {/* Imagem com zoom */}
          <div
            className="overflow-auto max-w-full max-h-full p-4 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100vw', maxHeight: '100vh' }}
          >
            <img
              src={modalComprovante.comprovante_url}
              alt="Comprovante ampliado"
              className="transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                maxWidth: zoomLevel <= 1 ? '90vw' : 'none',
                maxHeight: zoomLevel <= 1 ? '85vh' : 'none',
              }}
              draggable={false}
            />
          </div>

          {/* Dica inferior */}
          <div className="absolute bottom-4 text-white text-xs bg-black bg-opacity-50 px-3 py-1.5 rounded-lg">
            Clique fora da imagem para fechar • Use os botões para ajustar o
            zoom
          </div>
        </div>
      )}

      {/* Modal de Seleção de Forma de Pagamento */}
      {modalPagamentoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Bank size={20} weight="bold" />
                Forma de Pagamento
              </h3>
              <button
                onClick={() => {
                  setModalPagamentoAberto(false);
                  setFormaPagamentoProcessamento('');
                  setBancoSelecionado(null);
                  setDadosCartaoProcessamento({
                    bandeira: '',
                    autorizacao: '',
                    nsu: '',
                  });
                }}
                className="text-white hover:text-red-300"
              >
                <X size={22} weight="bold" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Selecione a forma de pagamento para processar a baixa no TOTVS:
              </p>

              {/* Seleção da forma de pagamento */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Forma de Pagamento *
                </label>
                <select
                  value={formaPagamentoProcessamento}
                  onChange={(e) => {
                    setFormaPagamentoProcessamento(e.target.value);
                    // Pagar.me débito: já abre com o cartão cadastrado no TOTVS (editável)
                    if (e.target.value === 'cartao_debito') {
                      setDadosCartaoProcessamento((prev) => ({
                        ...prev,
                        bandeira: '',
                        operadora: 'PAGARME',
                      }));
                    }
                    setBancoSelecionado(null);
                    setDadosCartaoProcessamento({
                      bandeira: '',
                      autorizacao: '',
                      nsu: '',
                    });
                  }}
                  className="w-full border-2 rounded-lg px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#000638] focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  {FORMAS_PAGAMENTO.filter((f) => !f.oculta).map((fp) => (
                    <option key={fp.id} value={fp.id}>
                      {fp.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Confiança / Sicredi info */}
              {(formaPagamentoProcessamento === 'confianca' ||
                formaPagamentoProcessamento === 'sicredi') && (
                <div
                  className={`${formaPagamentoProcessamento === 'confianca' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-lg p-4`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Bank
                      size={18}
                      weight="bold"
                      className={
                        formaPagamentoProcessamento === 'confianca'
                          ? 'text-blue-700'
                          : 'text-green-700'
                      }
                    />
                    <p
                      className={`text-sm font-bold ${formaPagamentoProcessamento === 'confianca' ? 'text-blue-800' : 'text-green-800'}`}
                    >
                      {
                        FORMAS_PAGAMENTO.find(
                          (f) => f.id === formaPagamentoProcessamento,
                        )?.label
                      }
                    </p>
                  </div>
                  <div className="text-xs space-y-0.5 text-gray-600">
                    <p>
                      Banco:{' '}
                      <strong>
                        {
                          FORMAS_PAGAMENTO.find(
                            (f) => f.id === formaPagamentoProcessamento,
                          )?.bank?.bankNumber
                        }
                      </strong>
                    </p>
                    <p>
                      Agência:{' '}
                      <strong>
                        {
                          FORMAS_PAGAMENTO.find(
                            (f) => f.id === formaPagamentoProcessamento,
                          )?.bank?.agencyNumber
                        }
                      </strong>
                    </p>
                    <p>
                      Conta:{' '}
                      <strong>
                        {
                          FORMAS_PAGAMENTO.find(
                            (f) => f.id === formaPagamentoProcessamento,
                          )?.bank?.account
                        }
                      </strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Adiantamento → PIX TOTVS */}
              {formaPagamentoProcessamento === 'adiantamento' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <p className="text-sm font-bold text-purple-800">PIX TOTVS</p>
                  <p className="text-xs text-purple-600 mt-1">
                    O pagamento será registrado como adiantamento via PIX no
                    TOTVS.
                  </p>
                </div>
              )}

              {/* Cartão → Dados do cartão */}
              {formaPagamentoProcessamento === 'cartao_credito' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-bold text-yellow-800">
                    Dados do{' '}
                    {formaPagamentoProcessamento === 'cartao_credito'
                      ? 'Cartão de Crédito'
                      : 'Cartão de Débito'}
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                      Bandeira *
                    </label>
                    <input
                      type="text"
                      value={dadosCartaoProcessamento.bandeira}
                      onChange={(e) =>
                        setDadosCartaoProcessamento((prev) => ({
                          ...prev,
                          bandeira: e.target.value,
                        }))
                      }
                      placeholder="Ex: Visa, Mastercard, Elo..."
                      className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                      Operadora *
                    </label>
                    <input
                      type="text"
                      value={dadosCartaoProcessamento.operadora || ''}
                      onChange={(e) =>
                        setDadosCartaoProcessamento((prev) => ({
                          ...prev,
                          operadora: e.target.value,
                        }))
                      }
                      placeholder="Ex: PAGARME DEBITO, REDE, STONE..."
                      className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                        Nº Autorização *
                      </label>
                      <input
                        type="text"
                        value={dadosCartaoProcessamento.autorizacao}
                        onChange={(e) =>
                          setDadosCartaoProcessamento((prev) => ({
                            ...prev,
                            autorizacao: e.target.value,
                          }))
                        }
                        placeholder="Nº autorização"
                        className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                        NSU *
                      </label>
                      <input
                        type="text"
                        value={dadosCartaoProcessamento.nsu}
                        onChange={(e) =>
                          setDadosCartaoProcessamento((prev) => ({
                            ...prev,
                            nsu: e.target.value,
                          }))
                        }
                        placeholder="NSU"
                        className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pagar.me → Cartão Débito (PAGARME DEBITO) */}
              {formaPagamentoProcessamento === 'cartao_debito' && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-violet-800">Cartão de Débito · PAGARME DEBITO</p>
                    <span className="text-[11px] font-bold rounded px-2 py-0.5 bg-violet-700 text-white">só a data · resto automático</span>
                  </div>
                  <p className="text-xs text-violet-700">
                    Cada título marcado vai pro TOTVS como <b>cartão de débito</b> (operadora PAGARME, sem bandeira, cartão "PAGARME DEBITO" do cadastro), na <b>data real</b> abaixo. <b>NSU</b> e{' '}
                    <b>autorização</b> são sempre essa data (ex.: 21102026 e 21102026).
                  </p>
                  <div>
                    {(() => {
                      const qtd = solicitacoesFiltradas.filter((x) => selectedItems.has(x.id) && x.status === 'pendente').length;
                      const lote = qtd > 1;
                      return (
                        <>
                          <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                            {lote
                              ? `Baixa em massa (${qtd} títulos): cada um na sua data de recebimento/pagamento — data única desabilitada`
                              : 'Data única (opcional) — vazio = data do pagamento/recebimento da solicitação'}
                          </label>
                          <input
                            type="date"
                            value={lote ? '' : dataPagamentoReal}
                            disabled={lote}
                            onChange={(e) => setDataPagamentoReal(e.target.value)}
                            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                          />
                        </>
                      );
                    })()}
                  </div>
                  <p className="text-[11px] text-violet-700">
                    Operadora e bandeira são lidas do <b>cadastro do cartão do portador 9901</b> no TOTVS na hora da baixa (1 parcela) ·
                    NSU e autorização = data real (ddmmaaaa) · liquidação na empresa 1.
                  </p>
                </div>
              )}
              {/* Pagamento real (data da baixa) — demais formas */}
              {formaPagamentoProcessamento !== 'cartao_debito' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                    Pagamento real (data da baixa no TOTVS)
                  </label>
                  <input
                    type="date"
                    value={dataPagamentoReal}
                    onChange={(e) => setDataPagamentoReal(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Vazio = usa a data de pagamento de cada solicitação. Preencha só para forçar uma data única para todas as marcadas.
                  </p>
                </div>
              )}
              {/* CREDEV */}
              {formaPagamentoProcessamento === 'credev' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
                  <p className="text-sm font-bold text-indigo-800">CREDEV</p>
                  <p className="text-xs text-indigo-600 mt-1">
                    O pagamento será registrado como CREDEV no TOTVS.
                  </p>
                </div>
              )}

              {/* Resumo */}
              {formaPagamentoProcessamento && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Forma:</span>
                    <span className="font-bold">
                      {
                        FORMAS_PAGAMENTO.find(
                          (f) => f.id === formaPagamentoProcessamento,
                        )?.label
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Faturas:</span>
                    <span className="font-semibold">{selectedItems.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor dos títulos:</span>
                    <span className="font-bold text-red-600">
                      {formatarMoeda(valorTotalSelecionado)}
                    </span>
                  </div>
                  {(() => {
                    const juros = solicitacoesFiltradas
                      .filter((x) => selectedItems.has(x.id) && x.status === 'pendente')
                      .reduce((a, x) => a + (parseFloat(x.vl_juros) || 0), 0);
                    return juros > 0 ? (
                      <div className="flex justify-between">
                        <span className="text-gray-500">+ juros/encargos (baixa com juros):</span>
                        <span className="font-bold text-red-600">{formatarMoeda(juros)}</span>
                      </div>
                    ) : null;
                  })()}
                  {(() => {
                    const sel = solicitacoesFiltradas.filter((x) => selectedItems.has(x.id) && x.status === 'pendente');
                    const porData = {};
                    for (const x of sel) {
                      const d = dataPagamentoReal || x.dt_pagamento || 'sem data';
                      porData[d] = porData[d] || { n: 0, valor: 0 };
                      porData[d].n++;
                      porData[d].valor += parseFloat(x.vl_fatura) || 0;
                    }
                    const datas = Object.keys(porData).sort();
                    return (
                      <div className="pt-1 border-t border-gray-200 space-y-0.5">
                        <div className="text-[10px] text-gray-500">
                          {dataPagamentoReal ? `Todas na data única ${dataPagamentoReal.split('-').reverse().join('/')}:` : 'Cada baixa na data do seu pagamento/recebimento:'}
                        </div>
                        {datas.map((d) => (
                          <div key={d} className="flex justify-between text-[11px]">
                            <span className="text-gray-600">{d === 'sem data' ? 'sem data (vai hoje)' : d.split('-').reverse().join('/')}</span>
                            <span className="font-semibold">
                              {porData[d].n} · {formatarMoeda(porData[d].valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setModalPagamentoAberto(false);
                    setFormaPagamentoProcessamento('');
                    setBancoSelecionado(null);
                    setDadosCartaoProcessamento({
                      bandeira: '',
                      autorizacao: '',
                      nsu: '',
                    });
                  }}
                  className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarProcessamento}
                  disabled={
                    !formaPagamentoProcessamento ||
                    // crédito: dados digitados; débito (PAGARME DEBITO): só data real + operadora
                    (formaPagamentoProcessamento === 'cartao_credito' &&
                      (!dadosCartaoProcessamento.bandeira ||
                        !dadosCartaoProcessamento.operadora ||
                        !dadosCartaoProcessamento.autorizacao ||
                        !dadosCartaoProcessamento.nsu)) ||
                    false
                  }
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#000638] rounded-lg hover:bg-[#fe0000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={16} weight="bold" />
                  Confirmar e Processar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rejeição */}
      {modalRejeicao && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-red-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-lg font-bold">Rejeitar Solicitação</h3>
              <button
                onClick={() => setModalRejeicao(null)}
                className="text-white hover:text-red-200"
              >
                <X size={22} weight="bold" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Rejeitar baixa da fatura <strong>{modalRejeicao.nr_fat}</strong>{' '}
                do cliente <strong>{modalRejeicao.nm_cliente}</strong>?
              </p>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Motivo da rejeição
                </label>
                <textarea
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  placeholder="Informe o motivo..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setModalRejeicao(null)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={rejeitarSolicitacao}
                  className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  Confirmar Rejeição
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Localizar/escolher título (João, 16/11/2026) */}
      {modalLocalizar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <MagnifyingGlassPlus size={18} className="text-sky-600" />
                Localizar título no TOTVS
              </h3>
              <button
                onClick={() => setModalLocalizar(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                <div>
                  Pagamento: <b>{formatarMoeda(modalLocalizar.vl_fatura)}</b>
                  {modalLocalizar.dt_pagamento ? ` · pago em ${modalLocalizar.dt_pagamento}` : ''}
                </div>
                <div className="text-gray-500 mt-0.5">
                  Cliente informado: {modalLocalizar.nm_cliente || '—'}
                  {modalLocalizar.cd_cliente ? ` (cód. ${modalLocalizar.cd_cliente})` : ''}
                </div>
              </div>

              {/* Ajustar pessoa / código do cliente */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase">
                  Cliente (TOTVS)
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={locCod}
                    onChange={(e) => setLocCod(e.target.value)}
                    placeholder="Código do cliente"
                    className="w-40 border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => carregarTitulosCliente(locCod)}
                    disabled={locLoading}
                    className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-sm font-bold hover:bg-sky-700 disabled:opacity-50"
                  >
                    {locLoading ? 'Buscando…' : 'Buscar títulos'}
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={locNome}
                    onChange={(e) => setLocNome(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscarPessoaPorNome()}
                    placeholder="…ou buscar cliente por nome"
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={buscarPessoaPorNome}
                    disabled={locBuscandoPessoa}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 disabled:opacity-50"
                  >
                    {locBuscandoPessoa ? 'Buscando…' : 'Buscar nome'}
                  </button>
                </div>
                {locPessoas.length > 0 && (
                  <div className="mt-2 border rounded-lg divide-y max-h-40 overflow-y-auto">
                    {locPessoas.map((p) => (
                      <button
                        key={p.code}
                        onClick={() => escolherPessoa(p)}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-sky-50 flex justify-between gap-2"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-gray-400 text-xs flex-shrink-0">
                          cód. {p.code}
                          {p.doc ? ` · ${p.doc}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de títulos abertos */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase">
                  Títulos em aberto — marque o(s) que esse pagamento quita
                </label>
                {locLoading ? (
                  <div className="text-sm text-gray-400 py-4 text-center">Carregando títulos…</div>
                ) : locTitulos.length === 0 ? (
                  <div className="text-sm text-gray-400 py-4 text-center">
                    Nenhum título em aberto. Informe o código/nome e busque.
                  </div>
                ) : (
                  <div className="mt-1 border rounded-lg divide-y max-h-64 overflow-y-auto">
                    {locTitulos.map((t) => {
                      const k = tituloKey(t);
                      const sel = !!locSel[k];
                      return (
                        <div
                          key={k}
                          className={`flex items-center gap-2 px-3 py-2 text-sm ${sel ? 'bg-sky-50' : 'hover:bg-gray-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => toggleTitulo(t)}
                            className="cursor-pointer"
                          />
                          <span className="font-mono text-xs text-gray-500 w-28 flex-shrink-0">
                            {t.branchCode}-{t.receivableCode}-{t.installmentCode}
                          </span>
                          <span className="text-xs text-gray-600 w-32 flex-shrink-0">
                            saldo <b>{formatarMoeda(t.saldoAberto)}</b>
                            {t.paidValue > 0.01 && (
                              <span className="text-[9px] text-amber-600 block">
                                (parcial · pago {formatarMoeda(t.paidValue)})
                              </span>
                            )}
                            {t.calc &&
                              Math.abs(
                                (t.calc.correctedValue || 0) - t.installmentValue,
                              ) > 0.01 && (
                                <span className="text-[9px] text-rose-600 block">
                                  c/ juros TOTVS {formatarMoeda(t.calc.correctedValue)}
                                  {t.calc.daysLate ? ` (${t.calc.daysLate}d atraso)` : ''}
                                </span>
                              )}
                          </span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            venc {t.expiredDate ? t.expiredDate.split('-').reverse().join('/') : '—'}
                          </span>
                          {sel ? (
                            <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                              <span className="text-[10px] text-gray-500">baixar R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={t.saldoAberto}
                                value={locValor[k] ?? ''}
                                onChange={(e) => setValorTitulo(k, e.target.value)}
                                className="w-24 border rounded px-2 py-0.5 text-sm text-right"
                                title="Valor a baixar deste título (pode ser parcial)"
                              />
                            </span>
                          ) : (
                            <span className="ml-auto text-[10px] text-gray-400 truncate max-w-[120px]">
                              {t.bearerName || ''}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé: soma e aplicar */}
            <div className="px-5 py-3 border-t flex items-center justify-between">
              {(() => {
                const soma = Object.values(locSel).reduce((a, t) => a + valorBaixar(t), 0);
                const pago = Number(modalLocalizar.vl_fatura) || 0;
                const bate = Math.abs(soma - pago) < 0.01;
                const n = Object.keys(locSel).length;
                return (
                  <div className="text-xs">
                    <span className="text-gray-500">Selecionado: </span>
                    <b>{formatarMoeda(soma)}</b>
                    <span className="text-gray-400"> ({n} título{n === 1 ? '' : 's'})</span>
                    {n > 0 && (
                      <span className={`ml-2 font-bold ${bate ? 'text-green-600' : 'text-amber-600'}`}>
                        {bate ? '= pagamento ✓' : `pagamento ${formatarMoeda(pago)} (difere)`}
                      </span>
                    )}
                  </div>
                );
              })()}
              <div className="flex gap-2">
                <button
                  onClick={() => setModalLocalizar(null)}
                  className="px-4 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={aplicarLocalizacao}
                  disabled={Object.keys(locSel).length === 0}
                  className="px-4 py-1.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Vincular título
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notificação */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default SolicitacaoBaixa;
