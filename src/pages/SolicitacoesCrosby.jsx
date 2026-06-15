import React, { useState, useEffect, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { supabaseAdmin } from '../lib/supabase';
import { API_BASE_URL } from '../config/constants';
import CadastrarFornecedorModal from '../components/CadastrarFornecedorModal';
import PageTitle from '../components/ui/PageTitle';
import Notification from '../components/ui/Notification';
import {
  ClipboardText,
  CheckCircle,
  Clock,
  XCircle,
  ArrowClockwise,
  Spinner,
  Trash,
  X,
  ShoppingCart,
  Wrench,
  CurrencyCircleDollar,
  Eye,
  Link as LinkIcon,
  Copy,
  CheckSquare,
  PaperPlaneTilt,
  HandCoins,
  ShieldCheck,
  WarningCircle,
  CloudArrowUp,
  Receipt,
  PencilSimple,
  ArrowUUpLeft,
  Plus,
  Trash as TrashIcon,
  MagnifyingGlass,
  UploadSimple,
  Image as ImageIcon,
  LinkSimple,
  IdentificationBadge,
} from '@phosphor-icons/react';

import DESPESAS_JSON from '../config/despesas.json';
import CENTROS_CUSTO from '../config/centrosCusto.json';
import PORTADORES_JSON from '../config/portadores.json';

const CENTROS_CUSTO_OPTIONS = Object.entries(CENTROS_CUSTO).sort(
  (a, b) => parseInt(a[0]) - parseInt(b[0]),
);
const DESPESAS_OPTIONS = Object.entries(DESPESAS_JSON)
  .filter(([code]) => parseInt(code) >= 1000)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
const PORTADORES_OPTIONS = Object.entries(PORTADORES_JSON).sort(
  (a, b) => parseInt(a[0]) - parseInt(b[0]),
);
const STORAGE_BUCKET = 'solicitacoes-crosby';

const FORMAS_PAGAMENTO = [
  'PIX',
  'Débito',
  'Boleto',
  'Crédito 1x',
  'Crédito 2x',
  'Crédito 3x',
  'Crédito 4x',
  'Crédito 5x',
  'Crédito 6x',
  'Crédito 7x',
  'Crédito 8x',
  'Crédito 9x',
  'Crédito 10x',
  'Crédito 11x',
  'Crédito 12x',
];

const getDespesaNome = (code) => {
  if (!code && code !== 0) return String(code ?? '--');
  const nome = DESPESAS_JSON[String(code)];
  return nome ? `${code} — ${nome}` : String(code);
};

// =====================================================================
// CONFIGURAÇÕES
// =====================================================================
const STATUS_CONFIG = {
  pendente: {
    label: 'Pendente',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
  },
  aprovado_gestor: {
    label: 'Aprovado pelo Gestor',
    color: 'bg-blue-100 text-blue-800',
    icon: ShieldCheck,
  },
  aprovado_financeiro: {
    label: 'Aprovado Financeiro',
    color: 'bg-indigo-100 text-indigo-800',
    icon: CheckSquare,
  },
  enviado_totvs: {
    label: 'Enviado ao TOTVS',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  erro_envio: {
    label: 'Erro no envio',
    color: 'bg-red-100 text-red-800',
    icon: WarningCircle,
  },
  rejeitado: {
    label: 'Rejeitado',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
  },
  cancelada: {
    label: 'Cancelada',
    color: 'bg-gray-200 text-gray-700',
    icon: XCircle,
  },
};

const TIPO_CONFIG = {
  pagamento: {
    label: 'Pagamento',
    icon: CurrencyCircleDollar,
    color: 'bg-emerald-100 text-emerald-800',
  },
  reembolso: {
    label: 'Reembolso',
    icon: Receipt,
    color: 'bg-purple-100 text-purple-800',
  },
  compra: {
    label: 'Compra',
    icon: ShoppingCart,
    color: 'bg-blue-100 text-blue-800',
  },
  manutencao: {
    label: 'Manutenção',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800',
  },
  rh: {
    label: 'RH',
    icon: IdentificationBadge,
    color: 'bg-pink-100 text-pink-800',
  },
};

// Status secundário — apenas para compra e manutenção
const STATUS_SECUNDARIO = [
  {
    value: 'em_processo',
    label: 'Em Processo',
    color: 'bg-sky-100 text-sky-800',
  },
  { value: 'orcado', label: 'Orçado', color: 'bg-violet-100 text-violet-800' },
  {
    value: 'contratado',
    label: 'Comprado / Contratado',
    color: 'bg-amber-100 text-amber-800',
  },
  {
    value: 'finalizado',
    label: 'Finalizado',
    color: 'bg-teal-100 text-teal-800',
  },
];

const TIPOS_COM_STATUS_SEC = ['compra', 'manutencao'];

// =====================================================================
// HELPERS
// =====================================================================
const formatarDataHora = (data) => {
  if (!data) return '--';
  const d = new Date(data);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString('pt-BR');
};

const formatarData = (data) => {
  if (!data) return '--';
  // Se vier no formato YYYY-MM-DD ou com T..., extrai só a parte da data
  // e interpreta como local (sem conversão UTC→local que causaria regressão de dia).
  const datePart = typeof data === 'string' ? data.slice(0, 10) : null;
  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
  }
  const d = new Date(data);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('pt-BR');
};

const formatarMoeda = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatCnpjCpf = (v) => {
  const d = String(v || '').replace(/\D+/g, '');
  if (!d) return '--';
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

// =====================================================================
// TRADUÇÃO DE ERROS TOTVS → mensagens amigáveis para o usuário
// =====================================================================
const traduzirMensagemTotvs = (raw) => {
  if (!raw) return null;
  const msg = String(raw);

  // SupplierCpfCnpj not found
  if (/SupplierCpfCnpj\s+not\s+found/i.test(msg)) {
    const m = msg.match(/(\d{11,14})/);
    const doc = m ? ` (${formatCnpjCpf(m[1])})` : '';
    return `CPF/CNPJ${doc} NÃO CADASTRADO NO TOTVS, OU CLIENTE NÃO MARCADO COMO FORNECEDOR.`;
  }
  // BranchCnpj not found
  if (/BranchCnpj\s+not\s+found/i.test(msg)) {
    return 'CNPJ da filial não cadastrado no TOTVS.';
  }
  // BearerCode
  if (/BearerCode/i.test(msg) && /not\s+found/i.test(msg)) {
    return 'Portador não cadastrado no TOTVS.';
  }
  // ExpenseCode
  if (/ExpenseCode/i.test(msg) && /not\s+found/i.test(msg)) {
    return 'Código de despesa não cadastrado no TOTVS.';
  }
  // CostCenterCode
  if (/CostCenterCode/i.test(msg) && /not\s+found/i.test(msg)) {
    return 'Centro de custo não cadastrado no TOTVS.';
  }
  // DuplicateCode tamanho
  if (/DuplicateCode/i.test(msg) && /exceed/i.test(msg)) {
    return 'O CÓDIGO DA DUPLICATA excede o limite de 10 caracteres. Edite a solicitação e diminua o código.';
  }
  // DuplicateCode duplicado
  if (/DuplicateCode/i.test(msg) && /(already|duplicate|exists)/i.test(msg)) {
    return 'Já existe uma duplicata com este código no TOTVS. Edite a solicitação e gere um novo código.';
  }
  // FieldSizeExceed genérico
  if (/FieldSizeExceed/i.test(msg) || /exceed the limit size/i.test(msg)) {
    const m = msg.match(/field\s+(\w+)\s+exceed.*?(\d+)\s+characters/i);
    if (m) return `O campo ${m[1]} excede o limite de ${m[2]} caracteres.`;
    return 'Um dos campos excedeu o limite de caracteres permitido.';
  }
  // Invalid field
  if (/InvalidField/i.test(msg)) {
    const m = msg.match(/InvalidField\s+([\w.]+)/i);
    if (m) return `Campo inválido enviado ao TOTVS: ${m[1]}.`;
    return 'Um dos campos enviados ao TOTVS está inválido.';
  }
  // Required field
  if (/required/i.test(msg) && /field/i.test(msg)) {
    return 'Um campo obrigatório não foi preenchido.';
  }
  // KeyNotFound genérico
  if (/KeyNotFound/i.test(msg)) {
    return 'Registro não encontrado no TOTVS. Verifique se todos os códigos estão cadastrados.';
  }
  // Timeout
  if (/timeout/i.test(msg)) {
    return 'O TOTVS demorou muito para responder. Tente reenviar.';
  }
  // Token / auth
  if (/401|unauthorized|token/i.test(msg)) {
    return 'Falha de autenticação com o TOTVS. Avise o suporte técnico.';
  }
  return null;
};

// Extrai todas as mensagens amigáveis a partir do totvs_erro + totvs_response
const extrairErrosAmigaveis = (sol) => {
  const msgs = [];
  const addUnique = (m) => {
    if (m && !msgs.includes(m)) msgs.push(m);
  };

  if (Array.isArray(sol.totvs_response)) {
    sol.totvs_response.forEach((d) => {
      const t = traduzirMensagemTotvs(d?.message);
      if (t) addUnique(t);
    });
  } else if (
    sol.totvs_response?.details &&
    Array.isArray(sol.totvs_response.details)
  ) {
    sol.totvs_response.details.forEach((d) => {
      const t = traduzirMensagemTotvs(d?.message);
      if (t) addUnique(t);
    });
  } else if (sol.totvs_response?.message) {
    const t = traduzirMensagemTotvs(sol.totvs_response.message);
    if (t) addUnique(t);
  }

  if (msgs.length === 0) {
    const t = traduzirMensagemTotvs(sol.totvs_erro);
    if (t) addUnique(t);
  }
  return msgs;
};

// =====================================================================
// COMPONENTE
// =====================================================================
const SolicitacoesCrosby = () => {
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [enviandoTotvs, setEnviandoTotvs] = useState(false);

  // Seleção em massa
  const [selecionados, setSelecionados] = useState(new Set());
  const [modalMassa, setModalMassa] = useState(null); // 'tipo' | 'reprovar'
  const [tipoMassa, setTipoMassa] = useState('');
  const [motivoMassa, setMotivoMassa] = useState('');
  const [executandoMassa, setExecutandoMassa] = useState(false);

  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroSetor, setFiltroSetor] = useState('TODOS');
  const [filtroStatusSec, setFiltroStatusSec] = useState('TODOS');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const [modalDetalhe, setModalDetalhe] = useState(null);
  const [modalRejeicao, setModalRejeicao] = useState(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [linkCopiado, setLinkCopiado] = useState(false);

  const formularioUrl = `${window.location.origin}/formulario-solicitacoes`;

  // Permissões
  // • isGestor   → todos os usuários com acesso à página podem aprovar como gestor
  // • isFinanceiro → APENAS owner, admin e financeiro (role='user') — ÚNICOS que podem enviar ao TOTVS
  const role = user?.role || user?.user_metadata?.role;
  const isAdmin = role === 'owner' || role === 'admin' || role === 'user'; // owner + admin + financeiro
  const isGestor = !!user; // todos os usuários autenticados podem aprovar como gestor
  const isFinanceiro = isAdmin; // NÃO inclui 'manager' — gestor nunca envia ao TOTVS
  const canVerRH =
    isAdmin || user?.allowedPages?.includes('/solicitacoes-crosby-rh');

  const userNome =
    user?.name ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'Usuário';

  // ----- carregar -----
  const carregarSolicitacoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .select('*')
        .order('data_solicitacao', { ascending: false });
      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
      notify('error', 'Erro ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSolicitacoes();
  }, []);

  const notify = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // Garante que o duplicateCode no payload use o valor editado pelo usuário
  // (sol.duplicate_code) em vez do valor possivelmente desatualizado dentro de payload_totvs
  const onlyDig = (v) => String(v ?? '').replace(/\D+/g, '');

  const mergePayloadTotvs = (sol) => {
    const tipo = sol.tipo_solicitacao;
    // RH e outros: usa payload_totvs como está
    if (tipo !== 'pagamento' && tipo !== 'reembolso') {
      return {
        ...sol.payload_totvs,
        duplicateCode:
          sol.duplicate_code != null
            ? parseInt(sol.duplicate_code)
            : sol.payload_totvs?.duplicateCode,
      };
    }
    // Pagamento/Reembolso: constrói a partir das colunas da solicitação.
    // Dados extras do financeiro (bearerCode etc.) ficam em payload_totvs.installments
    const saved = sol.payload_totvs || {};
    const savedInst = Array.isArray(saved.installments)
      ? saved.installments[0]
      : {};
    return {
      branchCnpj: onlyDig(sol.branch_cnpj) || saved.branchCnpj || '',
      supplierCpfCnpj:
        onlyDig(sol.supplier_cpf_cnpj) || saved.supplierCpfCnpj || '',
      duplicateCode:
        sol.duplicate_code != null
          ? parseInt(sol.duplicate_code)
          : (saved.duplicateCode ?? null),
      installments: [
        {
          installmentCode: savedInst?.installmentCode ?? 1,
          bearerCode: savedInst?.bearerCode ?? null,
          issueDate: sol.dt_emissao || savedInst?.issueDate || null,
          dueDate: sol.dt_vencimento || savedInst?.dueDate || null,
          arrivalDate: savedInst?.arrivalDate || null,
          duplicateValue: sol.valor_total ?? savedInst?.duplicateValue ?? null,
          expenses: savedInst?.expenses?.length
            ? savedInst.expenses
            : sol.despesa_code
              ? [
                  {
                    expenseCode: sol.despesa_code,
                    costCenterCode: sol.cost_center_code ?? null,
                    proratedPercentage: sol.rateio_percentual ?? 100,
                  },
                ]
              : [],
        },
      ],
    };
  };

  // ----- filtros -----
  // Compra/Manutenção têm controle dedicado em /solicitacoes-crosby/compras-manutencao
  // — por isso, são excluídas da listagem geral por padrão.
  const TIPOS_OCULTOS_GERAL = ['compra', 'manutencao'];
  const solicitacoesGerais = useMemo(
    () =>
      solicitacoes.filter(
        (s) => !TIPOS_OCULTOS_GERAL.includes(s.tipo_solicitacao),
      ),
    [solicitacoes],
  );

  const solicitacoesFiltradas = useMemo(() => {
    let lista = solicitacoesGerais;
    if (!canVerRH) lista = lista.filter((s) => s.tipo_solicitacao !== 'rh');
    if (filtroStatus !== 'TODOS')
      lista = lista.filter((s) => s.status === filtroStatus);
    if (filtroTipo !== 'TODOS')
      lista = lista.filter((s) => s.tipo_solicitacao === filtroTipo);
    if (filtroSetor !== 'TODOS')
      lista = lista.filter((s) => s.setor === filtroSetor);
    if (filtroStatusSec !== 'TODOS')
      lista = lista.filter((s) => s.status_secundario === filtroStatusSec);
    if (filtroDataInicio) {
      const ini = new Date(filtroDataInicio + 'T00:00:00');
      lista = lista.filter((s) => new Date(s.data_solicitacao) >= ini);
    }
    if (filtroDataFim) {
      const fim = new Date(filtroDataFim + 'T23:59:59');
      lista = lista.filter((s) => new Date(s.data_solicitacao) <= fim);
    }
    return lista;
  }, [
    solicitacoesGerais,
    canVerRH,
    filtroStatus,
    filtroTipo,
    filtroSetor,
    filtroStatusSec,
    filtroDataInicio,
    filtroDataFim,
  ]);

  const totais = useMemo(
    () => ({
      total: solicitacoesGerais.length,
      pendente: solicitacoesGerais.filter((s) => s.status === 'pendente')
        .length,
      aprovado_gestor: solicitacoesGerais.filter(
        (s) => s.status === 'aprovado_gestor',
      ).length,
      aprovado_financeiro: solicitacoesGerais.filter(
        (s) => s.status === 'aprovado_financeiro',
      ).length,
      enviado_totvs: solicitacoesGerais.filter(
        (s) => s.status === 'enviado_totvs',
      ).length,
      erro_envio: solicitacoesGerais.filter((s) => s.status === 'erro_envio')
        .length,
      rejeitado: solicitacoesGerais.filter((s) => s.status === 'rejeitado')
        .length,
    }),
    [solicitacoesGerais],
  );

  // ----- ações -----
  const aprovarGestor = async (sol) => {
    if (!isGestor) {
      notify('error', 'Você não tem permissão para aprovar como gestor.');
      return;
    }
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({
          status: 'aprovado_gestor',
          aprovado_gestor_em: new Date().toISOString(),
          aprovado_gestor_por: user?.id || null,
          aprovado_gestor_por_nome: userNome,
        })
        .eq('id', sol.id);
      if (error) throw error;
      await carregarSolicitacoes();
      setModalDetalhe(null);
      notify('success', 'Solicitação aprovada pelo gestor.');
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao aprovar como gestor.');
    }
  };

  const aprovarFinanceiroEEnviar = async (sol) => {
    if (!isFinanceiro) {
      notify('error', 'Você não tem permissão financeira.');
      return;
    }
    if (!sol.payload_totvs) {
      notify('error', 'Solicitação sem payload TOTVS gerado.');
      return;
    }
    if (
      !window.confirm(
        `Confirmar aprovação financeira e envio da duplicata ${sol.duplicate_code} para o TOTVS?`,
      )
    )
      return;

    setEnviandoTotvs(true);
    try {
      // 1) Atualiza para "aprovado_financeiro"
      const agora = new Date().toISOString();
      const { error: updErr } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({
          status: 'aprovado_financeiro',
          aprovado_financeiro_em: agora,
          aprovado_financeiro_por: user?.id || null,
          aprovado_financeiro_por_nome: userNome,
        })
        .eq('id', sol.id);
      if (updErr) throw updErr;

      // 2) Envia para TOTVS
      console.log(
        '📤 Enviando payload TOTVS:',
        JSON.stringify(mergePayloadTotvs(sol), null, 2),
      );
      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/accounts-payable/duplicates/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergePayloadTotvs(sol)),
        },
      );
      const result = await resp.json().catch(() => ({}));
      console.log(
        '📥 Resposta TOTVS (HTTP',
        resp.status,
        '):',
        JSON.stringify(result, null, 2),
      );

      if (!resp.ok || result?.success === false) {
        const msg =
          result?.message || `Falha no envio TOTVS (HTTP ${resp.status})`;
        await supabaseAdmin
          .from('solicitacoes_crosby')
          .update({
            status: 'erro_envio',
            totvs_erro: msg,
            totvs_response: result?.details || result || null,
          })
          .eq('id', sol.id);
        notify('error', `Erro TOTVS: ${msg}`);
      } else {
        await supabaseAdmin
          .from('solicitacoes_crosby')
          .update({
            status: 'enviado_totvs',
            enviado_totvs_em: new Date().toISOString(),
            totvs_response: result?.data ?? result ?? null,
            totvs_erro: null,
          })
          .eq('id', sol.id);
        notify('success', 'Duplicata enviada com sucesso ao TOTVS!');
      }

      await carregarSolicitacoes();
      setModalDetalhe(null);
    } catch (err) {
      console.error(err);
      notify('error', err?.message || 'Erro ao aprovar/enviar.');
    } finally {
      setEnviandoTotvs(false);
    }
  };

  const reenviarTotvs = async (sol) => {
    if (!isFinanceiro) return;
    if (!sol.payload_totvs) return;
    setEnviandoTotvs(true);
    try {
      console.log(
        '📤 Reenviando payload TOTVS:',
        JSON.stringify(mergePayloadTotvs(sol), null, 2),
      );
      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/accounts-payable/duplicates/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergePayloadTotvs(sol)),
        },
      );
      const result = await resp.json().catch(() => ({}));
      console.log(
        '📥 Resposta TOTVS reenvio (HTTP',
        resp.status,
        '):',
        JSON.stringify(result, null, 2),
      );
      if (!resp.ok || result?.success === false) {
        const msg =
          result?.message || `Falha no envio TOTVS (HTTP ${resp.status})`;
        await supabaseAdmin
          .from('solicitacoes_crosby')
          .update({
            status: 'erro_envio',
            totvs_erro: msg,
            totvs_response: result?.details || result || null,
          })
          .eq('id', sol.id);
        notify('error', `Erro TOTVS: ${msg}`);
      } else {
        await supabaseAdmin
          .from('solicitacoes_crosby')
          .update({
            status: 'enviado_totvs',
            enviado_totvs_em: new Date().toISOString(),
            totvs_response: result?.data ?? result ?? null,
            totvs_erro: null,
          })
          .eq('id', sol.id);
        notify('success', 'Reenvio realizado com sucesso!');
      }
      await carregarSolicitacoes();
      setModalDetalhe(null);
    } catch (err) {
      console.error(err);
      notify('error', err?.message || 'Erro ao reenviar.');
    } finally {
      setEnviandoTotvs(false);
    }
  };

  const abrirRejeicao = (sol) => {
    setModalRejeicao(sol);
    setMotivoRejeicao('');
  };

  const confirmarRejeicao = async () => {
    if (!modalRejeicao) return;
    if (!motivoRejeicao.trim()) {
      notify('error', 'Informe o motivo da rejeição.');
      return;
    }
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({
          status: 'rejeitado',
          rejeitado_em: new Date().toISOString(),
          rejeitado_por: user?.id || null,
          rejeitado_por_nome: userNome,
          motivo_rejeicao: motivoRejeicao.trim(),
        })
        .eq('id', modalRejeicao.id);
      if (error) throw error;
      await carregarSolicitacoes();
      setModalRejeicao(null);
      setModalDetalhe(null);
      notify('success', 'Solicitação rejeitada.');
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao rejeitar.');
    }
  };

  const salvarEdicao = async (sol, dados) => {
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update(dados)
        .eq('id', sol.id);
      if (error) throw error;
      await carregarSolicitacoes();
      notify('success', 'Solicitação atualizada com sucesso.');
      return true;
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao salvar edição.');
      return false;
    }
  };

  const atualizarStatusSecundario = async (sol, novoStatus) => {
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({ status_secundario: novoStatus })
        .eq('id', sol.id);
      if (error) throw error;
      await carregarSolicitacoes();
      notify('success', 'Status atualizado.');
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao atualizar status.');
    }
  };

  const devolverParaGestor = async (sol) => {
    if (!isFinanceiro) return;
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({
          status: 'pendente',
          aprovado_gestor_em: null,
          aprovado_gestor_por: null,
          aprovado_gestor_por_nome: null,
        })
        .eq('id', sol.id);
      if (error) throw error;
      await carregarSolicitacoes();
      notify('success', 'Solicitação devolvida para aprovação do gestor.');
      return true;
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao devolver para gestor.');
      return false;
    }
  };

  const liberarParaPagamento = async (sol) => {
    if (!isFinanceiro) {
      notify('error', 'Apenas o financeiro pode liberar para pagamento.');
      return;
    }
    if (sol.pagamento_liberacao_id) {
      notify('error', 'Esta solicitação já foi liberada para pagamento.');
      return;
    }
    if (sol.status !== 'enviado_totvs') {
      notify('error', 'Só é possível liberar após o envio ao TOTVS.');
      return;
    }
    if (
      !window.confirm(
        `Liberar a solicitação ${sol.duplicate_code || ''} (${sol.supplier_name || ''}) para pagamento?`,
      )
    )
      return;

    try {
      // mapear forma de pagamento (lowercase no formulário → uppercase em pagamentos_liberacao)
      const fp = (sol.forma_pagamento || '').toLowerCase();
      const formaUpper =
        fp === 'pix'
          ? 'PIX'
          : fp === 'boleto'
            ? 'BOLETO'
            : fp === 'debito'
              ? 'DEBITO'
              : fp.startsWith('credito')
                ? 'CREDITO'
                : null;

      const linkPgto =
        sol.dados_completos?.pix_qrcode_payload ||
        sol.dados_completos?.link_pagamento ||
        null;

      const row = {
        status: 'PENDENTE',
        nm_empresa: sol.nm_empresa || null,
        cd_empresa: sol.cd_empresa || null,
        nm_fornecedor: sol.supplier_name || null,
        cd_fornecedor: null,
        nr_duplicata: sol.duplicate_code ? String(sol.duplicate_code) : null,
        dt_emissao: sol.dt_emissao ? String(sol.dt_emissao).slice(0, 10) : null,
        dt_vencimento: sol.dt_vencimento
          ? String(sol.dt_vencimento).slice(0, 10)
          : null,
        vl_duplicata: Number(sol.valor_total || 0),
        ds_despesaitem: sol.despesa_code
          ? getDespesaNome(sol.despesa_code)
          : null,
        cd_ccusto: sol.cost_center_code ? String(sol.cost_center_code) : null,
        forma_pagamento: formaUpper,
        chave_pix: formaUpper === 'PIX' ? sol.chave_pix || null : null,
        codigo_barras:
          formaUpper === 'BOLETO' ? sol.codigo_barras || null : null,
        link_pagamento: linkPgto,
        observacao: sol.descricao || null,
        enviado_por: user?.email || null,
        enviado_em: new Date().toISOString(),
        dados_completos: {
          origem: 'solicitacao_crosby',
          solicitacao_id: sol.id,
          duplicate_code: sol.duplicate_code || null,
          supplier_cpf_cnpj: sol.supplier_cpf_cnpj || null,
          tipo_solicitacao: sol.tipo_solicitacao || null,
          setor: sol.setor || null,
        },
      };

      const { data: novoPg, error: insErr } = await supabaseAdmin
        .from('pagamentos_liberacao')
        .insert([row])
        .select('id')
        .single();
      if (insErr) throw insErr;

      const { error: updErr } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({
          liberado_pagamento_em: new Date().toISOString(),
          liberado_pagamento_por: user?.id || null,
          liberado_pagamento_por_nome: userNome,
          pagamento_liberacao_id: novoPg.id,
        })
        .eq('id', sol.id);
      if (updErr) throw updErr;

      await carregarSolicitacoes();
      setModalDetalhe(null);
      notify('success', 'Solicitação liberada para pagamento!');
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao liberar para pagamento: ' + (err.message || ''));
    }
  };

  const excluirSolicitacao = async (sol) => {
    if (!isAdmin) {
      notify('error', 'Apenas administradores podem excluir.');
      return;
    }
    if (
      !window.confirm(
        `Excluir solicitação de ${sol.solicitante} (duplicata ${sol.duplicate_code || '--'})?`,
      )
    )
      return;
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .delete()
        .eq('id', sol.id);
      if (error) throw error;
      await carregarSolicitacoes();
      setModalDetalhe(null);
      notify('success', 'Solicitação excluída.');
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao excluir.');
    }
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(formularioUrl);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
    }
  };

  const limparFiltros = () => {
    setFiltroStatus('TODOS');
    setFiltroTipo('TODOS');
    setFiltroSetor('TODOS');
    setFiltroStatusSec('TODOS');
    setFiltroDataInicio('');
    setFiltroDataFim('');
  };

  // ----- seleção helpers -----
  const todosVisivelsSelecionados =
    solicitacoesFiltradas.length > 0 &&
    solicitacoesFiltradas.every((s) => selecionados.has(s.id));
  const algunsSelecionados = selecionados.size > 0;

  const toggleSelecionado = (id) =>
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleTodos = () => {
    if (todosVisivelsSelecionados) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(solicitacoesFiltradas.map((s) => s.id)));
    }
  };

  // ----- ações em massa -----
  const alterarTipoEmMassa = async () => {
    if (!tipoMassa) return;
    setExecutandoMassa(true);
    try {
      const ids = [...selecionados];
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({ tipo_solicitacao: tipoMassa })
        .in('id', ids);
      if (error) throw error;
      await carregarSolicitacoes();
      setSelecionados(new Set());
      setModalMassa(null);
      setTipoMassa('');
      notify('success', `Tipo alterado em ${ids.length} solicitação(ões).`);
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao alterar tipo em massa.');
    } finally {
      setExecutandoMassa(false);
    }
  };

  const aprovarGestorEmMassa = async () => {
    if (!isGestor) return;
    if (
      !window.confirm(
        `Aprovar como gestor ${selecionados.size} solicitação(ões) selecionada(s)?`,
      )
    )
      return;
    setExecutandoMassa(true);
    try {
      const ids = [...selecionados];
      const agora = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({
          status: 'aprovado_gestor',
          aprovado_gestor_em: agora,
          aprovado_gestor_por: user?.id || null,
          aprovado_gestor_por_nome: userNome,
        })
        .in('id', ids);
      if (error) throw error;
      await carregarSolicitacoes();
      setSelecionados(new Set());
      notify(
        'success',
        `${ids.length} solicitação(ões) aprovada(s) pelo gestor.`,
      );
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao aprovar em massa.');
    } finally {
      setExecutandoMassa(false);
    }
  };

  const reprovarGestorEmMassa = async () => {
    if (!motivoMassa.trim()) {
      notify('error', 'Informe o motivo da rejeição.');
      return;
    }
    setExecutandoMassa(true);
    try {
      const ids = [...selecionados];
      const agora = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({
          status: 'rejeitado',
          rejeitado_em: agora,
          rejeitado_por: user?.id || null,
          rejeitado_por_nome: userNome,
          motivo_rejeicao: motivoMassa.trim(),
        })
        .in('id', ids);
      if (error) throw error;
      await carregarSolicitacoes();
      setSelecionados(new Set());
      setModalMassa(null);
      setMotivoMassa('');
      notify('success', `${ids.length} solicitação(ões) rejeitada(s).`);
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao rejeitar em massa.');
    } finally {
      setExecutandoMassa(false);
    }
  };

  const enviarTotvsEmMassa = async () => {
    if (!isFinanceiro) return;
    const candidatas = solicitacoesFiltradas.filter(
      (s) => selecionados.has(s.id) && s.payload_totvs,
    );
    if (candidatas.length === 0) {
      notify('error', 'Nenhuma selecionada possui payload TOTVS.');
      return;
    }
    if (!window.confirm(`Enviar ${candidatas.length} duplicata(s) ao TOTVS?`))
      return;
    setExecutandoMassa(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const sol of candidatas) {
        try {
          const resp = await fetch(
            `${API_BASE_URL}/api/totvs/accounts-payable/duplicates/create`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mergePayloadTotvs(sol)),
            },
          );
          const result = await resp.json().catch(() => ({}));
          if (!resp.ok || result?.success === false) {
            const msg = result?.message || `HTTP ${resp.status}`;
            await supabaseAdmin
              .from('solicitacoes_crosby')
              .update({
                status: 'erro_envio',
                totvs_erro: msg,
                totvs_response: result?.details || result || null,
              })
              .eq('id', sol.id);
            failCount++;
          } else {
            await supabaseAdmin
              .from('solicitacoes_crosby')
              .update({
                status: 'enviado_totvs',
                enviado_totvs_em: new Date().toISOString(),
                totvs_response: result?.data ?? result ?? null,
                totvs_erro: null,
              })
              .eq('id', sol.id);
            okCount++;
          }
        } catch {
          failCount++;
        }
      }
      await carregarSolicitacoes();
      setSelecionados(new Set());
      if (failCount === 0)
        notify('success', `${okCount} duplicata(s) enviada(s) com sucesso!`);
      else notify('error', `${okCount} enviada(s), ${failCount} com erro.`);
    } catch (err) {
      console.error(err);
      notify('error', 'Erro no envio em massa.');
    } finally {
      setExecutandoMassa(false);
    }
  };

  // =====================================================================
  // RENDER
  // =====================================================================
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Solicitações Crosby"
        subtitle="Aprovação de solicitações de pagamento e reembolso · Envio de duplicatas ao TOTVS"
        icon={ClipboardText}
        iconColor="text-[#000638]"
      />

      {/* Navegação para Compras & Manutenção */}
      <RouterLink
        to="/solicitacoes-crosby/compras-manutencao"
        className="mb-3 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 hover:from-blue-100 hover:to-cyan-100 transition-colors group"
      >
        <span className="bg-blue-600 text-white p-2 rounded-lg group-hover:bg-blue-700 transition-colors">
          <ShoppingCart size={18} weight="bold" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-bold text-[#000638]">
            Compras &amp; Manutenção
          </p>
          <p className="text-[11px] text-gray-600">
            Controle de etapas dedicado (em processo, orçado, contratado,
            finalizado) — acesse a página separada.
          </p>
        </div>
        <span className="text-[11px] font-bold text-blue-700 group-hover:text-blue-900">
          Abrir →
        </span>
      </RouterLink>

      {/* Link público */}
      <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
        <LinkIcon size={18} weight="bold" className="text-[#000638]" />
        <div className="flex-1 min-w-[200px]">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Link público do formulário
          </p>
          <code className="text-xs text-[#000638] break-all">
            {formularioUrl}
          </code>
        </div>
        <button
          onClick={copiarLink}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#000638] hover:bg-[#fe0000] rounded-lg transition-colors"
        >
          {linkCopiado ? (
            <>
              <CheckSquare size={14} weight="bold" />
              Copiado!
            </>
          ) : (
            <>
              <Copy size={14} weight="bold" />
              Copiar link
            </>
          )}
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mb-4">
        {[
          {
            label: 'Total',
            value: totais.total,
            color: 'text-gray-800',
            filter: 'TODOS',
          },
          {
            label: 'Pendentes',
            value: totais.pendente,
            color: 'text-yellow-700',
            filter: 'pendente',
          },
          {
            label: 'Apr. Gestor',
            value: totais.aprovado_gestor,
            color: 'text-blue-700',
            filter: 'aprovado_gestor',
          },
          {
            label: 'Apr. Financeiro',
            value: totais.aprovado_financeiro,
            color: 'text-indigo-700',
            filter: 'aprovado_financeiro',
          },
          {
            label: 'Enviado TOTVS',
            value: totais.enviado_totvs,
            color: 'text-green-700',
            filter: 'enviado_totvs',
          },
          {
            label: 'Erro envio',
            value: totais.erro_envio,
            color: 'text-red-700',
            filter: 'erro_envio',
          },
          {
            label: 'Rejeitadas',
            value: totais.rejeitado,
            color: 'text-red-700',
            filter: 'rejeitado',
          },
        ].map((card) => (
          <button
            key={card.label}
            onClick={() => setFiltroStatus(card.filter)}
            className={`p-2.5 rounded-xl border bg-white shadow-sm text-center transition-all hover:shadow-md ${
              filtroStatus === card.filter ? 'ring-2 ring-[#000638]' : ''
            }`}
          >
            <p className="text-[10px] font-medium text-gray-500">
              {card.label}
            </p>
            <p className={`text-xl font-extrabold mt-0.5 ${card.color}`}>
              {card.value}
            </p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white border rounded-xl p-3 mb-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-gray-500 uppercase">
            Tipo
          </label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638] min-w-[130px] mb-4"
          >
            <option value="TODOS">Todos</option>
            <option value="pagamento">Pagamento</option>
            <option value="reembolso">Reembolso</option>
            {canVerRH && <option value="rh">RH</option>}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-gray-500 uppercase">
            Status
          </label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638] min-w-[170px] mb-4"
          >
            <option value="TODOS">Todos</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-gray-500 uppercase">
            Setor
          </label>
          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638] min-w-[150px] mb-4"
          >
            <option value="TODOS">Todos</option>
            {[
              'VAREJO',
              'FINANCEIRO',
              'RH',
              'MULTIMARCAS',
              'REVENDA',
              'PRODUÇÃO',
              'EXPEDIÇÃO',
              'MARKETING',
              'TRÁFEGO',
              'TECNOLOGIA',
              'CENTRAL DE FRANQUIAS',
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-gray-500 uppercase">
            Data início
          </label>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-gray-500 uppercase">
            Data fim
          </label>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]"
          />
        </div>
        <button
          onClick={limparFiltros}
          className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Limpar
        </button>
        <button
          onClick={carregarSolicitacoes}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#000638] bg-white border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowClockwise size={14} weight="bold" />
          Atualizar
        </button>
        <span className="ml-auto text-xs text-gray-500">
          {solicitacoesFiltradas.length} de {solicitacoes.length}
        </span>

        {/* Ações em massa */}
        {algunsSelecionados && (
          <>
            <div className="w-full h-px bg-gray-200" />
            <div className="w-full flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#000638]">
                {selecionados.size} selecionada
                {selecionados.size !== 1 ? 's' : ''}:
              </span>
              <button
                onClick={() => {
                  setTipoMassa('');
                  setModalMassa('tipo');
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#000638] hover:bg-[#fe0000] rounded-lg transition-colors"
              >
                Alterar Tipo
              </button>
              {isGestor && (
                <button
                  onClick={aprovarGestorEmMassa}
                  disabled={executandoMassa}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1"
                >
                  {executandoMassa && (
                    <Spinner size={11} className="animate-spin" />
                  )}
                  Aprovar (Gestor)
                </button>
              )}
              {isGestor && (
                <button
                  onClick={() => {
                    setMotivoMassa('');
                    setModalMassa('reprovar');
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Reprovar (Gestor)
                </button>
              )}
              {isFinanceiro && (
                <button
                  onClick={enviarTotvsEmMassa}
                  disabled={executandoMassa}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1"
                >
                  {executandoMassa && (
                    <Spinner size={11} className="animate-spin" />
                  )}
                  Enviar ao TOTVS
                </button>
              )}
              <button
                onClick={() => setSelecionados(new Set())}
                className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Limpar seleção
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} className="animate-spin text-[#000638]" />
          <span className="ml-3 text-gray-500">Carregando solicitações...</span>
        </div>
      ) : solicitacoesFiltradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border">
          <ClipboardText size={48} className="mx-auto mb-3" />
          <p className="font-medium">Nenhuma solicitação encontrada</p>
          <p className="text-sm mt-1">
            Compartilhe o link público para receber novas solicitações.
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
                    checked={todosVisivelsSelecionados}
                    onChange={toggleTodos}
                    className="w-3.5 h-3.5 cursor-pointer accent-white"
                    title="Selecionar todos"
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold">Tipo</th>
                <th className="px-3 py-2.5 text-left font-semibold">Loja</th>
                <th className="px-3 py-2.5 text-left font-semibold">
                  Fornecedor
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Duplicata
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Vencimento
                </th>
                <th className="px-3 py-2.5 text-left font-semibold">
                  Solicitante
                </th>
                <th className="px-3 py-2.5 text-left font-semibold">Setor</th>
                <th className="px-3 py-2.5 text-center font-semibold">Data</th>
                <th className="px-3 py-2.5 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {solicitacoesFiltradas.map((sol) => {
                const statusCfg =
                  STATUS_CONFIG[sol.status] || STATUS_CONFIG.pendente;
                const StatusIcon = statusCfg.icon;
                const tipoCfg =
                  TIPO_CONFIG[sol.tipo_solicitacao] || TIPO_CONFIG.compra;
                const TipoIcon = tipoCfg.icon;
                return (
                  <tr
                    key={sol.id}
                    className={`border-b hover:bg-gray-50 transition-colors ${selecionados.has(sol.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selecionados.has(sol.id)}
                        onChange={() => toggleSelecionado(sol.id)}
                        className="w-3.5 h-3.5 cursor-pointer accent-[#000638]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCfg.color}`}
                      >
                        <StatusIcon size={12} weight="bold" />
                        {statusCfg.label}
                      </span>
                      {TIPOS_COM_STATUS_SEC.includes(sol.tipo_solicitacao) &&
                        sol.status_secundario &&
                        (() => {
                          const sec = STATUS_SECUNDARIO.find(
                            (s) => s.value === sol.status_secundario,
                          );
                          return sec ? (
                            <span
                              className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${sec.color}`}
                            >
                              {sec.label}
                            </span>
                          ) : null;
                        })()}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${tipoCfg.color}`}
                      >
                        <TipoIcon size={12} weight="bold" />
                        {tipoCfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {sol.nm_empresa || '--'}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Cód: {sol.cd_empresa}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="font-medium truncate max-w-[180px]"
                        title={sol.supplier_name}
                      >
                        {sol.supplier_name || '--'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {formatCnpjCpf(sol.supplier_cpf_cnpj)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center font-mono">
                      {sol.duplicate_code || '--'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatarMoeda(sol.valor_total)}
                    </td>
                    <td className="px-3 py-2 text-center text-[11px]">
                      {formatarData(sol.dt_vencimento)}
                    </td>
                    <td className="px-3 py-2 font-medium">{sol.solicitante}</td>
                    <td className="px-3 py-2">
                      {sol.setor ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                          {sol.setor}
                        </span>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-[10px]">
                      {formatarDataHora(sol.data_solicitacao)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setModalDetalhe(sol)}
                          className="p-1 text-[#000638] hover:bg-blue-50 rounded transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye size={16} weight="bold" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => excluirSolicitacao(sol)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DETALHE */}
      {modalDetalhe && (
        <ModalDetalhe
          sol={modalDetalhe}
          onClose={() => setModalDetalhe(null)}
          isGestor={isGestor}
          isFinanceiro={isFinanceiro}
          enviandoTotvs={enviandoTotvs}
          onAprovarGestor={aprovarGestor}
          onAprovarFinanceiro={aprovarFinanceiroEEnviar}
          onReenviar={reenviarTotvs}
          onRejeitar={abrirRejeicao}
          onSalvarEdicao={salvarEdicao}
          onDevolverParaGestor={devolverParaGestor}
          onAtualizarStatusSecundario={atualizarStatusSecundario}
          onLiberarPagamento={liberarParaPagamento}
          onRecarregar={carregarSolicitacoes}
        />
      )}

      {/* MODAL ALTERAR TIPO EM MASSA */}
      {modalMassa === 'tipo' && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">
            <div className="bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-base font-bold">Alterar tipo em massa</h3>
              <button
                onClick={() => setModalMassa(null)}
                className="text-white hover:text-gray-200"
              >
                <X size={20} weight="bold" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Alterar tipo de <strong>{selecionados.size}</strong>{' '}
                solicitação(ões) para:
              </p>
              <select
                value={tipoMassa}
                onChange={(e) => setTipoMassa(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#000638]"
              >
                <option value="">Selecione o tipo...</option>
                <option value="pagamento">Pagamento</option>
                <option value="reembolso">Reembolso</option>
                {canVerRH && <option value="rh">RH</option>}
              </select>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModalMassa(null)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={alterarTipoEmMassa}
                  disabled={!tipoMassa || executandoMassa}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#000638] hover:bg-[#fe0000] disabled:opacity-50 rounded-lg flex items-center gap-1"
                >
                  {executandoMassa && (
                    <Spinner size={12} className="animate-spin" />
                  )}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REPROVAR EM MASSA */}
      {modalMassa === 'reprovar' && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-red-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-base font-bold flex items-center gap-2">
                <XCircle size={18} weight="bold" />
                Reprovar em massa
              </h3>
              <button
                onClick={() => setModalMassa(null)}
                className="text-white hover:text-gray-200"
              >
                <X size={20} weight="bold" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">
                Rejeitar <strong>{selecionados.size}</strong> solicitação(ões).
                Informe o motivo:
              </p>
              <textarea
                rows={4}
                value={motivoMassa}
                onChange={(e) => setMotivoMassa(e.target.value)}
                placeholder="Motivo da rejeição..."
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500 resize-y"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModalMassa(null)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={reprovarGestorEmMassa}
                  disabled={!motivoMassa.trim() || executandoMassa}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg flex items-center gap-1"
                >
                  {executandoMassa && (
                    <Spinner size={12} className="animate-spin" />
                  )}
                  Confirmar Rejeição
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REJEIÇÃO */}
      {modalRejeicao && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-red-600 text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <XCircle size={20} weight="bold" />
                Rejeitar Solicitação
              </h3>
              <button
                onClick={() => setModalRejeicao(null)}
                className="text-white hover:text-gray-200"
              >
                <X size={22} weight="bold" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">
                Informe o motivo da rejeição da solicitação{' '}
                <strong>#{modalRejeicao.duplicate_code}</strong>:
              </p>
              <textarea
                rows={4}
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Motivo..."
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500 transition-colors resize-y"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModalRejeicao(null)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarRejeicao}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  Confirmar Rejeição
                </button>
              </div>
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

// =====================================================================
// MODAL DETALHE
// =====================================================================
const ModalDetalhe = ({
  sol,
  onClose,
  isGestor,
  isFinanceiro,
  enviandoTotvs,
  onAprovarGestor,
  onAprovarFinanceiro,
  onReenviar,
  onRejeitar,
  onSalvarEdicao,
  onDevolverParaGestor,
  onAtualizarStatusSecundario,
  onLiberarPagamento,
  onRecarregar,
}) => {
  const tipoCfg = TIPO_CONFIG[sol.tipo_solicitacao] || TIPO_CONFIG.compra;
  const TipoIcon = tipoCfg.icon;
  const statusCfg = STATUS_CONFIG[sol.status] || STATUS_CONFIG.pendente;
  const StatusIcon = statusCfg.icon;
  const parcelas = sol.payload_totvs?.installments || [];
  const [parcelaSelecionada, setParcelaSelecionada] = React.useState(0);
  const [editando, setEditando] = React.useState(false);

  const podeAprovarGestor = sol.status === 'pendente' && isGestor;
  const podeAprovarFinanceiro =
    sol.status === 'aprovado_gestor' && isFinanceiro;
  const podeReenviar = sol.status === 'erro_envio' && isFinanceiro;
  const podeRejeitar =
    (sol.status === 'pendente' && isGestor) ||
    (sol.status === 'aprovado_gestor' && isFinanceiro);
  const podeEditar =
    (sol.status === 'pendente' && isGestor) ||
    (sol.status === 'aprovado_gestor' && isFinanceiro) ||
    (sol.status === 'erro_envio' && isFinanceiro);
  const podeDevolver = sol.status === 'aprovado_gestor' && isFinanceiro;
  const podeLiberarPagamento =
    sol.status === 'enviado_totvs' &&
    !sol.pagamento_liberacao_id &&
    isFinanceiro;
  const jaLiberadoPagamento = !!sol.pagamento_liberacao_id;

  if (editando) {
    return (
      <ModalEdicao
        sol={sol}
        onClose={() => setEditando(false)}
        onSalvar={onSalvarEdicao}
        onDevolverParaGestor={onDevolverParaGestor}
        isGestor={isGestor}
        isFinanceiro={isFinanceiro}
        podeDevolver={podeDevolver}
        onFecharTudo={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center z-10">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Receipt size={20} weight="bold" />
            Solicitação · Duplicata #{sol.duplicate_code}
          </h3>
          <div className="flex items-center gap-2">
            {podeEditar && (
              <button
                onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 transition-colors"
              >
                <PencilSimple size={14} weight="bold" />
                Editar
              </button>
            )}
            <button onClick={onClose} className="text-white hover:text-red-300">
              <X size={22} weight="bold" />
            </button>
          </div>
        </div>

        <div className="p-0 space-y-0">
          {/* ── DOCUMENTO DUPLICATA ── */}
          <div className="p-5 space-y-4">
            {/* Erro TOTVS */}
            {sol.totvs_erro &&
              (() => {
                const amigaveis = extrairErrosAmigaveis(sol);
                return (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <div className="flex items-center gap-1.5 font-bold mb-2">
                      <WarningCircle size={16} weight="bold" />
                      Erro no envio ao TOTVS
                    </div>
                    {amigaveis.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1 text-xs font-bold">
                        {amigaveis.map((m, i) => (
                          <li key={i} className="uppercase">
                            {m}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap text-xs font-bold">
                        {sol.totvs_erro}
                      </p>
                    )}
                    {sol.totvs_response && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-red-600 hover:text-red-800 font-bold">
                          Ver detalhes técnicos
                        </summary>
                        <pre className="mt-1 text-[10px] bg-red-100 rounded p-2 overflow-x-auto max-h-40 whitespace-pre-wrap">
                          {JSON.stringify(sol.totvs_response, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })()}

            {/* ── CABEÇALHO DO DOCUMENTO ── */}
            <div className="border-2 border-[#000638] rounded-xl overflow-hidden">
              {/* Faixa título */}
              <div className="bg-[#000638] px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Receipt size={18} weight="fill" className="text-white" />
                  <span className="text-white font-extrabold text-sm tracking-wide uppercase">
                    {tipoCfg.label}
                  </span>
                  {sol.duplicate_code && (
                    <span className="bg-white/20 text-white font-mono text-xs px-2 py-0.5 rounded">
                      Duplicata #{sol.duplicate_code}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusCfg.color}`}
                  >
                    <StatusIcon size={12} weight="bold" />
                    {statusCfg.label}
                  </span>
                  {TIPOS_COM_STATUS_SEC.includes(sol.tipo_solicitacao) &&
                    sol.status_secundario &&
                    (() => {
                      const sec = STATUS_SECUNDARIO.find(
                        (s) => s.value === sol.status_secundario,
                      );
                      return sec ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${sec.color}`}
                        >
                          {sec.label}
                        </span>
                      ) : null;
                    })()}
                </div>
              </div>

              {/* Grid principal do documento */}
              <div className="divide-y divide-gray-100">
                {/* Linha 1 — Emitente / Loja */}
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-gray-100">
                  <DocField label="Empresa / Loja" className="sm:col-span-2">
                    <span className="font-bold text-sm">
                      {sol.nm_empresa || '--'}
                    </span>
                    <span className="text-gray-500 text-xs ml-2">
                      Cód. {sol.cd_empresa}
                    </span>
                  </DocField>
                  <DocField label="CNPJ Filial">
                    <span className="font-mono text-sm font-semibold">
                      {formatCnpjCpf(sol.branch_cnpj)}
                    </span>
                  </DocField>
                </div>

                {/* Linha 2 — Solicitante */}
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-gray-100">
                  <DocField label="Solicitante" className="sm:col-span-1">
                    <span className="font-semibold text-sm">
                      {sol.solicitante || '--'}
                    </span>
                  </DocField>
                  <DocField label="Setor">
                    <span className="font-semibold text-sm">
                      {sol.setor || '--'}
                    </span>
                  </DocField>
                  <DocField label="Data da Solicitação">
                    <span className="font-mono text-sm">
                      {formatarDataHora(sol.data_solicitacao)}
                    </span>
                  </DocField>
                </div>

                {/* Linha 3 — Fornecedor */}
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-gray-100">
                  <DocField
                    label="Fornecedor / Prestador"
                    className="sm:col-span-2"
                  >
                    <span className="font-bold text-sm">
                      {sol.supplier_name || '--'}
                    </span>
                  </DocField>
                  <DocField label="CPF / CNPJ Fornecedor">
                    <span className="font-mono text-sm font-semibold">
                      {formatCnpjCpf(sol.supplier_cpf_cnpj)}
                    </span>
                  </DocField>
                </div>

                {/* Linha 4 — Forma pagamento / Valor total */}
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-gray-100">
                  <DocField
                    label="Forma de Pagamento"
                    className="sm:col-span-2"
                  >
                    <span className="font-semibold text-sm">
                      {sol.forma_pagamento || '--'}
                    </span>
                  </DocField>
                  <DocField label="Valor Total">
                    <span className="font-extrabold text-lg text-[#000638]">
                      {formatarMoeda(sol.valor_total)}
                    </span>
                  </DocField>
                </div>

                {/* Descrição */}
                {sol.descricao && (
                  <div className="grid grid-cols-1">
                    <DocField label="Descrição / Finalidade">
                      <p className="text-sm whitespace-pre-wrap text-gray-700">
                        {sol.descricao}
                      </p>
                    </DocField>
                  </div>
                )}
                {sol.observacao && (
                  <div className="grid grid-cols-1">
                    <DocField label="Observação">
                      <p className="text-sm whitespace-pre-wrap text-gray-700">
                        {sol.observacao}
                      </p>
                    </DocField>
                  </div>
                )}
              </div>
            </div>

            {/* ── PARCELAS ── */}
            {parcelas.length > 0 &&
              (() => {
                const p = parcelas[parcelaSelecionada] || parcelas[0];
                return (
                  <div className="border-2 border-[#000638] rounded-xl overflow-hidden">
                    {/* Cabeçalho com seletores */}
                    <div className="bg-[#000638] px-4 py-2 flex items-center gap-3 flex-wrap">
                      <span className="text-white font-extrabold text-xs tracking-widest uppercase shrink-0">
                        Parcelas
                      </span>
                      {/* Seletores numéricos */}
                      <div className="flex gap-1 flex-wrap">
                        {parcelas.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setParcelaSelecionada(i)}
                            className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                              parcelaSelecionada === i
                                ? 'bg-white text-[#000638]'
                                : 'bg-white/20 text-white hover:bg-white/40'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      <span className="ml-auto text-white/70 text-xs font-mono shrink-0">
                        Total:{' '}
                        {formatarMoeda(
                          parcelas.reduce(
                            (s, x) => s + (Number(x.duplicateValue) || 0),
                            0,
                          ),
                        )}
                      </span>
                    </div>

                    {/* Conteúdo da parcela selecionada */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#000638] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                            Parcela{' '}
                            {p.installmentCode ?? parcelaSelecionada + 1}/
                            {parcelas.length}
                          </span>
                          {p.bearerCode && (
                            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                              Portador:{' '}
                              <strong className="text-gray-800">
                                {p.bearerCode}
                              </strong>
                            </span>
                          )}
                        </div>
                        <span className="text-lg font-extrabold text-[#000638]">
                          {formatarMoeda(p.duplicateValue)}
                        </span>
                      </div>

                      {/* Datas */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-gray-50 rounded-lg px-3 py-2 text-center border">
                          <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider mb-0.5">
                            Emissão
                          </p>
                          <p className="text-xs font-semibold text-gray-800">
                            {formatarData(p.issueDate)}
                          </p>
                        </div>
                        <div className="bg-[#000638]/5 rounded-lg px-3 py-2 text-center border border-[#000638]/20">
                          <p className="text-[9px] font-bold uppercase text-[#000638]/60 tracking-wider mb-0.5">
                            Vencimento
                          </p>
                          <p className="text-xs font-bold text-[#000638]">
                            {formatarData(p.dueDate)}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 py-2 text-center border">
                          <p className="text-[9px] font-bold uppercase text-gray-400 tracking-wider mb-0.5">
                            Chegada NF
                          </p>
                          <p className="text-xs font-semibold text-gray-800">
                            {formatarData(p.arrivalDate)}
                          </p>
                        </div>
                      </div>

                      {/* Rateio */}
                      {Array.isArray(p.expenses) && p.expenses.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-100 text-gray-500">
                              <tr>
                                <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wide">
                                  Despesa
                                </th>
                                <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wide">
                                  Centro de Custo
                                </th>
                                <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wide">
                                  Rateio %
                                </th>
                                <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wide">
                                  Valor Rateado
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.expenses.map((exp, j) => (
                                <tr
                                  key={j}
                                  className={
                                    j % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                  }
                                >
                                  <td className="px-3 py-1.5 font-bold text-[#000638] text-xs">
                                    {getDespesaNome(exp.expenseCode)}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono font-bold text-[#000638]">
                                    {exp.costCenterCode ?? '--'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-semibold">
                                    {exp.proratedPercentage != null
                                      ? `${exp.proratedPercentage}%`
                                      : '--'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-semibold">
                                    {exp.proratedPercentage != null
                                      ? formatarMoeda(
                                          ((Number(p.duplicateValue) || 0) *
                                            exp.proratedPercentage) /
                                            100,
                                        )
                                      : '--'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Observação */}
                      {p.observations?.[0]?.observation && (
                        <p className="mt-2 text-xs text-gray-500 italic border-l-2 border-gray-300 pl-2">
                          {p.observations[0].observation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* ── INFORMAÇÕES DO TIPO ── campos específicos por tipo */}
            {/* Pagamento / Reembolso: chave pix, código de barras, despesa, vencimento, valor, rateio */}
            {(sol.tipo_solicitacao === 'pagamento' ||
              sol.tipo_solicitacao === 'reembolso') &&
              (sol.chave_pix ||
                sol.codigo_barras ||
                sol.despesa_code ||
                sol.cost_center_code ||
                sol.dt_vencimento ||
                sol.dt_emissao ||
                sol.valor_total) && (
                <div className="border-2 border-[#000638] rounded-xl overflow-hidden">
                  <div className="bg-[#000638] px-4 py-2">
                    <span className="text-white font-extrabold text-xs tracking-widest uppercase">
                      Detalhes do{' '}
                      {sol.tipo_solicitacao === 'reembolso'
                        ? 'Reembolso'
                        : 'Pagamento'}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {(sol.dt_emissao ||
                      sol.dt_vencimento ||
                      sol.valor_total) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-gray-100">
                        {sol.dt_emissao && (
                          <DocField label="Emissão">
                            <span className="font-semibold text-sm font-mono">
                              {formatarData(sol.dt_emissao)}
                            </span>
                          </DocField>
                        )}
                        {sol.dt_vencimento && (
                          <DocField label="Vencimento">
                            <span className="font-semibold text-sm font-mono">
                              {formatarData(sol.dt_vencimento)}
                            </span>
                          </DocField>
                        )}
                        {sol.valor_total && (
                          <DocField label="Valor">
                            <span className="font-extrabold text-lg text-[#000638]">
                              {formatarMoeda(sol.valor_total)}
                            </span>
                          </DocField>
                        )}
                      </div>
                    )}
                    {(sol.despesa_code ||
                      sol.cost_center_code ||
                      sol.rateio_percentual) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-gray-100">
                        {sol.despesa_code && (
                          <DocField label="Despesa">
                            <span className="font-semibold text-sm">
                              {getDespesaNome(sol.despesa_code)}
                            </span>
                          </DocField>
                        )}
                        {sol.cost_center_code && (
                          <DocField label="Centro de Custo">
                            <span className="font-mono font-bold text-sm">
                              {sol.cost_center_code}
                            </span>
                          </DocField>
                        )}
                        {sol.rateio_percentual != null && (
                          <DocField label="Rateio">
                            <span className="font-semibold text-sm">
                              {sol.rateio_percentual}%
                            </span>
                          </DocField>
                        )}
                      </div>
                    )}
                    {sol.chave_pix && (
                      <div className="grid grid-cols-1">
                        <DocField label="Chave PIX">
                          <span className="font-mono text-sm break-all select-all bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
                            {sol.chave_pix}
                          </span>
                        </DocField>
                      </div>
                    )}
                    {sol.codigo_barras && (
                      <div className="grid grid-cols-1">
                        <DocField label="Código de Barras / Linha Digitável">
                          <span className="font-mono text-sm break-all select-all bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {sol.codigo_barras}
                          </span>
                        </DocField>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Compra: lista de produtos e marca/modelo */}
            {sol.tipo_solicitacao === 'compra' &&
              (sol.descricao || sol.marca_modelo) && (
                <div className="border-2 border-[#000638] rounded-xl overflow-hidden">
                  <div className="bg-[#000638] px-4 py-2">
                    <span className="text-white font-extrabold text-xs tracking-widest uppercase">
                      Detalhes da Compra
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {sol.descricao && (
                      <div className="grid grid-cols-1">
                        <DocField label="Produtos que deseja comprar">
                          <p className="text-sm whitespace-pre-wrap text-gray-700">
                            {sol.descricao}
                          </p>
                        </DocField>
                      </div>
                    )}
                    {sol.marca_modelo && (
                      <div className="grid grid-cols-1">
                        <DocField label="Marca / Modelo">
                          <p className="text-sm text-gray-700">
                            {sol.marca_modelo}
                          </p>
                        </DocField>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Manutenção: serviço e recomendação de fornecedores */}
            {sol.tipo_solicitacao === 'manutencao' &&
              (sol.descricao || sol.recomendacao_fornecedores) && (
                <div className="border-2 border-[#000638] rounded-xl overflow-hidden">
                  <div className="bg-[#000638] px-4 py-2">
                    <span className="text-white font-extrabold text-xs tracking-widest uppercase">
                      Detalhes da Manutenção
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {sol.descricao && (
                      <div className="grid grid-cols-1">
                        <DocField label="Serviço a ser contratado">
                          <p className="text-sm whitespace-pre-wrap text-gray-700">
                            {sol.descricao}
                          </p>
                        </DocField>
                      </div>
                    )}
                    {sol.recomendacao_fornecedores && (
                      <div className="grid grid-cols-1">
                        <DocField label="Recomendação de Fornecedores">
                          <p className="text-sm whitespace-pre-wrap text-gray-700">
                            {sol.recomendacao_fornecedores}
                          </p>
                        </DocField>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* ── ANEXOS / REFERÊNCIAS ── */}
            {(sol.comprovante_gestor_url ||
              sol.comprovante_fabio_url ||
              sol.comprovante_url ||
              sol.link_exemplo ||
              (Array.isArray(sol.imagens_exemplo_urls) &&
                sol.imagens_exemplo_urls.length > 0) ||
              (Array.isArray(sol.contatos_prestadores) &&
                sol.contatos_prestadores.some(
                  (c) => c.nome || c.telefone,
                ))) && (
              <div className="border-2 border-[#000638] rounded-xl overflow-hidden">
                <div className="bg-[#000638] px-4 py-2">
                  <span className="text-white font-extrabold text-xs tracking-widest uppercase">
                    Anexos & Referências
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {/* Comprovante aprovação Gestor */}
                  {sol.comprovante_gestor_url && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">
                        Comprovante — Aprovação do Gestor
                      </p>
                      <a
                        href={sol.comprovante_gestor_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {/\.(jpe?g|png|gif|webp)$/i.test(
                          sol.comprovante_gestor_url,
                        ) ? (
                          <img
                            src={sol.comprovante_gestor_url}
                            alt="Aprovação Gestor"
                            className="max-h-72 rounded-lg border object-contain bg-gray-50 w-full hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-blue-700 underline">
                            <LinkIcon size={14} weight="bold" /> Ver arquivo
                          </div>
                        )}
                      </a>
                    </div>
                  )}

                  {/* Comprovante aprovação Fábio */}
                  {sol.comprovante_fabio_url && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">
                        Comprovante — Aprovação do Fábio
                      </p>
                      <a
                        href={sol.comprovante_fabio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {/\.(jpe?g|png|gif|webp)$/i.test(
                          sol.comprovante_fabio_url,
                        ) ? (
                          <img
                            src={sol.comprovante_fabio_url}
                            alt="Aprovação Fábio"
                            className="max-h-72 rounded-lg border object-contain bg-gray-50 w-full hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-blue-700 underline">
                            <LinkIcon size={14} weight="bold" /> Ver arquivo
                          </div>
                        )}
                      </a>
                    </div>
                  )}

                  {/* Comprovante de pagamento (reembolso) */}
                  {sol.comprovante_url && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">
                        Comprovante de Pagamento
                      </p>
                      <a
                        href={sol.comprovante_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {/\.(jpe?g|png|gif|webp)$/i.test(
                          sol.comprovante_url,
                        ) ? (
                          <img
                            src={sol.comprovante_url}
                            alt="Comprovante"
                            className="max-h-72 rounded-lg border object-contain bg-gray-50 w-full hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-blue-700 underline">
                            <LinkIcon size={14} weight="bold" /> Ver comprovante
                          </div>
                        )}
                      </a>
                    </div>
                  )}

                  {/* Link de referência */}
                  {sol.link_exemplo && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                        Link de Referência
                      </p>
                      <a
                        href={sol.link_exemplo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-700 underline break-all hover:text-blue-900"
                      >
                        <LinkIcon
                          size={14}
                          weight="bold"
                          className="shrink-0"
                        />
                        {sol.link_exemplo}
                      </a>
                    </div>
                  )}

                  {/* Imagens de referência */}
                  {Array.isArray(sol.imagens_exemplo_urls) &&
                    sol.imagens_exemplo_urls.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">
                          Imagens de Referência (
                          {sol.imagens_exemplo_urls.length})
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {sol.imagens_exemplo_urls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {/\.(jpe?g|png|gif|webp)$/i.test(url) ? (
                                <img
                                  src={url}
                                  alt={`Ref ${i + 1}`}
                                  className="w-full h-32 object-cover rounded-lg border hover:opacity-80 transition-opacity bg-gray-50"
                                />
                              ) : (
                                <div className="flex items-center gap-1 text-xs text-blue-700 underline p-2 border rounded-lg bg-gray-50">
                                  <LinkIcon size={12} /> Arquivo {i + 1}
                                </div>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Contatos de prestadores */}
                  {Array.isArray(sol.contatos_prestadores) &&
                    sol.contatos_prestadores.some(
                      (c) => c.nome || c.telefone,
                    ) && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">
                          Contatos de Prestadores
                        </p>
                        <div className="space-y-2">
                          {sol.contatos_prestadores
                            .filter((c) => c.nome || c.telefone)
                            .map((c, i) => (
                              <div
                                key={i}
                                className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm bg-gray-50 border rounded-lg px-3 py-2"
                              >
                                {c.nome && (
                                  <span className="font-semibold text-[#000638]">
                                    {c.nome}
                                  </span>
                                )}
                                {c.telefone && (
                                  <a
                                    href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-700 hover:underline font-mono"
                                  >
                                    {c.telefone}
                                  </a>
                                )}
                                {c.observacao && (
                                  <span className="text-gray-500 w-full text-xs">
                                    {c.observacao}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* ── HISTÓRICO ── */}
            <div className="border-2 border-[#000638] rounded-xl overflow-hidden">
              <div className="bg-[#000638] px-4 py-2">
                <span className="text-white font-extrabold text-xs tracking-widest uppercase">
                  Histórico de Aprovações
                </span>
              </div>
              <div className="p-4">
                {!sol.aprovado_gestor_em &&
                !sol.aprovado_financeiro_em &&
                !sol.rejeitado_em ? (
                  <p className="text-xs text-gray-400 italic">
                    Aguardando aprovação inicial.
                  </p>
                ) : (
                  <div className="relative pl-5 space-y-3">
                    <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-gray-200" />
                    {sol.aprovado_gestor_em && (
                      <TimelineItem
                        color="bg-blue-500"
                        label="Aprovado pelo Gestor"
                        value={`${sol.aprovado_gestor_por_nome || '--'} · ${formatarDataHora(sol.aprovado_gestor_em)}`}
                      />
                    )}
                    {sol.aprovado_financeiro_em && (
                      <TimelineItem
                        color="bg-indigo-500"
                        label="Aprovado pelo Financeiro"
                        value={`${sol.aprovado_financeiro_por_nome || '--'} · ${formatarDataHora(sol.aprovado_financeiro_em)}`}
                      />
                    )}
                    {sol.enviado_totvs_em && (
                      <TimelineItem
                        color="bg-green-500"
                        label="Enviado ao TOTVS"
                        value={formatarDataHora(sol.enviado_totvs_em)}
                      />
                    )}
                    {sol.rejeitado_em && (
                      <TimelineItem
                        color="bg-red-500"
                        label={`Rejeitado por ${sol.rejeitado_por_nome || '--'}`}
                        value={`${formatarDataHora(sol.rejeitado_em)}${sol.motivo_rejeicao ? ` · ${sol.motivo_rejeicao}` : ''}`}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* fim p-5 */}

          {/* ── AÇÕES ── */}
          <div className="border-t-2 border-[#000638]/10 px-5 py-4 bg-gray-50 rounded-b-xl flex flex-wrap gap-2 items-center">
            {/* STATUS SECUNDÁRIO — compra/manutencao após aprovação financeira */}
            {TIPOS_COM_STATUS_SEC.includes(sol.tipo_solicitacao) &&
              !['rejeitado', 'cancelada'].includes(sol.status) &&
              isFinanceiro && (
                <div className="flex items-center gap-2 w-full pb-2 border-b border-gray-200 mb-1">
                  <span className="text-[11px] font-bold text-gray-600 shrink-0">
                    Etapa:
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {STATUS_SECUNDARIO.map((s) => (
                      <button
                        key={s.value}
                        onClick={() =>
                          onAtualizarStatusSecundario(
                            sol,
                            sol.status_secundario === s.value ? null : s.value,
                          )
                        }
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border-2 ${
                          sol.status_secundario === s.value
                            ? `${s.color} border-current shadow-sm`
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* Exibição apenas (não-financeiro) quando há status secundário */}
            {TIPOS_COM_STATUS_SEC.includes(sol.tipo_solicitacao) &&
              sol.status_secundario &&
              !isFinanceiro &&
              (() => {
                const sec = STATUS_SECUNDARIO.find(
                  (s) => s.value === sol.status_secundario,
                );
                return sec ? (
                  <div className="flex items-center gap-2 w-full pb-2 border-b border-gray-200 mb-1">
                    <span className="text-[11px] font-bold text-gray-600">
                      Etapa:
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${sec.color}`}
                    >
                      {sec.label}
                    </span>
                  </div>
                ) : null;
              })()}
            {podeAprovarGestor && (
              <button
                onClick={() => onAprovarGestor(sol)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <ShieldCheck size={14} weight="bold" />
                Aprovar como Gestor
              </button>
            )}
            {podeAprovarFinanceiro && (
              <button
                onClick={() => onAprovarFinanceiro(sol)}
                disabled={enviandoTotvs}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                {enviandoTotvs ? (
                  <Spinner size={14} className="animate-spin" />
                ) : (
                  <CloudArrowUp size={14} weight="bold" />
                )}
                Aprovar Financeiro & Enviar ao TOTVS
              </button>
            )}
            {podeDevolver && (
              <button
                onClick={async () => {
                  if (await onDevolverParaGestor(sol)) onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
              >
                <ArrowUUpLeft size={14} weight="bold" />
                Devolver para Gestor
              </button>
            )}
            {podeReenviar && (
              <button
                onClick={() => onReenviar(sol)}
                disabled={enviandoTotvs}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
              >
                {enviandoTotvs ? (
                  <Spinner size={14} className="animate-spin" />
                ) : (
                  <ArrowClockwise size={14} weight="bold" />
                )}
                Reenviar ao TOTVS
              </button>
            )}
            {podeLiberarPagamento && (
              <button
                onClick={() => onLiberarPagamento(sol)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                title="Cria um registro na Liberação de Pagamentos e vincula esta solicitação"
              >
                <HandCoins size={14} weight="bold" />
                Liberar para Pagamento
              </button>
            )}
            {jaLiberadoPagamento && (
              <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle size={14} weight="fill" />
                Liberado p/ pagamento
                {sol.liberado_pagamento_em && (
                  <span className="font-normal text-emerald-600 ml-1">
                    em{' '}
                    {new Date(sol.liberado_pagamento_em).toLocaleDateString(
                      'pt-BR',
                    )}
                  </span>
                )}
              </span>
            )}
            {podeRejeitar && (
              <button
                onClick={() => onRejeitar(sol)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              >
                <XCircle size={14} weight="bold" />
                Rejeitar
              </button>
            )}
            {!podeAprovarGestor &&
              !podeAprovarFinanceiro &&
              !podeReenviar &&
              !podeRejeitar &&
              !podeDevolver &&
              !podeLiberarPagamento &&
              !jaLiberadoPagamento && (
                <p className="text-xs text-gray-400 italic">
                  Nenhuma ação disponível para o status atual ou para o seu
                  perfil.
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// MODAL EDIÇÃO
// =====================================================================
const inpCls =
  'w-full border-2 border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#000638] transition-colors bg-white';

const ELabel = ({ children }) => (
  <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wide mb-1">
    {children}
  </p>
);

// Combobox de despesas (reutilizado do formulário original)
const DespesaComboCrosby = ({ value, onChange }) => {
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const selectedLabel = value
    ? `${value} — ${DESPESAS_JSON[String(value)] || value}`
    : '';
  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return DESPESAS_OPTIONS;
    return DESPESAS_OPTIONS.filter(
      ([code, name]) => code.includes(q) || name.toLowerCase().includes(q),
    );
  }, [search]);
  React.useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? search : selectedLabel}
        placeholder="Digite código ou nome..."
        className={inpCls}
        onFocus={() => {
          setSearch('');
          setOpen(true);
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border-2 border-[#000638] rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400 italic">
              Nenhuma despesa encontrada
            </div>
          ) : (
            filtered.map(([code, name]) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  onChange(code);
                  setSearch('');
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#000638] hover:text-white transition-colors flex gap-2 ${value === code ? 'bg-[#000638]/10 font-bold' : ''}`}
              >
                <span className="font-mono shrink-0">{code}</span>
                <span className="truncate">{name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const PortadorComboCrosby = ({ value, onChange }) => {
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const selectedLabel = value
    ? `${value} — ${PORTADORES_JSON[String(value)] || value}`
    : '';
  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return PORTADORES_OPTIONS;
    return PORTADORES_OPTIONS.filter(
      ([code, name]) => code.includes(q) || name.toLowerCase().includes(q),
    );
  }, [search]);
  React.useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? search : selectedLabel}
        placeholder="Digite código ou nome do portador..."
        className={inpCls}
        onFocus={() => {
          setSearch('');
          setOpen(true);
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border-2 border-[#000638] rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400 italic">
              Nenhum portador encontrado
            </div>
          ) : (
            filtered.map(([code, name]) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  onChange(code);
                  setSearch('');
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#000638] hover:text-white transition-colors flex gap-2 ${String(value) === code ? 'bg-[#000638]/10 font-bold' : ''}`}
              >
                <span className="font-mono shrink-0">{code}</span>
                <span className="truncate">{name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const ModalEdicao = ({
  sol,
  onClose,
  onSalvar,
  onDevolverParaGestor,
  isGestor,
  isFinanceiro,
  podeDevolver,
  onFecharTudo,
}) => {
  const payload = sol.payload_totvs || {};
  const instOrig = payload.installments || [];

  // ── Estado editável ────────────────────────────────────────────────
  const [tipo, setTipo] = React.useState(sol.tipo_solicitacao || '');
  const [solicitante, setSolicitante] = React.useState(sol.solicitante || '');
  const [setor, setSetor] = React.useState(sol.setor || '');
  const [solicitanteEmail, setSolicitanteEmail] = React.useState(
    sol.solicitante_email || '',
  );
  const [descricao, setDescricao] = React.useState(sol.descricao || '');
  const [observacao, setObservacao] = React.useState(sol.observacao || '');
  const [formaPagamento, setFormaPagamento] = React.useState(
    sol.forma_pagamento || '',
  );
  const [supplierCpfCnpj, setSupplierCpfCnpj] = React.useState(
    sol.supplier_cpf_cnpj || '',
  );
  const [supplierName, setSupplierName] = React.useState(
    sol.supplier_name || '',
  );
  const [buscandoFornecedor, setBuscandoFornecedor] = React.useState(false);
  const [modalCadastroForn, setModalCadastroForn] = React.useState(false);
  const [duplicateCode, setDuplicateCode] = React.useState(
    sol.duplicate_code || '',
  );

  // Tipo-específico: reembolso
  const [comprovanteUrl, setComprovanteUrl] = React.useState(
    sol.comprovante_url || '',
  );
  const [comprovanteFile, setComprovanteFile] = React.useState(null);

  // Tipo-específico: compra
  const [linkExemplo, setLinkExemplo] = React.useState(sol.link_exemplo || '');
  const [imagensExemploUrls, setImagensExemploUrls] = React.useState(
    Array.isArray(sol.imagens_exemplo_urls) ? sol.imagens_exemplo_urls : [],
  );
  const [imagensNovasFiles, setImagensNovasFiles] = React.useState([]);

  // Tipo-específico: manutencao
  const [contatosPrestadores, setContatosPrestadores] = React.useState(() => {
    const saved = Array.isArray(sol.contatos_prestadores)
      ? sol.contatos_prestadores
      : [];
    return saved.length > 0
      ? saved
      : [{ nome: '', telefone: '', observacao: '' }];
  });

  // Parcelas
  const [parcelas, setParcelas] = React.useState(() =>
    instOrig.length > 0
      ? instOrig.map((p) => ({
          installmentCode: p.installmentCode ?? 1,
          bearerCode: String(p.bearerCode ?? ''),
          dueDate: p.dueDate ? p.dueDate.slice(0, 10) : '',
          duplicateValue: p.duplicateValue ?? '',
          expenses: (p.expenses || []).map((e) => ({
            expenseCode: String(e.expenseCode ?? ''),
            costCenterCode: String(e.costCenterCode ?? ''),
            proratedPercentage: e.proratedPercentage ?? 100,
          })),
        }))
      : [
          {
            installmentCode: 1,
            bearerCode: '',
            dueDate: '',
            duplicateValue: '',
            expenses: [
              { expenseCode: '', costCenterCode: '', proratedPercentage: 100 },
            ],
          },
        ],
  );
  const [salvando, setSalvando] = React.useState(false);
  const [parcelaIdx, setParcelaIdx] = React.useState(0);

  // Pagamento / Reembolso — fluxo simplificado
  const [dtEmissao, setDtEmissao] = React.useState(
    sol.dt_emissao ? sol.dt_emissao.slice(0, 10) : '',
  );
  const [dtVencimento, setDtVencimento] = React.useState(
    sol.dt_vencimento ? sol.dt_vencimento.slice(0, 10) : '',
  );
  const [despesaCode, setDespesaCode] = React.useState(
    sol.despesa_code ? String(sol.despesa_code) : '',
  );
  const [costCenterCode, setCostCenterCode] = React.useState(
    sol.cost_center_code ? String(sol.cost_center_code) : '',
  );
  const [rateioPercentual, setRateioPercentual] = React.useState(
    sol.rateio_percentual != null ? String(sol.rateio_percentual) : '100',
  );
  const [valorUnico, setValorUnico] = React.useState(
    sol.valor_total ? String(sol.valor_total) : '',
  );
  const [chavePix, setChavePix] = React.useState(sol.chave_pix || '');
  const [codigoBarras, setCodigoBarras] = React.useState(
    sol.codigo_barras || '',
  );

  const SETORES = [
    'VAREJO',
    'FINANCEIRO',
    'RH',
    'MULTIMARCAS',
    'REVENDA',
    'PRODUÇÃO',
    'EXPEDIÇÃO',
    'MARKETING',
    'TRÁFEGO',
    'TECNOLOGIA',
    'CENTRAL DE FRANQUIAS',
  ];
  const TIPOS = [
    { value: 'pagamento', label: 'Pagamento' },
    { value: 'reembolso', label: 'Reembolso' },
    { value: 'compra', label: 'Compra' },
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'rh', label: 'RH' },
  ];

  const onlyDigits = (v) => String(v || '').replace(/\D+/g, '');

  // ── Upload helper ──────────────────────────────────────────────────
  const uploadArquivo = async (file, prefix) => {
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  // ── Fornecedor ─────────────────────────────────────────────────────
  const buscarFornecedor = async () => {
    const digits = onlyDigits(supplierCpfCnpj);
    if (digits.length !== 11 && digits.length !== 14) return;
    setBuscandoFornecedor(true);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/supplier/search?cpfCnpj=${digits}`,
      );
      if (resp.status === 404) {
        setSupplierName('');
        setModalCadastroForn(true);
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setSupplierName(data?.data?.name || '');
    } catch (err) {
      console.error('Erro ao buscar fornecedor:', err);
    } finally {
      setBuscandoFornecedor(false);
    }
  };

  // ── Parcelas ───────────────────────────────────────────────────────
  const addParcela = () => {
    const last = parcelas[parcelas.length - 1];
    let nextDate = '';
    if (last?.dueDate) {
      const d = new Date(last.dueDate + 'T12:00:00');
      d.setMonth(d.getMonth() + 1);
      nextDate = d.toISOString().slice(0, 10);
    }
    setParcelas([
      ...parcelas,
      {
        installmentCode: (last?.installmentCode ?? parcelas.length) + 1,
        bearerCode: last?.bearerCode ?? '',
        dueDate: nextDate,
        duplicateValue: '',
        expenses: [
          {
            expenseCode: last?.expenses?.[0]?.expenseCode ?? '',
            costCenterCode: last?.expenses?.[0]?.costCenterCode ?? '',
            proratedPercentage: 100,
          },
        ],
      },
    ]);
    setParcelaIdx(parcelas.length);
  };
  const removeParcela = (i) => {
    if (parcelas.length <= 1) return;
    const next = parcelas.filter((_, idx) => idx !== i);
    setParcelas(next);
    setParcelaIdx(Math.min(parcelaIdx, next.length - 1));
  };
  const updateParcela = (i, patch) =>
    setParcelas((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  const addExpense = (pi) =>
    setParcelas((prev) =>
      prev.map((p, idx) =>
        idx === pi
          ? {
              ...p,
              expenses: [
                ...p.expenses,
                { expenseCode: '', costCenterCode: '', proratedPercentage: '' },
              ],
            }
          : p,
      ),
    );
  const removeExpense = (pi, ei) =>
    setParcelas((prev) =>
      prev.map((p, idx) =>
        idx === pi
          ? { ...p, expenses: p.expenses.filter((_, j) => j !== ei) }
          : p,
      ),
    );
  const updateExpense = (pi, ei, patch) =>
    setParcelas((prev) =>
      prev.map((p, idx) =>
        idx === pi
          ? {
              ...p,
              expenses: p.expenses.map((e, j) =>
                j === ei ? { ...e, ...patch } : e,
              ),
            }
          : p,
      ),
    );

  // ── Contatos prestadores ───────────────────────────────────────────
  const addContato = () =>
    setContatosPrestadores((prev) => [
      ...prev,
      { nome: '', telefone: '', observacao: '' },
    ]);
  const removeContato = (i) =>
    setContatosPrestadores((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [{ nome: '', telefone: '', observacao: '' }];
    });
  const updateContato = (i, patch) =>
    setContatosPrestadores((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );

  // ── Build payload TOTVS ────────────────────────────────────────────
  const buildPayload = () => {
    const newInst = parcelas.map((p) => ({
      ...(instOrig.find((o) => o.installmentCode === p.installmentCode) || {}),
      installmentCode: p.installmentCode,
      bearerCode: parseInt(p.bearerCode) || undefined,
      dueDate: p.dueDate ? p.dueDate + 'T15:00:00.000Z' : undefined,
      duplicateValue: parseFloat(p.duplicateValue) || 0,
      expenses: p.expenses.map((e) => ({
        expenseCode: parseInt(e.expenseCode) || undefined,
        costCenterCode: parseInt(e.costCenterCode) || undefined,
        proratedPercentage: parseFloat(e.proratedPercentage) || 100,
      })),
    }));
    return {
      ...payload,
      supplierCpfCnpj: onlyDigits(supplierCpfCnpj) || payload.supplierCpfCnpj,
      duplicateCode: parseInt(duplicateCode) || payload.duplicateCode,
      installments: newInst,
    };
  };

  // ── Salvar ─────────────────────────────────────────────────────────
  const handleSalvar = async () => {
    setSalvando(true);
    try {
      let novoComprovanteUrl = comprovanteUrl;
      if (comprovanteFile) {
        novoComprovanteUrl = await uploadArquivo(
          comprovanteFile,
          'comprovantes',
        );
      }
      let novasImagensUrls = [...imagensExemploUrls];
      for (const file of imagensNovasFiles) {
        const url = await uploadArquivo(file, 'imagens-compra');
        novasImagensUrls.push(url);
      }
      const exigeFluxoSimplesLocal =
        (tipo || sol.tipo_solicitacao) === 'pagamento' ||
        (tipo || sol.tipo_solicitacao) === 'reembolso';
      // Para pagamento/reembolso: sempre constrói installments a partir dos
      // estados editáveis (dtVencimento, despesaCode, etc.) + bearerCode da
      // primeira parcela se preenchido pelo financeiro.
      const buildPayloadPagSimples = () => {
        const bearerRaw = parcelas[0]?.bearerCode;
        const bearer = bearerRaw ? parseInt(bearerRaw) : null;
        return {
          branchCnpj: onlyDigits(sol.branch_cnpj) || '',
          supplierCpfCnpj:
            onlyDigits(supplierCpfCnpj) ||
            onlyDigits(sol.supplier_cpf_cnpj) ||
            '',
          duplicateCode: duplicateCode
            ? parseInt(duplicateCode)
            : sol.duplicate_code
              ? parseInt(sol.duplicate_code)
              : null,
          installments: [
            {
              installmentCode: 1,
              bearerCode: bearer,
              issueDate: dtEmissao ? `${dtEmissao}T15:00:00.000Z` : null,
              dueDate: dtVencimento ? `${dtVencimento}T15:00:00.000Z` : null,
              arrivalDate: null,
              duplicateValue: parseFloat(valorUnico) || null,
              expenses: despesaCode
                ? [
                    {
                      expenseCode: parseInt(despesaCode),
                      costCenterCode: costCenterCode
                        ? parseInt(costCenterCode)
                        : null,
                      proratedPercentage: parseFloat(rateioPercentual) || 100,
                    },
                  ]
                : [],
            },
          ],
        };
      };
      const newPayload = exigeFluxoSimplesLocal
        ? buildPayloadPagSimples()
        : instOrig.length > 0
          ? buildPayload()
          : {
              ...(sol.payload_totvs || {}),
              duplicateCode:
                parseInt(duplicateCode) || sol.payload_totvs?.duplicateCode,
            };
      const valorTotal = parcelas.reduce(
        (s, p) => s + (parseFloat(p.duplicateValue) || 0),
        0,
      );
      const exigeFluxoSimples = tipo === 'pagamento' || tipo === 'reembolso';
      const toIso = (yyyymmdd) =>
        yyyymmdd ? `${yyyymmdd}T15:00:00.000Z` : null;
      const dados = {
        tipo_solicitacao: tipo || sol.tipo_solicitacao,
        solicitante: solicitante.trim() || sol.solicitante,
        setor: setor || sol.setor,
        solicitante_email: solicitanteEmail.trim() || null,
        descricao: descricao.trim() || sol.descricao,
        observacao: observacao.trim() || null,
        forma_pagamento: formaPagamento || null,
        supplier_cpf_cnpj: onlyDigits(supplierCpfCnpj) || sol.supplier_cpf_cnpj,
        supplier_name: supplierName.trim() || sol.supplier_name,
        duplicate_code: duplicateCode || sol.duplicate_code,
        valor_total: exigeFluxoSimples
          ? parseFloat(valorUnico) || null
          : valorTotal || sol.valor_total,
        payload_totvs: newPayload,
        comprovante_url: tipo === 'reembolso' ? novoComprovanteUrl : null,
        link_exemplo: tipo === 'compra' ? linkExemplo.trim() : null,
        imagens_exemplo_urls: tipo === 'compra' ? novasImagensUrls : [],
        contatos_prestadores:
          tipo === 'manutencao'
            ? contatosPrestadores.filter(
                (c) => c.nome.trim() || c.telefone.trim(),
              )
            : [],
        ...(exigeFluxoSimples && {
          dt_emissao: toIso(dtEmissao),
          dt_vencimento: toIso(dtVencimento),
          despesa_code: despesaCode ? parseInt(despesaCode) : null,
          cost_center_code: costCenterCode ? parseInt(costCenterCode) : null,
          rateio_percentual: rateioPercentual
            ? parseFloat(rateioPercentual)
            : null,
          chave_pix: formaPagamento === 'pix' ? chavePix.trim() || null : null,
          codigo_barras:
            formaPagamento === 'boleto' ? codigoBarras.trim() || null : null,
        }),
      };
      const ok = await onSalvar(sol, dados);
      if (ok) onClose();
    } catch (err) {
      console.error('Erro ao salvar:', err);
    } finally {
      setSalvando(false);
    }
  };

  const handleDevolverEFechar = async () => {
    const ok = await onDevolverParaGestor(sol);
    if (ok) onFecharTudo();
  };

  const p = parcelas[parcelaIdx] || parcelas[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      {modalCadastroForn && (
        <CadastrarFornecedorModal
          cpfCnpj={onlyDigits(supplierCpfCnpj)}
          onClose={() => setModalCadastroForn(false)}
          onSuccess={({ name, cpfCnpj }) => {
            if (cpfCnpj) setSupplierCpfCnpj(cpfCnpj);
            setSupplierName(name || '');
            setModalCadastroForn(false);
          }}
        />
      )}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#000638] text-white px-5 py-3.5 rounded-t-xl flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <PencilSimple size={18} weight="bold" />
            <span className="font-bold">
              Editar Solicitação · #{sol.duplicate_code || sol.id}
            </span>
          </div>
          <button onClick={onClose} className="text-white hover:text-red-300">
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 1 · TIPO */}
          <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold uppercase text-gray-500 tracking-widest">
              Tipo de Solicitação
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={`py-2.5 rounded-lg text-xs font-bold border-2 transition-all ${
                    tipo === t.value
                      ? 'bg-[#000638] text-white border-[#000638]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#000638]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2 · SOLICITANTE */}
          <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold uppercase text-gray-500 tracking-widest">
              Solicitante
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <ELabel>Nome *</ELabel>
                <input
                  className={inpCls}
                  value={solicitante}
                  onChange={(e) => setSolicitante(e.target.value)}
                  placeholder="Nome do solicitante"
                />
              </div>
              <div>
                <ELabel>Setor</ELabel>
                <select
                  className={inpCls}
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {SETORES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <ELabel>E-mail (opcional)</ELabel>
              <input
                className={inpCls}
                type="email"
                value={solicitanteEmail}
                onChange={(e) => setSolicitanteEmail(e.target.value)}
                placeholder="email@empresa.com"
              />
            </div>
          </div>

          {/* 3 · FORNECEDOR */}
          <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold uppercase text-gray-500 tracking-widest">
              Fornecedor
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <ELabel>CPF / CNPJ</ELabel>
                <input
                  className={inpCls}
                  value={supplierCpfCnpj}
                  onChange={(e) => setSupplierCpfCnpj(e.target.value)}
                  placeholder="Digite CPF ou CNPJ"
                  maxLength={18}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={buscarFornecedor}
                  disabled={buscandoFornecedor}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#000638] text-white rounded-lg hover:bg-[#fe0000] disabled:opacity-60 transition-colors shrink-0"
                >
                  {buscandoFornecedor ? (
                    <Spinner size={14} className="animate-spin" />
                  ) : (
                    <MagnifyingGlass size={14} weight="bold" />
                  )}
                  Buscar
                </button>
              </div>
            </div>
            <div>
              <ELabel>Nome do Fornecedor</ELabel>
              <input
                className={inpCls}
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nome (preenchido automaticamente)"
              />
            </div>
          </div>

          {/* 4 · DADOS GERAIS */}
          <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold uppercase text-gray-500 tracking-widest">
              Dados Gerais
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <ELabel>Código da Duplicata</ELabel>
                <input
                  className={inpCls}
                  value={duplicateCode}
                  onChange={(e) => setDuplicateCode(e.target.value)}
                  placeholder="Ex: 9961565"
                />
              </div>
              <div>
                <ELabel>Forma de Pagamento</ELabel>
                <select
                  className={inpCls}
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <ELabel>Data de Emissão</ELabel>
                <input
                  type="date"
                  className={inpCls}
                  value={dtEmissao}
                  onChange={(e) => setDtEmissao(e.target.value)}
                />
              </div>
            </div>
            <div>
              <ELabel>Descrição</ELabel>
              <textarea
                className={inpCls}
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição da solicitação"
              />
            </div>
            <div>
              <ELabel>Observação (opcional)</ELabel>
              <textarea
                className={inpCls}
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Observação adicional"
              />
            </div>
          </div>

          {/* 4b · PAGAMENTO / REEMBOLSO — campos específicos */}
          {(tipo === 'pagamento' || tipo === 'reembolso') && (
            <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase text-gray-500 tracking-widest">
                Detalhes Financeiros
              </p>

              {/* Emissão + Vencimento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <ELabel>Data de Emissão</ELabel>
                  <input
                    type="date"
                    className={inpCls}
                    value={dtEmissao}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDtEmissao(e.target.value)}
                  />
                </div>
                <div>
                  <ELabel>Data de Vencimento *</ELabel>
                  <input
                    type="date"
                    className={inpCls}
                    value={dtVencimento}
                    onChange={(e) => setDtVencimento(e.target.value)}
                  />
                </div>
              </div>

              {/* Despesa */}
              <div>
                <ELabel>Despesa *</ELabel>
                <DespesaComboCrosby
                  value={despesaCode}
                  onChange={setDespesaCode}
                />
              </div>

              {/* Centro de Custo + Rateio + Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <ELabel>Centro de Custo *</ELabel>
                  <select
                    className={inpCls}
                    value={costCenterCode}
                    onChange={(e) => setCostCenterCode(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {CENTROS_CUSTO_OPTIONS.map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} — {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <ELabel>Valor (R$) *</ELabel>
                  <input
                    type="number"
                    className={inpCls}
                    value={valorUnico}
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    onChange={(e) => {
                      setValorUnico(e.target.value);
                      const v = parseFloat(e.target.value);
                      const pct = parseFloat(rateioPercentual);
                      if (
                        !isNaN(v) &&
                        v > 0 &&
                        !isNaN(pct) &&
                        pct > 0 &&
                        pct < 100
                      ) {
                        // valor rateado = total * pct / 100; se o usuário edita o total, mantemos o %
                      }
                    }}
                  />
                </div>
              </div>

              {/* Rateio: % e Valor Rateado sincronizados */}
              <div>
                <ELabel>Rateio</ELabel>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500 mb-0.5">
                      Percentual (%)
                    </p>
                    <input
                      type="number"
                      className={inpCls}
                      value={rateioPercentual}
                      min="1"
                      max="100"
                      step="0.01"
                      placeholder="100"
                      onChange={(e) => {
                        const pct = e.target.value;
                        setRateioPercentual(pct);
                        const pctNum = parseFloat(pct);
                        const totalNum = parseFloat(valorUnico);
                        if (
                          !isNaN(pctNum) &&
                          !isNaN(totalNum) &&
                          totalNum > 0
                        ) {
                          // Calcula valor rateado = total * pct / 100 — apenas exibição
                        }
                      }}
                    />
                  </div>
                  <div className="text-gray-400 text-sm mt-5">↔</div>
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500 mb-0.5">
                      Valor rateado (R$)
                    </p>
                    <input
                      type="number"
                      className={inpCls}
                      step="0.01"
                      min="0"
                      placeholder="auto"
                      value={(() => {
                        const pct = parseFloat(rateioPercentual);
                        const total = parseFloat(valorUnico);
                        if (!isNaN(pct) && !isNaN(total) && total > 0)
                          return ((total * pct) / 100).toFixed(2);
                        return '';
                      })()}
                      onChange={(e) => {
                        const valorRateado = parseFloat(e.target.value);
                        const total = parseFloat(valorUnico);
                        if (
                          !isNaN(valorRateado) &&
                          !isNaN(total) &&
                          total > 0
                        ) {
                          setRateioPercentual(
                            ((valorRateado / total) * 100).toFixed(4),
                          );
                        }
                      }}
                    />
                  </div>
                </div>
                {(() => {
                  const pct = parseFloat(rateioPercentual);
                  const total = parseFloat(valorUnico);
                  if (!isNaN(pct) && !isNaN(total) && total > 0) {
                    return (
                      <p className="text-[10px] text-gray-500 mt-1">
                        {pct.toFixed(2)}% de{' '}
                        {total.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}{' '}
                        ={' '}
                        <strong className="text-[#000638]">
                          {((total * pct) / 100).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </strong>
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Chave PIX */}
              {formaPagamento === 'pix' && (
                <div>
                  <ELabel>Chave PIX *</ELabel>
                  <input
                    className={inpCls}
                    value={chavePix}
                    onChange={(e) => setChavePix(e.target.value)}
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                  />
                </div>
              )}

              {/* Código de Barras */}
              {formaPagamento === 'boleto' && (
                <div>
                  <ELabel>Código de Barras / Linha Digitável *</ELabel>
                  <input
                    className={inpCls}
                    value={codigoBarras}
                    onChange={(e) => setCodigoBarras(e.target.value)}
                    placeholder="Digite o código de barras"
                  />
                </div>
              )}
            </div>
          )}

          {/* 5 · TIPO-ESPECÍFICO */}
          {tipo === 'reembolso' && (
            <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase text-gray-500 tracking-widest">
                Comprovante de Pagamento
              </p>
              {comprovanteUrl && !comprovanteFile && (
                <a
                  href={comprovanteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#000638] font-bold hover:text-[#fe0000] underline"
                >
                  <LinkSimple size={14} weight="bold" /> Ver comprovante atual
                </a>
              )}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-5 cursor-pointer hover:border-[#000638] transition-colors bg-gray-50/40">
                <UploadSimple size={24} className="text-gray-400 mb-1" />
                <span className="text-xs font-bold text-[#000638]">
                  {comprovanteFile
                    ? comprovanteFile.name
                    : 'Substituir comprovante (JPG, PNG, PDF)'}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    if (e.target.files?.[0])
                      setComprovanteFile(e.target.files[0]);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {tipo === 'compra' && (
            <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase text-gray-500 tracking-widest">
                Detalhes da Compra
              </p>
              <div>
                <ELabel>Link de exemplo</ELabel>
                <input
                  className={inpCls}
                  type="url"
                  value={linkExemplo}
                  onChange={(e) => setLinkExemplo(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <ELabel>Imagens de referência</ELabel>
                {imagensExemploUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {imagensExemploUrls.map((url, i) => (
                      <div
                        key={i}
                        className="relative group rounded-lg overflow-hidden border"
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-20 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setImagensExemploUrls((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XCircle size={14} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#000638] transition-colors text-xs text-gray-500">
                  <ImageIcon size={16} className="text-gray-400" />
                  Adicionar imagens
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files)
                        setImagensNovasFiles((prev) =>
                          [...prev, ...Array.from(e.target.files)].slice(0, 8),
                        );
                    }}
                  />
                </label>
                {imagensNovasFiles.length > 0 && (
                  <p className="text-[11px] text-gray-500">
                    {imagensNovasFiles.length} nova(s) imagem(ns) selecionada(s)
                  </p>
                )}
              </div>
            </div>
          )}

          {tipo === 'manutencao' && (
            <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-gray-500 tracking-widest">
                  Contatos de Prestadores
                </p>
                <button
                  type="button"
                  onClick={addContato}
                  className="flex items-center gap-1 text-xs font-bold text-[#000638] hover:text-[#fe0000]"
                >
                  <Plus size={13} weight="bold" /> Adicionar
                </button>
              </div>
              {contatosPrestadores.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr_auto] gap-2 items-end border border-gray-200 rounded-lg p-2 bg-gray-50/40"
                >
                  <div>
                    {i === 0 && <ELabel>Nome</ELabel>}
                    <input
                      className={inpCls}
                      value={c.nome}
                      onChange={(e) =>
                        updateContato(i, { nome: e.target.value })
                      }
                      placeholder="Ex.: João da Silva"
                    />
                  </div>
                  <div>
                    {i === 0 && <ELabel>Telefone</ELabel>}
                    <input
                      className={inpCls}
                      type="tel"
                      value={c.telefone}
                      onChange={(e) =>
                        updateContato(i, { telefone: e.target.value })
                      }
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    {i === 0 && <ELabel>Observação</ELabel>}
                    <input
                      className={inpCls}
                      value={c.observacao}
                      onChange={(e) =>
                        updateContato(i, { observacao: e.target.value })
                      }
                      placeholder="Especialidade, indicação..."
                    />
                  </div>
                  {contatosPrestadores.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContato(i)}
                      className="text-red-500 hover:text-red-700 p-1.5"
                    >
                      <TrashIcon size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 6 · PARCELAS */}
          {parcelas.length > 0 && (
            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-100 px-4 py-2.5 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase text-gray-600 shrink-0">
                  Parcelas
                </span>
                <div className="flex gap-1 flex-wrap">
                  {parcelas.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setParcelaIdx(i)}
                      className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${parcelaIdx === i ? 'bg-[#000638] text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={addParcela}
                  className="flex items-center gap-1 text-xs font-bold text-[#000638] hover:text-[#fe0000] ml-auto"
                >
                  <Plus size={14} weight="bold" /> Add Parcela
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">
                    Parcela {p.installmentCode} / {parcelas.length}
                  </span>
                  {parcelas.length > 1 && (
                    <button
                      onClick={() => removeParcela(parcelaIdx)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <TrashIcon size={12} /> Remover
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <ELabel>Portador (bearerCode) *</ELabel>
                    <PortadorComboCrosby
                      value={p.bearerCode}
                      onChange={(code) =>
                        updateParcela(parcelaIdx, { bearerCode: code })
                      }
                    />
                  </div>
                  <div>
                    <ELabel>Vencimento *</ELabel>
                    <input
                      className={inpCls}
                      type="date"
                      value={p.dueDate}
                      onChange={(e) =>
                        updateParcela(parcelaIdx, { dueDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <ELabel>Valor *</ELabel>
                    <input
                      className={inpCls}
                      type="number"
                      step="0.01"
                      value={p.duplicateValue}
                      onChange={(e) =>
                        updateParcela(parcelaIdx, {
                          duplicateValue: e.target.value,
                        })
                      }
                      placeholder="0,00"
                    />
                  </div>
                </div>

                {/* Rateio */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <ELabel>Rateio de Despesas</ELabel>
                    <button
                      onClick={() => addExpense(parcelaIdx)}
                      className="flex items-center gap-1 text-xs font-bold text-[#000638] hover:text-[#fe0000]"
                    >
                      <Plus size={12} weight="bold" /> Add C.Custo
                    </button>
                  </div>
                  {p.expenses.map((exp, ei) => (
                    <div
                      key={ei}
                      className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-2 items-end"
                    >
                      <div>
                        {ei === 0 && <ELabel>Despesa *</ELabel>}
                        <DespesaComboCrosby
                          value={exp.expenseCode}
                          onChange={(code) =>
                            updateExpense(parcelaIdx, ei, { expenseCode: code })
                          }
                        />
                      </div>
                      <div>
                        {ei === 0 && <ELabel>Centro de Custo *</ELabel>}
                        <select
                          className={inpCls}
                          value={exp.costCenterCode}
                          onChange={(e) =>
                            updateExpense(parcelaIdx, ei, {
                              costCenterCode: e.target.value,
                            })
                          }
                        >
                          <option value="">Selecione...</option>
                          {CENTROS_CUSTO_OPTIONS.map(([code, name]) => (
                            <option key={code} value={code}>
                              {code} — {name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Rateio % ↔ Valor sincronizados */}
                      <div>
                        {ei === 0 && <ELabel>Rateio % / R$</ELabel>}
                        <div className="flex gap-1 items-center">
                          <input
                            className={inpCls}
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={exp.proratedPercentage}
                            onChange={(e) =>
                              updateExpense(parcelaIdx, ei, {
                                proratedPercentage: e.target.value,
                              })
                            }
                            placeholder="%"
                          />
                          <span className="text-gray-400 text-xs shrink-0">
                            ↔
                          </span>
                          <input
                            className={inpCls}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="R$"
                            value={(() => {
                              const pct = parseFloat(exp.proratedPercentage);
                              const total = parseFloat(p.duplicateValue);
                              if (!isNaN(pct) && !isNaN(total) && total > 0)
                                return ((total * pct) / 100).toFixed(2);
                              return '';
                            })()}
                            onChange={(e) => {
                              const valorRateado = parseFloat(e.target.value);
                              const total = parseFloat(p.duplicateValue);
                              if (
                                !isNaN(valorRateado) &&
                                !isNaN(total) &&
                                total > 0
                              ) {
                                updateExpense(parcelaIdx, ei, {
                                  proratedPercentage: (
                                    (valorRateado / total) *
                                    100
                                  ).toFixed(4),
                                });
                              }
                            }}
                          />
                        </div>
                        {(() => {
                          const pct = parseFloat(exp.proratedPercentage);
                          const total = parseFloat(p.duplicateValue);
                          if (!isNaN(pct) && !isNaN(total) && total > 0)
                            return (
                              <p className="text-[9px] text-gray-500 mt-0.5">
                                ={' '}
                                {((total * pct) / 100).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </p>
                            );
                          return null;
                        })()}
                      </div>
                      <div className="flex items-end pb-0.5">
                        {p.expenses.length > 1 && (
                          <button
                            onClick={() => removeExpense(parcelaIdx, ei)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t px-5 py-4 bg-gray-50 rounded-b-xl flex flex-wrap gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Cancelar
          </button>
          {podeDevolver && (
            <button
              onClick={handleDevolverEFechar}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-yellow-100 text-yellow-800 hover:bg-yellow-200 rounded-lg transition-colors"
            >
              <ArrowUUpLeft size={14} weight="bold" /> Devolver para Gestor
            </button>
          )}
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#000638] text-white hover:bg-[#fe0000] disabled:opacity-60 rounded-lg transition-colors"
          >
            {salvando ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <CheckSquare size={14} weight="bold" />
            )}
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="bg-gray-50/60 border rounded-lg p-3">
    <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-2">
      {title}
    </p>
    <div className="space-y-1">{children}</div>
  </div>
);

const Row = ({ label, value, mono, bold }) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-gray-500">{label}</span>
    <span
      className={`text-[#000638] text-right ${mono ? 'font-mono' : ''} ${bold ? 'font-bold' : 'font-semibold'}`}
    >
      {value || '--'}
    </span>
  </div>
);

const DocField = ({ label, children, className = '' }) => (
  <div className={`px-4 py-3 ${className}`}>
    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
      {label}
    </p>
    <div className="text-gray-900">{children}</div>
  </div>
);

const TimelineItem = ({ color, label, value }) => (
  <div className="relative flex gap-3 items-start">
    <div
      className={`absolute -left-5 mt-0.5 w-3 h-3 rounded-full border-2 border-white ${color}`}
    />
    <div>
      <p className="text-xs font-bold text-gray-800">{label}</p>
      <p className="text-xs text-gray-500">{value}</p>
    </div>
  </div>
);

export default SolicitacoesCrosby;
