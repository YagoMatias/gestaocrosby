import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useSetoresUsuario } from '../hooks/useSetoresUsuario';
import { supabaseAdmin } from '../lib/supabase';
import { API_BASE_URL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import Notification from '../components/ui/Notification';
import {
  ClipboardText,
  Clock,
  ShieldCheck,
  CheckSquare,
  CheckCircle,
  XCircle,
  WarningCircle,
  Money,
  Spinner,
  ArrowClockwise,
  Eye,
  X,
  Receipt,
  MagnifyingGlass,
  Plus,
  Link as LinkIcon,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';

// =====================================================================
// CONFIGURAÇÕES
// =====================================================================
// Etapas do fluxo, na ordem. A etapa "atual" de uma solicitação é derivada
// do status em solicitacoes_crosby + do vínculo com pagamentos_liberacao:
//   pendente → aprovado_gestor → aprovado_financeiro → enviado_totvs
//   → liberado_pagamento (pagamento_liberacao_id) → pago
const ETAPAS = [
  {
    key: 'pendente',
    label: 'Pendente',
    short: 'Pendente',
    color: 'bg-yellow-100 text-yellow-800',
    dot: 'bg-yellow-400',
    icon: Clock,
  },
  {
    key: 'aprovado_gestor',
    label: 'Aprovado pelo Gestor',
    short: 'Gestor',
    color: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
    icon: ShieldCheck,
  },
  {
    key: 'aprovado_financeiro',
    label: 'Aprovado Financeiro',
    short: 'Financeiro',
    color: 'bg-indigo-100 text-indigo-800',
    dot: 'bg-indigo-500',
    icon: CheckSquare,
  },
  {
    key: 'enviado_totvs',
    label: 'Enviado ao TOTVS',
    short: 'TOTVS',
    color: 'bg-cyan-100 text-cyan-800',
    dot: 'bg-cyan-500',
    icon: CheckCircle,
  },
  {
    key: 'liberado_pagamento',
    label: 'Liberado p/ Pagamento',
    short: 'Liberado',
    color: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
    icon: Money,
  },
  {
    key: 'pago',
    label: 'Pago',
    short: 'Pago',
    color: 'bg-green-200 text-green-900',
    dot: 'bg-green-600',
    icon: CheckCircle,
  },
];

// Solicitação COM nota fiscal não vai ao TOTVS: após o gestor aprovar, fica
// em 'nota_fiscal' até o setor do solicitante escriturar a NF (chamado no Dryland) e o
// financeiro liberar o pagamento. Ocupa a posição da etapa TOTVS na barra.
const ETAPA_NF = {
  key: 'nota_fiscal',
  label: 'Nota Fiscal',
  short: 'Nota Fiscal',
  color: 'bg-purple-100 text-purple-800',
  dot: 'bg-purple-500',
  icon: Receipt,
};
const ETAPA_NF_IDX = 3;

// Situações terminais fora do fluxo normal
const ETAPAS_FORA = {
  rejeitado: {
    key: 'rejeitado',
    label: 'Rejeitado',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
  cancelada: {
    key: 'cancelada',
    label: 'Cancelada',
    color: 'bg-gray-200 text-gray-700',
    icon: XCircle,
  },
  erro_envio: {
    key: 'erro_envio',
    label: 'Erro no envio ao TOTVS',
    color: 'bg-red-100 text-red-800',
    icon: WarningCircle,
  },
};

const TIPO_LABEL = {
  pagamento: 'Pagamento',
  reembolso: 'Reembolso',
  compra: 'Compra',
  manutencao: 'Manutenção',
  rh: 'RH',
};

const FORMA_LABEL = (v) => {
  if (!v) return '--';
  const s = String(v).toLowerCase();
  if (s === 'pix') return 'PIX';
  if (s === 'boleto') return 'Boleto';
  if (s === 'debito') return 'Débito';
  if (s.startsWith('credito_')) return `Crédito ${s.replace('credito_', '')}`;
  return v;
};

// =====================================================================
// HELPERS
// =====================================================================
const formatarMoeda = (valor) =>
  parseFloat(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatarData = (data) => {
  if (!data) return '--';
  const str = String(data).split('T')[0];
  const [ano, mes, dia] = str.split('-');
  if (!ano || !mes || !dia) return '--';
  return `${dia}/${mes}/${ano}`;
};

const formatarDataHora = (data) => {
  if (!data) return '--';
  const d = new Date(data);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const onlyDigits = (v) => String(v || '').replace(/\D+/g, '');
const norm = (s) => String(s || '').trim().toUpperCase();
const addDays = (yyyymmdd, dias) => {
  const d = new Date(`${yyyymmdd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/**
 * Uma linha da fila (pagamentos_liberacao) ou do TOTVS pertence à solicitação?
 * O vínculo por id só existe quando a liberação saiu do Solicitações Crosby;
 * pelo Contas a Pagar a linha nasce sem esse vínculo, então cravamos por
 * duplicata + empresa + fornecedor (CNPJ/CPF, com fallback no nome).
 */
const pertenceASolicitacao = (sol, row) => {
  if (String(row.nr_duplicata || '') !== String(sol.duplicate_code || ''))
    return false;
  if (
    row.cd_empresa != null &&
    sol.cd_empresa != null &&
    String(row.cd_empresa) !== String(sol.cd_empresa)
  )
    return false;
  if (row.solicitacao_id && row.solicitacao_id === sol.id) return true;
  const docRow = onlyDigits(row.nr_cpfcnpj_fornecedor);
  const docSol = onlyDigits(sol.supplier_cpf_cnpj);
  if (docRow && docSol) return docRow === docSol;
  if (row.nm_fornecedor && sol.supplier_name)
    return norm(row.nm_fornecedor) === norm(sol.supplier_name);
  // sem fornecedor para comparar: aceita pela duplicata + empresa
  return true;
};

/**
 * Deriva a etapa atual e as informações de pagamento de uma solicitação.
 * - `pg`      linha de pagamentos_liberacao vinculada por pagamento_liberacao_id
 * - `filaDup` linhas de pagamentos_liberacao cravadas por duplicata/fornecedor
 *             (liberação feita direto pela Consulta do Contas a Pagar)
 * - `totvs`   situação da duplicata no TOTVS ({ pago, parcial, pagoEm, ... })
 * Prioridade da informação de pagamento: TOTVS > fila > marcação manual.
 */
const derivarEtapa = (sol, pg, filaDup = [], totvs = null) => {
  const pagoManual = !!sol.pago_em;
  const pagoFilaId = pg?.status === 'PAGO';
  const filaAtivas = filaDup.filter((r) => r.status !== 'CANCELADO');
  const pagoFilaDup =
    filaAtivas.length > 0 && filaAtivas.every((r) => r.status === 'PAGO');
  const pagoTotvs = !!totvs?.pago;
  const pago = pagoManual || pagoFilaId || pagoFilaDup || pagoTotvs;
  const liberado =
    !!sol.pagamento_liberacao_id ||
    !!sol.liberado_pagamento_em ||
    filaAtivas.length > 0;

  let origemPago = null;
  let pagoEm = null;
  if (pagoTotvs) {
    origemPago = 'TOTVS';
    pagoEm = totvs.pagoEm;
  } else if (pagoFilaId) {
    origemPago = 'Liberação de Pagamento';
    pagoEm = pg.dt_pagamento || pg.pago_em;
  } else if (pagoFilaDup) {
    origemPago = 'Liberação de Pagamento';
    pagoEm =
      filaAtivas
        .map((r) => r.dt_pagamento || r.pago_em)
        .filter(Boolean)
        .sort()
        .pop() || null;
  } else if (pagoManual) {
    origemPago = 'manual';
    pagoEm = sol.pago_em;
  }

  const filaStatus =
    pg?.status ||
    (filaAtivas.length
      ? [...new Set(filaAtivas.map((r) => r.status))].join(' / ')
      : null);
  const liberadoEm =
    sol.liberado_pagamento_em ||
    filaAtivas
      .map((r) => r.enviado_em || r.created_at)
      .filter(Boolean)
      .sort()[0] ||
    null;
  const liberadoPor =
    sol.liberado_pagamento_por_nome ||
    (filaAtivas.length ? filaAtivas[0].enviado_por : null);

  const base = {
    pagoManual,
    liberado,
    filaStatus,
    liberadoEm,
    liberadoPor,
    origemPago,
    totvs,
  };

  if (ETAPAS_FORA[sol.status] && !pago) {
    return { ...base, etapa: ETAPAS_FORA[sol.status], idx: -1, pago: false, pagoEm: null };
  }

  let idx;
  if (pago) idx = 5;
  else if (liberado) idx = 4;
  else if (sol.status === 'nota_fiscal') {
    return {
      ...base,
      etapa: {
        ...ETAPA_NF,
        label: sol.nf_escriturado_em
          ? 'NF escriturada'
          : 'NF pendente de escrituração',
      },
      idx: ETAPA_NF_IDX,
      pago,
      pagoEm,
    };
  } else {
    idx = ETAPAS.findIndex((e) => e.key === sol.status);
    if (idx < 0) idx = 0;
  }

  return { ...base, etapa: ETAPAS[idx], idx, pago, pagoEm };
};

/** Resume as parcelas de uma duplicata no TOTVS em { pago, parcial, pagoEm, ... }. */
const resumirTotvs = (parcelas) => {
  if (!parcelas.length) return null;
  const ativas = parcelas.filter((p) => p.tp_situacao !== 'C');
  const liquidada = (p) =>
    !!p.dt_liq || Number(p.vl_pago || 0) > 0 || p.tp_estagio === 'Liquid';
  const pagas = ativas.filter(liquidada);
  return {
    encontrada: true,
    cancelada: ativas.length === 0,
    parcelas: ativas.length,
    pagas: pagas.length,
    pago: ativas.length > 0 && pagas.length === ativas.length,
    parcial: pagas.length > 0 && pagas.length < ativas.length,
    pagoEm:
      pagas
        .map((p) => (p.dt_liq ? String(p.dt_liq).slice(0, 10) : null))
        .filter(Boolean)
        .sort()
        .pop() || null,
    vlPago: pagas.reduce((a, p) => a + Number(p.vl_pago || 0), 0),
    cdFornecedor: ativas[0]?.cd_fornecedor ?? parcelas[0]?.cd_fornecedor ?? null,
  };
};

// =====================================================================
// COMPONENTE
// =====================================================================
const MinhasSolicitacoes = () => {
  const { user } = useAuth();
  const { temSetor, loading: setoresLoading } = useSetoresUsuario();

  // Financeiro (setor FINANCEIRO ou perfil 'user' legado), admin e owner
  // veem todas as solicitações e podem marcar pagamento manualmente.
  const role = user?.role || user?.user_metadata?.role;
  const isAdmin = role === 'owner' || role === 'admin';
  const isFinanceiro = isAdmin || role === 'user' || temSetor('FINANCEIRO');

  const userNome =
    user?.name ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'Usuário';

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [pagamentos, setPagamentos] = useState({}); // id → linha de pagamentos_liberacao
  const [filaPorDup, setFilaPorDup] = useState({}); // sol.id → linhas cravadas por duplicata
  const [totvs, setTotvs] = useState({}); // sol.id → resumo da duplicata no TOTVS
  const [totvsLoading, setTotvsLoading] = useState(false);
  const [totvsErro, setTotvsErro] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [processandoId, setProcessandoId] = useState(null);

  const [filtroEtapa, setFiltroEtapa] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [somenteMinhas, setSomenteMinhas] = useState(false);
  const [modalDetalhe, setModalDetalhe] = useState(null);

  const notify = (type, message) => {
    setNotification({ type, message });
  };

  // ----- TOTVS: situação de pagamento pela duplicata -----
  // Ao enviar ao TOTVS a solicitação ganha um duplicate_code. Consultamos o
  // contas a pagar por esse código (+ empresa) e cravamos o fornecedor pelo
  // CNPJ/CPF — assim pegamos a liquidação mesmo quando o pagamento foi feito
  // fora do fluxo (direto no TOTVS ou pela Consulta do Contas a Pagar).
  const verificarTotvs = useCallback(async (sols) => {
    const alvo = sols.filter(
      (s) => s.duplicate_code && (s.status === 'enviado_totvs' || s.enviado_totvs_em),
    );
    if (!alvo.length) {
      setTotvs({});
      return;
    }
    setTotvsLoading(true);
    setTotvsErro(null);
    try {
      // Janela de vencimento cobrindo todas as parcelas, com folga para
      // vencimentos alterados no TOTVS. O filtro real é o duplicateCodeList.
      const hoje = new Date().toISOString().slice(0, 10);
      const datas = [];
      alvo.forEach((s) => {
        (s.payload_totvs?.installments || []).forEach((i) => {
          if (i.dueDate) datas.push(String(i.dueDate).slice(0, 10));
        });
        if (s.dt_vencimento) datas.push(String(s.dt_vencimento).slice(0, 10));
      });
      datas.sort();
      const dt_inicio = addDays(datas[0] || hoje, -60);
      const dt_fim = addDays(datas[datas.length - 1] || hoje, 400);
      const branches = [
        ...new Set(alvo.map((s) => parseInt(s.cd_empresa)).filter(Boolean)),
      ];
      const codes = [...new Set(alvo.map((s) => String(s.duplicate_code)))];

      const itens = [];
      for (let i = 0; i < codes.length; i += 50) {
        const resp = await fetch(
          `${API_BASE_URL}/api/totvs/accounts-payable/search`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dt_inicio,
              dt_fim,
              branches,
              modo: 'vencimento',
              situacao: 'TODAS',
              filtroPagamento: 'TODOS',
              duplicateCodeList: codes.slice(i, i + 50),
            }),
          },
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const lista = Array.isArray(json?.data?.data)
          ? json.data.data
          : Array.isArray(json?.data)
            ? json.data
            : [];
        itens.push(...lista);
      }

      const mapa = {};
      alvo.forEach((s) => {
        const parcelas = itens.filter((it) => pertenceASolicitacao(s, it));
        mapa[s.id] = resumirTotvs(parcelas) || { encontrada: false };
      });
      setTotvs(mapa);
    } catch (err) {
      console.error('Erro ao consultar TOTVS:', err);
      setTotvsErro(err?.message || 'Falha ao consultar o TOTVS.');
    } finally {
      setTotvsLoading(false);
    }
  }, []);

  // ----- carregar -----
  const carregar = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const todas = [];
      if (isFinanceiro) {
        // Financeiro vê tudo — pagina de 1000 em 1000 (limite do Supabase)
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabaseAdmin
            .from('solicitacoes_crosby')
            .select('*')
            .order('data_solicitacao', { ascending: false })
            .order('id', { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          todas.push(...(data || []));
          if (!data || data.length < PAGE) break;
        }
      } else {
        // Usuário comum: pelas do próprio user_id + fallback pelo e-mail
        // (solicitações antigas, abertas antes do formulário exigir login).
        const porId = await supabaseAdmin
          .from('solicitacoes_crosby')
          .select('*')
          .eq('user_id', user.id)
          .order('data_solicitacao', { ascending: false });
        if (porId.error) throw porId.error;
        todas.push(...(porId.data || []));
        if (user.email) {
          const porEmail = await supabaseAdmin
            .from('solicitacoes_crosby')
            .select('*')
            .is('user_id', null)
            .ilike('solicitante_email', user.email)
            .order('data_solicitacao', { ascending: false });
          if (porEmail.error) throw porEmail.error;
          todas.push(...(porEmail.data || []));
        }
        todas.sort(
          (a, b) =>
            new Date(b.data_solicitacao || 0) - new Date(a.data_solicitacao || 0),
        );
      }

      // Linhas vinculadas na fila de Liberação de Pagamento (status PAGO etc.)
      const ids = [
        ...new Set(
          todas.map((s) => s.pagamento_liberacao_id).filter(Boolean),
        ),
      ];
      const mapa = {};
      for (let i = 0; i < ids.length; i += 200) {
        const lote = ids.slice(i, i + 200);
        const { data, error } = await supabaseAdmin
          .from('pagamentos_liberacao')
          .select(
            'id, status, pago_em, pago_por, dt_pagamento, aprovado_em, aprovado_por, baixado',
          )
          .in('id', lote);
        if (error) throw error;
        (data || []).forEach((p) => {
          mapa[p.id] = p;
        });
      }

      // Liberações feitas pela Consulta do Contas a Pagar não têm o vínculo
      // por id — cravamos pela duplicata + empresa + fornecedor.
      const codes = [
        ...new Set(
          todas.map((s) => s.duplicate_code).filter(Boolean).map(String),
        ),
      ];
      const porDup = {};
      for (let i = 0; i < codes.length; i += 200) {
        const { data, error } = await supabaseAdmin
          .from('pagamentos_liberacao')
          .select(
            'id, status, pago_em, pago_por, dt_pagamento, enviado_em, enviado_por, created_at, nr_duplicata, nr_parcela, cd_empresa, cd_fornecedor, nm_fornecedor, vl_duplicata, dados_completos',
          )
          .in('nr_duplicata', codes.slice(i, i + 200));
        if (error) throw error;
        (data || []).forEach((row) => {
          const enriquecida = {
            ...row,
            nr_cpfcnpj_fornecedor:
              row.dados_completos?.nr_cpfcnpj_fornecedor ||
              row.dados_completos?.supplier_cpf_cnpj ||
              null,
            solicitacao_id: row.dados_completos?.solicitacao_id || null,
          };
          todas.forEach((s) => {
            if (!s.duplicate_code) return;
            if (row.id === s.pagamento_liberacao_id) return; // já coberta por id
            if (pertenceASolicitacao(s, enriquecida)) {
              (porDup[s.id] = porDup[s.id] || []).push(enriquecida);
            }
          });
        });
      }

      setSolicitacoes(todas);
      setPagamentos(mapa);
      setFilaPorDup(porDup);
      verificarTotvs(todas); // em paralelo, não trava a tabela
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
      notify('error', 'Erro ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email, isFinanceiro, verificarTotvs]);

  useEffect(() => {
    // Espera os setores carregarem para saber se o usuário é financeiro
    if (user?.id && !setoresLoading) carregar();
  }, [user?.id, setoresLoading, carregar]);

  // ----- derivação -----
  const linhas = useMemo(
    () =>
      solicitacoes.map((sol) => {
        const pg = sol.pagamento_liberacao_id
          ? pagamentos[sol.pagamento_liberacao_id]
          : null;
        const filaDup = filaPorDup[sol.id] || [];
        return {
          sol,
          pg,
          filaDup,
          info: derivarEtapa(sol, pg, filaDup, totvs[sol.id] || null),
        };
      }),
    [solicitacoes, pagamentos, filaPorDup, totvs],
  );

  const ehMinha = (sol) =>
    (sol.user_id && sol.user_id === user?.id) ||
    (!sol.user_id &&
      user?.email &&
      String(sol.solicitante_email || '').toLowerCase() ===
        String(user.email).toLowerCase());

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter(({ sol, info }) => {
      if (somenteMinhas && !ehMinha(sol)) return false;
      if (filtroEtapa !== 'TODOS' && info.etapa.key !== filtroEtapa)
        return false;
      if (q) {
        const alvo = [
          sol.supplier_name,
          sol.descricao,
          sol.solicitante,
          sol.nm_empresa,
          sol.duplicate_code,
          sol.setor,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, busca, filtroEtapa, somenteMinhas, user?.id, user?.email]);

  const totais = useMemo(() => {
    const base = somenteMinhas ? linhas.filter((l) => ehMinha(l.sol)) : linhas;
    const t = { total: base.length };
    ETAPAS.forEach((e) => {
      t[e.key] = base.filter((l) => l.info.etapa.key === e.key).length;
    });
    t.nota_fiscal = base.filter(
      (l) => l.info.etapa.key === 'nota_fiscal',
    ).length;
    Object.keys(ETAPAS_FORA).forEach((k) => {
      t[k] = base.filter((l) => l.info.etapa.key === k).length;
    });
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, somenteMinhas, user?.id, user?.email]);

  // ----- ações do financeiro -----
  const marcarPago = async ({ sol, pg, filaDup = [] }) => {
    if (!isFinanceiro) return;
    if (
      !window.confirm(
        `Marcar como PAGA a solicitação de ${sol.supplier_name || sol.descricao || ''} (${formatarMoeda(sol.valor_total)})?`,
      )
    )
      return;

    setProcessandoId(sol.id);
    try {
      const now = new Date().toISOString();
      const hoje = now.slice(0, 10);

      // 1) Se já está na fila de Liberação de Pagamento (vinculada por id ou
      //    cravada pela duplicata), marca lá também — mesmos campos que a
      //    página Liberação de Pagamento preenche.
      const naFila = [
        ...(sol.pagamento_liberacao_id && pg ? [pg] : []),
        ...filaDup,
      ].filter((r) => r.status !== 'PAGO' && r.status !== 'CANCELADO');
      for (const row of naFila) {
        const { error } = await supabaseAdmin
          .from('pagamentos_liberacao')
          .update({
            status: 'PAGO',
            aprovado_em: row.aprovado_em || now,
            aprovado_por: row.aprovado_por || user?.email || null,
            pago_em: now,
            pago_por: user?.email || null,
            dt_pagamento: row.dt_pagamento || hoje,
          })
          .eq('id', row.id);
        if (error) throw error;
      }

      // 2) Marca na própria solicitação (vale mesmo sem fila)
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({
          pago_em: now,
          pago_por: user?.id || null,
          pago_por_nome: userNome,
        })
        .eq('id', sol.id);
      if (error) throw error;

      notify('success', 'Solicitação marcada como paga.');
      await carregar();
    } catch (err) {
      console.error('Erro ao marcar como pago:', err);
      notify('error', err?.message || 'Erro ao marcar como pago.');
    } finally {
      setProcessandoId(null);
    }
  };

  const desfazerPago = async ({ sol, pg, filaDup = [], info }) => {
    if (!isFinanceiro) return;
    if (info?.totvs?.pago) {
      notify('error', 'Esta duplicata já está liquidada no TOTVS.');
      return;
    }
    if (pg?.status === 'PAGO' || filaDup.some((r) => r.status === 'PAGO')) {
      notify(
        'error',
        'Este título está como PAGO na Liberação de Pagamento — desfaça por lá.',
      );
      return;
    }
    if (!window.confirm('Desfazer a marcação manual de pagamento?')) return;
    setProcessandoId(sol.id);
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({ pago_em: null, pago_por: null, pago_por_nome: null })
        .eq('id', sol.id);
      if (error) throw error;
      notify('success', 'Marcação de pagamento desfeita.');
      await carregar();
    } catch (err) {
      console.error('Erro ao desfazer pagamento:', err);
      notify('error', err?.message || 'Erro ao desfazer pagamento.');
    } finally {
      setProcessandoId(null);
    }
  };

  // ----- UI helpers -----
  const Stepper = ({ idx }) => (
    <div className="flex items-center gap-0.5" title="Andamento">
      {ETAPAS.map((e, i) => (
        <span
          key={e.key}
          className={`h-1.5 w-4 rounded-full ${
            idx < 0 ? 'bg-red-200' : i <= idx ? e.dot : 'bg-gray-200'
          }`}
          title={e.label}
        />
      ))}
    </div>
  );

  const EtapaBadge = ({ etapa }) => {
    const Icon = etapa.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${etapa.color}`}
      >
        <Icon size={12} weight="bold" />
        {etapa.label}
      </span>
    );
  };

  const PagamentoCell = ({ info, sol }) => {
    const t = info.totvs;
    const aguardandoTotvs =
      totvsLoading && sol?.duplicate_code && !t && info.idx >= 3;
    if (info.pago) {
      return (
        <span className="inline-flex flex-col leading-tight">
          <span className="inline-flex items-center gap-1 text-green-700 font-bold">
            <CheckCircle size={13} weight="fill" />
            PAGO
            {info.pagoEm && (
              <span className="text-[10px] font-normal text-gray-500">
                {formatarData(info.pagoEm)}
              </span>
            )}
          </span>
          {info.origemPago && (
            <span className="text-[10px] text-gray-400">
              via {info.origemPago}
            </span>
          )}
        </span>
      );
    }
    if (t?.parcial) {
      return (
        <span className="inline-flex flex-col leading-tight">
          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
            <Clock size={13} weight="bold" />
            Parcial no TOTVS
          </span>
          <span className="text-[10px] text-gray-400">
            {t.pagas}/{t.parcelas} parcela(s) liquidada(s)
          </span>
        </span>
      );
    }
    if (info.liberado || t?.encontrada) {
      return (
        <span className="inline-flex flex-col leading-tight">
          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
            <Clock size={13} weight="bold" />
            Em aberto
            {info.filaStatus && (
              <span className="text-[10px] font-normal text-gray-500">
                ({info.filaStatus})
              </span>
            )}
          </span>
          {t?.encontrada && (
            <span className="text-[10px] text-gray-400">
              {t.cancelada ? 'cancelada no TOTVS' : 'em aberto no TOTVS'}
            </span>
          )}
        </span>
      );
    }
    if (aguardandoTotvs) {
      return (
        <span className="inline-flex items-center gap-1 text-gray-400">
          <Spinner size={12} className="animate-spin" />
          TOTVS...
        </span>
      );
    }
    if (t && !t.encontrada) {
      return (
        <span
          className="text-[10px] text-gray-400"
          title="Duplicata não localizada no contas a pagar do TOTVS"
        >
          não localizada no TOTVS
        </span>
      );
    }
    return <span className="text-gray-400">--</span>;
  };

  // ----- render -----
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title={isFinanceiro ? 'Solicitações — Acompanhamento' : 'Minhas Solicitações'}
        subtitle={
          isFinanceiro
            ? 'Acompanhe todas as solicitações e marque manualmente os pagamentos realizados.'
            : 'Acompanhe o andamento das suas solicitações: aprovação, envio ao TOTVS e pagamento.'
        }
        icon={ClipboardText}
        iconColor="text-indigo-600"
      />

      {/* Cards de resumo por etapa */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-4">
        {[
          { key: 'TODOS', label: 'Total', value: totais.total, text: 'text-gray-800' },
          ...ETAPAS.map((e) => ({
            key: e.key,
            label: e.short,
            value: totais[e.key] || 0,
            text: e.color.split(' ')[1],
          })),
          {
            key: ETAPA_NF.key,
            label: ETAPA_NF.short,
            value: totais.nota_fiscal || 0,
            text: ETAPA_NF.color.split(' ')[1],
          },
          {
            key: 'rejeitado',
            label: 'Rejeitadas',
            value: totais.rejeitado || 0,
            text: 'text-red-800',
          },
        ].map((card) => (
          <button
            key={card.key}
            onClick={() => setFiltroEtapa(card.key)}
            className={`p-2.5 rounded-xl border bg-white shadow-sm text-center transition-all hover:shadow-md ${
              filtroEtapa === card.key ? 'ring-2 ring-[#000638]' : ''
            }`}
          >
            <p className="text-[10px] font-medium text-gray-500 truncate">
              {card.label}
            </p>
            <p className={`text-xl font-extrabold mt-0.5 ${card.text}`}>
              {card.value}
            </p>
          </button>
        ))}
      </div>

      {/* Barra de ações */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={carregar}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#000638] bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowClockwise size={14} weight="bold" />
            Atualizar
          </button>
          <RouterLink
            to="/formulario-solicitacoes"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#000638] hover:bg-[#fe0000] rounded-lg transition-colors"
          >
            <Plus size={14} weight="bold" />
            Nova solicitação
          </RouterLink>
          {isFinanceiro && (
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={somenteMinhas}
                onChange={(e) => setSomenteMinhas(e.target.checked)}
                className="accent-[#000638]"
              />
              Somente as minhas
            </label>
          )}
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Fornecedor, descrição, solicitante..."
              className="pl-7 pr-2 py-1.5 text-xs border rounded-lg w-64 focus:outline-none focus:border-[#000638]"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {totvsLoading && (
            <span className="inline-flex items-center gap-1 text-[#000638]">
              <Spinner size={12} className="animate-spin" />
              Consultando TOTVS...
            </span>
          )}
          {totvsErro && (
            <span
              className="inline-flex items-center gap-1 text-red-600"
              title={totvsErro}
            >
              <WarningCircle size={12} weight="bold" />
              TOTVS indisponível
            </span>
          )}
          <span>{linhasFiltradas.length} solicitação(ões)</span>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} className="animate-spin text-[#000638]" />
          <span className="ml-3 text-gray-500">Carregando solicitações...</span>
        </div>
      ) : linhasFiltradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ClipboardText size={48} className="mx-auto mb-3" />
          <p className="font-medium">Nenhuma solicitação encontrada</p>
          <p className="text-sm mt-1">
            {filtroEtapa !== 'TODOS' || busca
              ? 'Altere o filtro ou a busca.'
              : 'Abra uma solicitação pelo Formulário de Solicitações.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-[#000638] text-white sticky top-0">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Etapa</th>
                <th className="px-3 py-2.5 text-left font-semibold">Andamento</th>
                <th className="px-3 py-2.5 text-left font-semibold">Tipo</th>
                {isFinanceiro && (
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Solicitante
                  </th>
                )}
                <th className="px-3 py-2.5 text-left font-semibold">
                  Fornecedor / Descrição
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Vencimento
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">NF</th>
                <th className="px-3 py-2.5 text-left font-semibold">
                  Pagamento
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Solicitado em
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map(({ sol, pg, filaDup, info }) => (
                <tr
                  key={sol.id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2">
                    <EtapaBadge etapa={info.etapa} />
                  </td>
                  <td className="px-3 py-2">
                    <Stepper idx={info.idx} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {TIPO_LABEL[sol.tipo_solicitacao] || sol.tipo_solicitacao}
                  </td>
                  {isFinanceiro && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium">{sol.solicitante || '--'}</div>
                      <div className="text-[10px] text-gray-400">
                        {sol.setor || ''}
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-2 max-w-[260px]">
                    <div className="font-medium truncate">
                      {sol.supplier_name || sol.nm_empresa || '--'}
                    </div>
                    <div
                      className="text-[10px] text-gray-500 truncate"
                      title={sol.descricao}
                    >
                      {sol.descricao}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-[#000638] whitespace-nowrap">
                    {sol.valor_total != null ? formatarMoeda(sol.valor_total) : '--'}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {formatarData(sol.dt_vencimento)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {sol.tem_nota_fiscal === true ? (
                      <span
                        className={`inline-flex flex-col items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          sol.nf_escriturado_em
                            ? 'bg-green-100 text-green-800'
                            : sol.nf_chamado_dryland_id ||
                                sol.status === 'nota_fiscal'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                        title={
                          sol.nf_chamado_dryland_numero
                            ? `Chamado Dryland #${sol.nf_chamado_dryland_numero}`
                            : undefined
                        }
                      >
                        {sol.nf_escriturado_em
                          ? 'Escriturada'
                          : sol.nf_chamado_dryland_id ||
                              sol.status === 'nota_fiscal'
                            ? 'Pendente escriturar'
                            : 'Sim'}
                        {sol.nf_chamado_dryland_numero && (
                          <span className="font-normal opacity-80">
                            #{sol.nf_chamado_dryland_numero}
                          </span>
                        )}
                      </span>
                    ) : sol.tem_nota_fiscal === false ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">
                        Não
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <PagamentoCell info={info} sol={sol} />
                  </td>
                  <td className="px-3 py-2 text-center text-[10px] whitespace-nowrap">
                    {formatarDataHora(sol.data_solicitacao)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() =>
                          setModalDetalhe({ sol, pg, filaDup, info })
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                      >
                        <Eye size={12} />
                        Detalhes
                      </button>
                      {isFinanceiro &&
                        !info.pago &&
                        info.idx >= 0 && (
                          <button
                            onClick={() => marcarPago({ sol, pg, filaDup })}
                            disabled={processandoId === sol.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-white bg-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            title="Marcar manualmente como pago"
                          >
                            {processandoId === sol.id ? (
                              <Spinner size={12} className="animate-spin" />
                            ) : (
                              <Money size={12} weight="bold" />
                            )}
                            Pago
                          </button>
                        )}
                      {isFinanceiro && info.pagoManual && (
                        <button
                          onClick={() =>
                            desfazerPago({ sol, pg, filaDup, info })
                          }
                          disabled={processandoId === sol.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                          title="Desfazer marcação manual"
                        >
                          <ArrowCounterClockwise size={12} weight="bold" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalhes / linha do tempo */}
      {modalDetalhe && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
          onClick={() => setModalDetalhe(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-base font-bold">
                {TIPO_LABEL[modalDetalhe.sol.tipo_solicitacao] || 'Solicitação'}{' '}
                — {modalDetalhe.sol.supplier_name || modalDetalhe.sol.nm_empresa}
              </h3>
              <button
                onClick={() => setModalDetalhe(null)}
                className="text-white hover:text-red-300"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <EtapaBadge etapa={modalDetalhe.info.etapa} />
                <PagamentoCell info={modalDetalhe.info} sol={modalDetalhe.sol} />
              </div>

              {/* Linha do tempo */}
              <div className="border rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase text-gray-500 mb-2">
                  Linha do tempo
                </p>
                <ol className="space-y-1.5">
                  {[
                    {
                      label: 'Solicitado',
                      em: modalDetalhe.sol.data_solicitacao,
                      por: modalDetalhe.sol.solicitante,
                      ok: true,
                    },
                    {
                      label: 'Aprovado pelo gestor',
                      em: modalDetalhe.sol.aprovado_gestor_em,
                      por: modalDetalhe.sol.aprovado_gestor_por_nome,
                      ok: !!modalDetalhe.sol.aprovado_gestor_em,
                    },
                    // Com NF o caminho é escrituração (Dryland) em vez de
                    // aprovação financeira + envio ao TOTVS
                    ...(modalDetalhe.sol.status === 'nota_fiscal' ||
                    modalDetalhe.sol.nf_chamado_dryland_id
                      ? [
                          {
                            label: `Chamado de escrituração aberto${modalDetalhe.sol.setor ? ` (${modalDetalhe.sol.setor})` : ''}`,
                            em: modalDetalhe.sol.nf_chamado_aberto_em,
                            por: modalDetalhe.sol.nf_chamado_dryland_numero
                              ? `Dryland #${modalDetalhe.sol.nf_chamado_dryland_numero}`
                              : null,
                            ok: !!modalDetalhe.sol.nf_chamado_dryland_id,
                          },
                          {
                            label: 'Nota fiscal escriturada',
                            em: modalDetalhe.sol.nf_escriturado_em,
                            por: null,
                            ok: !!modalDetalhe.sol.nf_escriturado_em,
                          },
                        ]
                      : [
                          {
                            label: 'Aprovado pelo financeiro',
                            em: modalDetalhe.sol.aprovado_financeiro_em,
                            por: modalDetalhe.sol.aprovado_financeiro_por_nome,
                            ok: !!modalDetalhe.sol.aprovado_financeiro_em,
                          },
                          {
                            label: 'Enviado ao TOTVS',
                            em: modalDetalhe.sol.enviado_totvs_em,
                            por: modalDetalhe.sol.duplicate_code
                              ? `Duplicata ${modalDetalhe.sol.duplicate_code}`
                              : null,
                            ok: !!modalDetalhe.sol.enviado_totvs_em,
                          },
                        ]),
                    {
                      label: 'Liberado para pagamento',
                      em: modalDetalhe.info.liberadoEm,
                      por: modalDetalhe.info.liberadoPor,
                      ok: modalDetalhe.info.liberado,
                    },
                    {
                      label: 'Pago',
                      em: modalDetalhe.info.pagoEm,
                      por:
                        modalDetalhe.info.origemPago === 'TOTVS'
                          ? `liquidado no TOTVS${modalDetalhe.info.totvs?.vlPago ? ` · ${formatarMoeda(modalDetalhe.info.totvs.vlPago)}` : ''}`
                          : modalDetalhe.info.origemPago === 'manual'
                            ? `${modalDetalhe.sol.pago_por_nome || ''} (manual)`
                            : modalDetalhe.pg?.pago_por ||
                              modalDetalhe.filaDup?.find((r) => r.pago_por)
                                ?.pago_por ||
                              null,
                      ok: modalDetalhe.info.pago,
                    },
                  ].map((p) => (
                    <li key={p.label} className="flex items-start gap-2 text-xs">
                      <span
                        className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${
                          p.ok ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                      <span
                        className={`font-semibold ${p.ok ? 'text-[#000638]' : 'text-gray-400'}`}
                      >
                        {p.label}
                      </span>
                      {p.ok && (
                        <span className="text-gray-500">
                          {formatarDataHora(p.em)}
                          {p.por ? ` · ${p.por}` : ''}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
                {modalDetalhe.sol.motivo_rejeicao && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                    <b>Motivo da rejeição:</b> {modalDetalhe.sol.motivo_rejeicao}
                    {modalDetalhe.sol.rejeitado_por_nome
                      ? ` — ${modalDetalhe.sol.rejeitado_por_nome}`
                      : ''}
                  </div>
                )}
                {modalDetalhe.info.totvs?.encontrada && (
                  <div className="mt-2 bg-cyan-50 border border-cyan-200 rounded-lg p-2 text-xs text-cyan-900">
                    <b>TOTVS:</b> duplicata {modalDetalhe.sol.duplicate_code}
                    {modalDetalhe.info.totvs.cdFornecedor
                      ? ` · fornecedor ${modalDetalhe.info.totvs.cdFornecedor}`
                      : ''}{' '}
                    · {modalDetalhe.info.totvs.pagas}/
                    {modalDetalhe.info.totvs.parcelas} parcela(s) liquidada(s)
                    {modalDetalhe.info.totvs.cancelada ? ' · cancelada' : ''}
                  </div>
                )}
                {modalDetalhe.info.totvs &&
                  !modalDetalhe.info.totvs.encontrada && (
                    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-600">
                      <b>TOTVS:</b> duplicata {modalDetalhe.sol.duplicate_code}{' '}
                      não localizada no contas a pagar (empresa{' '}
                      {modalDetalhe.sol.cd_empresa}).
                    </div>
                  )}
                {modalDetalhe.sol.totvs_erro && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 break-words">
                    <b>Erro TOTVS:</b> {String(modalDetalhe.sol.totvs_erro)}
                  </div>
                )}
              </div>

              {/* Dados */}
              <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <span className="text-gray-500">Filial:</span>{' '}
                  <span className="font-semibold">
                    {modalDetalhe.sol.cd_empresa} - {modalDetalhe.sol.nm_empresa}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Solicitante:</span>{' '}
                  <span className="font-semibold">
                    {modalDetalhe.sol.solicitante}
                    {modalDetalhe.sol.setor ? ` (${modalDetalhe.sol.setor})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Fornecedor:</span>{' '}
                  <span className="font-semibold">
                    {modalDetalhe.sol.supplier_name || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Valor:</span>{' '}
                  <span className="font-bold text-[#000638]">
                    {modalDetalhe.sol.valor_total != null
                      ? formatarMoeda(modalDetalhe.sol.valor_total)
                      : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Emissão:</span>{' '}
                  <span className="font-semibold">
                    {formatarData(modalDetalhe.sol.dt_emissao)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Vencimento:</span>{' '}
                  <span className="font-semibold">
                    {formatarData(modalDetalhe.sol.dt_vencimento)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Forma de pagamento:</span>{' '}
                  <span className="font-semibold">
                    {FORMA_LABEL(modalDetalhe.sol.forma_pagamento)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Nota fiscal:</span>{' '}
                  <span className="font-semibold">
                    {modalDetalhe.sol.tem_nota_fiscal === true
                      ? 'Sim'
                      : modalDetalhe.sol.tem_nota_fiscal === false
                        ? 'Não'
                        : '--'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Descrição:</span>{' '}
                  <span className="font-medium">{modalDetalhe.sol.descricao}</span>
                </div>
                {modalDetalhe.sol.observacao && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Observação:</span>{' '}
                    <span className="font-medium">
                      {modalDetalhe.sol.observacao}
                    </span>
                  </div>
                )}
              </div>

              {/* Anexos */}
              {(modalDetalhe.sol.comprovante_gestor_url ||
                modalDetalhe.sol.comprovante_fabio_url ||
                modalDetalhe.sol.comprovante_url ||
                modalDetalhe.sol.nota_fiscal_url) && (
                <div className="flex flex-wrap gap-2">
                  {[
                    ['Aprovação do gestor', modalDetalhe.sol.comprovante_gestor_url],
                    ['Aprovação do Fábio', modalDetalhe.sol.comprovante_fabio_url],
                    ['Comprovante', modalDetalhe.sol.comprovante_url],
                    ['Nota fiscal', modalDetalhe.sol.nota_fiscal_url],
                  ]
                    .filter(([, url]) => !!url)
                    .map(([label, url]) => (
                      <a
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#000638] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <LinkIcon size={13} weight="bold" />
                        {label}
                      </a>
                    ))}
                </div>
              )}

              {isFinanceiro && !modalDetalhe.info.pago && modalDetalhe.info.idx >= 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      const alvo = modalDetalhe;
                      setModalDetalhe(null);
                      await marcarPago(alvo);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Receipt size={16} weight="bold" />
                    Marcar como pago
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

export default MinhasSolicitacoes;
