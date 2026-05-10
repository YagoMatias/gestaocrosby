import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabaseAdmin } from '../lib/supabase';
import { API_BASE_URL } from '../config/constants';
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
  ShieldCheck,
  WarningCircle,
  CloudArrowUp,
  Receipt,
  PencilSimple,
  ArrowUUpLeft,
  Plus,
  Trash as TrashIcon,
  MagnifyingGlass,
} from '@phosphor-icons/react';

import DESPESAS_JSON from '../config/despesas.json';
import CENTROS_CUSTO from '../config/centrosCusto.json';

const CENTROS_CUSTO_OPTIONS = Object.entries(CENTROS_CUSTO).sort(
  (a, b) => parseInt(a[0]) - parseInt(b[0]),
);
const DESPESAS_OPTIONS = Object.entries(DESPESAS_JSON)
  .filter(([code]) => parseInt(code) >= 1000)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

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
};

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
// COMPONENTE
// =====================================================================
const SolicitacoesCrosby = () => {
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [enviandoTotvs, setEnviandoTotvs] = useState(false);

  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const [modalDetalhe, setModalDetalhe] = useState(null);
  const [modalRejeicao, setModalRejeicao] = useState(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [linkCopiado, setLinkCopiado] = useState(false);

  const formularioUrl = `${window.location.origin}/formulario-solicitacoes`;

  // Permissões
  // • isGestor   → manager, admin, owner, financeiro (podem aprovar e editar pendentes)
  // • isFinanceiro → APENAS owner, admin e financeiro (role='user') — ÚNICOS que podem enviar ao TOTVS
  const role = user?.role || user?.user_metadata?.role;
  const isAdmin = role === 'owner' || role === 'admin' || role === 'user'; // owner + admin + financeiro
  const isGestor = isAdmin || role === 'manager';
  const isFinanceiro = isAdmin; // NÃO inclui 'manager' — gestor nunca envia ao TOTVS

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

  // ----- filtros -----
  const solicitacoesFiltradas = useMemo(() => {
    let lista = solicitacoes;
    if (filtroStatus !== 'TODOS')
      lista = lista.filter((s) => s.status === filtroStatus);
    if (filtroTipo !== 'TODOS')
      lista = lista.filter((s) => s.tipo_solicitacao === filtroTipo);
    if (filtroDataInicio) {
      const ini = new Date(filtroDataInicio + 'T00:00:00');
      lista = lista.filter((s) => new Date(s.data_solicitacao) >= ini);
    }
    if (filtroDataFim) {
      const fim = new Date(filtroDataFim + 'T23:59:59');
      lista = lista.filter((s) => new Date(s.data_solicitacao) <= fim);
    }
    return lista;
  }, [solicitacoes, filtroStatus, filtroTipo, filtroDataInicio, filtroDataFim]);

  const totais = useMemo(
    () => ({
      total: solicitacoes.length,
      pendente: solicitacoes.filter((s) => s.status === 'pendente').length,
      aprovado_gestor: solicitacoes.filter(
        (s) => s.status === 'aprovado_gestor',
      ).length,
      aprovado_financeiro: solicitacoes.filter(
        (s) => s.status === 'aprovado_financeiro',
      ).length,
      enviado_totvs: solicitacoes.filter((s) => s.status === 'enviado_totvs')
        .length,
      erro_envio: solicitacoes.filter((s) => s.status === 'erro_envio').length,
      rejeitado: solicitacoes.filter((s) => s.status === 'rejeitado').length,
    }),
    [solicitacoes],
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
      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/accounts-payable/duplicates/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sol.payload_totvs),
        },
      );
      const result = await resp.json().catch(() => ({}));

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
      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/accounts-payable/duplicates/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sol.payload_totvs),
        },
      );
      const result = await resp.json().catch(() => ({}));
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
    setFiltroDataInicio('');
    setFiltroDataFim('');
  };

  // =====================================================================
  // RENDER
  // =====================================================================
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Solicitações Crosby"
        subtitle="Aprovação de solicitações de pagamento, compra e manutenção · Envio de duplicatas ao TOTVS"
        icon={ClipboardText}
        iconColor="text-[#000638]"
      />

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
            <option value="compra">Compra</option>
            <option value="manutencao">Manutenção</option>
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
                    className="border-b hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCfg.color}`}
                      >
                        <StatusIcon size={12} weight="bold" />
                        {statusCfg.label}
                      </span>
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
          onRecarregar={carregarSolicitacoes}
        />
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
    (sol.status === 'aprovado_gestor' && isFinanceiro);
  const podeDevolver = sol.status === 'aprovado_gestor' && isFinanceiro;

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
            {sol.totvs_erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <WarningCircle size={16} weight="bold" />
                  Erro no envio ao TOTVS
                </div>
                <p className="whitespace-pre-wrap text-xs">{sol.totvs_erro}</p>
              </div>
            )}

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
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusCfg.color}`}
                >
                  <StatusIcon size={12} weight="bold" />
                  {statusCfg.label}
                </span>
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

            {/* ── ANEXOS / REFERÊNCIAS ── */}
            {(sol.comprovante_url ||
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
                  {/* Comprovante */}
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
          <div className="border-t-2 border-[#000638]/10 px-5 py-4 bg-gray-50 rounded-b-xl flex flex-wrap gap-2">
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
              !podeDevolver && (
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

  // Estado editável
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
  const [duplicateCode, setDuplicateCode] = React.useState(
    sol.duplicate_code || '',
  );

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

  const onlyDigits = (v) => String(v || '').replace(/\D+/g, '');

  const buscarFornecedor = async () => {
    const cpfCnpj = onlyDigits(supplierCpfCnpj);
    if (cpfCnpj.length < 11) return;
    setBuscandoFornecedor(true);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/supplier/search?cpfCnpj=${cpfCnpj}`,
      );
      const data = await resp.json();
      if (data?.success && data.supplier?.name) {
        setSupplierName(data.supplier.name);
      } else {
        setSupplierName('');
      }
    } catch {
      setSupplierName('');
    } finally {
      setBuscandoFornecedor(false);
    }
  };

  const addParcela = () => {
    const last = parcelas[parcelas.length - 1];
    const nextCode = (last?.installmentCode ?? parcelas.length) + 1;
    // Próximo mês
    let nextDate = '';
    if (last?.dueDate) {
      const d = new Date(last.dueDate + 'T12:00:00');
      d.setMonth(d.getMonth() + 1);
      nextDate = d.toISOString().slice(0, 10);
    }
    setParcelas([
      ...parcelas,
      {
        installmentCode: nextCode,
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
      installments: newInst,
    };
  };

  const handleSalvar = async () => {
    setSalvando(true);
    const newPayload = instOrig.length > 0 ? buildPayload() : sol.payload_totvs;
    const valorTotal = parcelas.reduce(
      (s, p) => s + (parseFloat(p.duplicateValue) || 0),
      0,
    );
    const dados = {
      solicitante: solicitante.trim() || sol.solicitante,
      setor: setor || sol.setor,
      solicitante_email: solicitanteEmail.trim() || null,
      descricao: descricao.trim() || sol.descricao,
      observacao: observacao.trim() || null,
      forma_pagamento: formaPagamento || null,
      supplier_cpf_cnpj: onlyDigits(supplierCpfCnpj) || sol.supplier_cpf_cnpj,
      supplier_name: supplierName.trim() || sol.supplier_name,
      duplicate_code: duplicateCode || sol.duplicate_code,
      valor_total: valorTotal || sol.valor_total,
      payload_totvs: newPayload,
    };
    const ok = await onSalvar(sol, dados);
    setSalvando(false);
    if (ok) onClose();
  };

  const handleDevolverEFechar = async () => {
    const ok = await onDevolverParaGestor(sol);
    if (ok) onFecharTudo();
  };

  const p = parcelas[parcelaIdx] || parcelas[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
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
          {/* SOLICITANTE */}
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

          {/* FORNECEDOR */}
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

          {/* DADOS GERAIS */}
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

          {/* PARCELAS */}
          {parcelas.length > 0 && (
            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              {/* Seletores de parcela */}
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

              {/* Parcela atual */}
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
                  <div>
                    <ELabel>Portador (bearerCode) *</ELabel>
                    <input
                      className={inpCls}
                      type="number"
                      value={p.bearerCode}
                      onChange={(e) =>
                        updateParcela(parcelaIdx, {
                          bearerCode: e.target.value,
                        })
                      }
                      placeholder="Ex: 1020"
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
                      className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 mb-2 items-end"
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
                      <div>
                        {ei === 0 && <ELabel>Rateio %</ELabel>}
                        <input
                          className={inpCls}
                          type="number"
                          min="1"
                          max="100"
                          value={exp.proratedPercentage}
                          onChange={(e) =>
                            updateExpense(parcelaIdx, ei, {
                              proratedPercentage: e.target.value,
                            })
                          }
                          placeholder="100"
                        />
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
