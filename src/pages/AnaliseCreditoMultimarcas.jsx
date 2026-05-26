import React, { useState, useEffect, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import ClientePerfilModal from '../components/ClientePerfilModal';
import { TotvsURL } from '../config/constants';
import {
  MagnifyingGlass,
  ClipboardText,
  CheckCircle,
  XCircle,
  Clock,
  CurrencyDollar,
  User,
  Eye,
  FloppyDisk,
  Warning,
  ArrowClockwise,
  ChartLineUp,
  Buildings,
  IdentificationCard,
  PaperPlaneTilt,
  ListChecks,
  FileText,
} from '@phosphor-icons/react';

const BUCKET_DOCS = 'clientes-confianca';
const SUPABASE_PUBLIC = 'https://dorztqiunewggydvkjnf.supabase.co';

// Roles que podem CONCLUIR a análise (definir limite)
const ROLES_PODE_ANALISAR = ['owner', 'admin', 'user', 'manager'];

function fmtMoeda(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function fmtData(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatCpfCnpj(v) {
  if (!v) return '—';
  const s = String(v).replace(/\D/g, '');
  if (s.length === 11)
    return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (s.length === 14)
    return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
}

function StatusBadge({ status }) {
  const map = {
    pendente: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pendente' },
    aprovada: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Aprovada',
    },
    rejeitada: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejeitada' },
    cancelada: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Cancelada' },
  };
  const cfg = map[status] || map.pendente;
  return (
    <span
      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label.toUpperCase()}
    </span>
  );
}

function TotvsSyncBadge({ status, message }) {
  const map = {
    sincronizado: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      label: 'OK',
    },
    erro: { bg: 'bg-red-100', text: 'text-red-800', label: 'ERRO' },
    pendente: {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      label: 'PENDENTE',
    },
  };
  const cfg = map[status];
  if (!cfg) {
    return (
      <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
        N/A
      </span>
    );
  }
  return (
    <span
      title={message || ''}
      className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

export default function AnaliseCreditoMultimarcas() {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'guest';
  const podeAnalisar = ROLES_PODE_ANALISAR.includes(userRole);

  const [tabAtiva, setTabAtiva] = useState('solicitar');

  // ─── Aba Solicitar ───────────────────────────────────────────────────────
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [erroClientes, setErroClientes] = useState('');
  const [busca, setBusca] = useState('');
  const [tipoBusca, setTipoBusca] = useState('nome'); // nome | fantasia | cnpj | code
  const [buscaJaExecutada, setBuscaJaExecutada] = useState(false);
  const [obsSolicitacao, setObsSolicitacao] = useState('');
  const [clientesJaSolicitados, setClientesJaSolicitados] = useState({}); // {person_code: id|status}

  // Modal perfil
  const [perfilModalAberto, setPerfilModalAberto] = useState(false);
  const [clientePerfilData, setClientePerfilData] = useState(null);

  // ─── Aba Analisar ────────────────────────────────────────────────────────
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState([]);
  const [loadingPendentes, setLoadingPendentes] = useState(false);
  const [analiseAberta, setAnaliseAberta] = useState(null); // solicitação selecionada
  const [limiteInput, setLimiteInput] = useState('');
  const [branchCodeInput, setBranchCodeInput] = useState('2'); // filial padrão para aplicar o limite no TOTVS
  const [obsAnalise, setObsAnalise] = useState('');
  const [salvandoAnalise, setSalvandoAnalise] = useState(false);
  const [dadosClienteAnalise, setDadosClienteAnalise] = useState(null);
  const [loadingDadosCliente, setLoadingDadosCliente] = useState(false);
  const [docsAnalise, setDocsAnalise] = useState([]);
  const [perfilSupabase, setPerfilSupabase] = useState(null);

  // ─── Aba Clientes Analisados ─────────────────────────────────────────────
  const [analisadas, setAnalisadas] = useState([]);
  const [loadingAnalisadas, setLoadingAnalisadas] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Buscar clientes (aba Solicitar) — busca sob demanda em pes_pessoa
  // ──────────────────────────────────────────────────────────────────────────
  const buscarClientes = useCallback(async () => {
    const termo = busca.trim();
    if (!termo) {
      setErroClientes('Digite algo para pesquisar.');
      return;
    }
    if (tipoBusca !== 'code' && tipoBusca !== 'cnpj' && termo.length < 2) {
      setErroClientes('Digite ao menos 2 caracteres.');
      return;
    }
    setLoadingClientes(true);
    setErroClientes('');
    setBuscaJaExecutada(true);
    try {
      const params = new URLSearchParams();
      if (tipoBusca === 'nome') params.set('nome', termo);
      else if (tipoBusca === 'fantasia') params.set('fantasia', termo);
      else if (tipoBusca === 'cnpj')
        params.set('cnpj', termo.replace(/\D/g, ''));
      else if (tipoBusca === 'code')
        params.set('code', termo.replace(/\D/g, ''));

      const resp = await fetch(
        `${TotvsURL}clientes/search-name?${params.toString()}`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      const rows = result?.data?.clientes || result?.clientes || [];
      // Normaliza para o shape usado na UI
      const mapped = rows.map((r) => ({
        code: r.code,
        personCode: r.code,
        name: r.nm_pessoa,
        fantasyName: r.fantasy_name,
        cnpj: r.tipo_pessoa === 'J' ? r.cpf : null,
        cpf: r.tipo_pessoa === 'F' ? r.cpf : null,
        cpfCnpj: r.cpf,
        tipoPessoa: r.tipo_pessoa,
        state: null,
        uf: null,
        empresa: r.cd_empresacad,
        telefone: r.telefone,
        email: r.email,
      }));
      setClientes(mapped);
    } catch (e) {
      console.error('Erro ao buscar clientes:', e);
      setErroClientes('Erro ao buscar clientes.');
      setClientes([]);
    } finally {
      setLoadingClientes(false);
    }
  }, [busca, tipoBusca]);

  const carregarSolicitadosMap = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('analises_credito')
        .select('id, person_code, status')
        .order('solicitado_em', { ascending: false });
      const map = {};
      (data || []).forEach((r) => {
        if (!map[r.person_code]) map[r.person_code] = r;
      });
      setClientesJaSolicitados(map);
    } catch (e) {
      console.warn('Erro ao carregar solicitações existentes:', e.message);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Carregar solicitações pendentes
  // ──────────────────────────────────────────────────────────────────────────
  const carregarPendentes = useCallback(async () => {
    setLoadingPendentes(true);
    try {
      const { data, error } = await supabase
        .from('analises_credito')
        .select('*')
        .eq('status', 'pendente')
        .order('solicitado_em', { ascending: false });
      if (error) throw error;
      setSolicitacoesPendentes(data || []);
    } catch (e) {
      console.error('Erro ao carregar pendentes:', e);
    } finally {
      setLoadingPendentes(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Carregar análises concluídas
  // ──────────────────────────────────────────────────────────────────────────
  const carregarAnalisadas = useCallback(async () => {
    setLoadingAnalisadas(true);
    try {
      const { data, error } = await supabase
        .from('analises_credito')
        .select('*')
        .in('status', ['aprovada', 'rejeitada'])
        .order('aprovado_em', { ascending: false });
      if (error) throw error;
      setAnalisadas(data || []);
    } catch (e) {
      console.error('Erro ao carregar análises concluídas:', e);
    } finally {
      setLoadingAnalisadas(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Effects de carga conforme tab
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tabAtiva === 'solicitar') {
      carregarSolicitadosMap();
    }
    if (tabAtiva === 'analisar') carregarPendentes();
    if (tabAtiva === 'analisadas') carregarAnalisadas();
  }, [tabAtiva, carregarSolicitadosMap, carregarPendentes, carregarAnalisadas]);

  // ──────────────────────────────────────────────────────────────────────────
  // Solicitar análise (aba Solicitar)
  // ──────────────────────────────────────────────────────────────────────────
  const solicitarAnalise = useCallback(
    async (cliente) => {
      if (!cliente) return;
      const personCode = cliente.code || cliente.personCode;
      if (!personCode) {
        alert('Cliente sem código identificador.');
        return;
      }
      if (clientesJaSolicitados[personCode]?.status === 'pendente') {
        alert('Já existe uma análise pendente para este cliente.');
        return;
      }
      const confirmar = confirm(
        `Confirmar solicitação de análise de crédito para:\n\n${cliente.name}\n${formatCpfCnpj(cliente.cnpj || cliente.cpf)}?`,
      );
      if (!confirmar) return;
      try {
        const payload = {
          person_code: personCode,
          cliente_nome: cliente.name || null,
          cliente_cpf_cnpj: cliente.cnpj || cliente.cpf || null,
          cliente_uf: cliente.state || cliente.uf || null,
          solicitado_por: user?.id || null,
          solicitado_por_nome:
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.email ||
            null,
          solicitado_por_email: user?.email || null,
          observacoes_solicitacao: obsSolicitacao.trim() || null,
          status: 'pendente',
        };
        const { error } = await supabase
          .from('analises_credito')
          .insert(payload);
        if (error) throw error;
        setObsSolicitacao('');
        await carregarSolicitadosMap();
        alert(
          'Solicitação enviada com sucesso. Aguarde a análise do financeiro.',
        );
      } catch (e) {
        console.error('Erro ao solicitar:', e);
        alert(`Erro ao solicitar análise: ${e.message}`);
      }
    },
    [user, obsSolicitacao, clientesJaSolicitados, carregarSolicitadosMap],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Abrir detalhes da análise (carrega dados extras TOTVS + Supabase)
  // ──────────────────────────────────────────────────────────────────────────
  const abrirAnalise = useCallback(async (sol) => {
    setAnaliseAberta(sol);
    setLimiteInput(sol.limite_aprovado ? String(sol.limite_aprovado) : '');
    setBranchCodeInput(sol.branch_code ? String(sol.branch_code) : '2');
    setObsAnalise(sol.observacoes_analise || '');
    setDadosClienteAnalise(null);
    setDocsAnalise([]);
    setPerfilSupabase(null);
    setLoadingDadosCliente(true);
    try {
      const personCode = sol.person_code;
      // Estatísticas TOTVS
      const promStats = fetch(`${TotvsURL}person-statistics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personCode }),
      })
        .then((r) => r.json())
        .catch(() => null);
      // CNPJ (QSA)
      const cnpjRaw = (sol.cliente_cpf_cnpj || '').replace(/\D/g, '');
      const promCnpj =
        cnpjRaw.length === 14
          ? fetch(`${TotvsURL}cnpj/${cnpjRaw}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null);
      // Perfil supabase
      const promPerfil = supabase
        .from('clientes_confianca_perfil')
        .select('*')
        .eq('person_code', personCode)
        .maybeSingle();
      // Documentos supabase
      const promDocs = supabase
        .from('clientes_confianca_documentos')
        .select('*')
        .eq('person_code', personCode)
        .order('created_at', { ascending: false });

      const [stats, cnpj, { data: perfil }, { data: docs }] = await Promise.all(
        [promStats, promCnpj, promPerfil, promDocs],
      );
      setDadosClienteAnalise({
        stats: stats?.data || null,
        cnpj: cnpj?.data || null,
      });
      setPerfilSupabase(perfil || null);
      setDocsAnalise(docs || []);
    } catch (e) {
      console.warn('Erro ao carregar dados do cliente:', e.message);
    } finally {
      setLoadingDadosCliente(false);
    }
  }, []);

  const fecharAnalise = useCallback(() => {
    setAnaliseAberta(null);
    setLimiteInput('');
    setBranchCodeInput('2');
    setObsAnalise('');
    setDadosClienteAnalise(null);
    setDocsAnalise([]);
    setPerfilSupabase(null);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Concluir análise (aprovar/rejeitar)
  // ──────────────────────────────────────────────────────────────────────────
  const concluirAnalise = useCallback(
    async (decisao) => {
      if (!analiseAberta || !podeAnalisar) return;
      let limite = null;
      let branchCode = null;
      if (decisao === 'aprovada') {
        limite = parseFloat(String(limiteInput).replace(',', '.'));
        if (!limite || limite <= 0) {
          alert('Informe um limite válido (maior que zero) para aprovar.');
          return;
        }
        branchCode = parseInt(String(branchCodeInput).replace(/\D/g, ''), 10);
        if (!branchCode) {
          alert(
            'Informe a filial (branchCode) para aplicar o limite no TOTVS.',
          );
          return;
        }
      }
      setSalvandoAnalise(true);

      // 1) Atualiza no TOTVS (apenas se aprovação)
      let totvsStatus = null;
      let totvsMsg = null;
      if (decisao === 'aprovada') {
        const cpfCnpjDigits = (analiseAberta.cliente_cpf_cnpj || '').replace(
          /\D/g,
          '',
        );
        const isPJ = cpfCnpjDigits.length === 14;
        const isPF = cpfCnpjDigits.length === 11;
        if (!isPJ && !isPF) {
          totvsStatus = 'erro';
          totvsMsg = 'CPF/CNPJ inválido para sincronizar com TOTVS';
        } else {
          const endpoint = isPJ
            ? `${TotvsURL}cliente/legal-customer`
            : `${TotvsURL}cliente/individual-customer`;
          const totvsPayload = {
            [isPJ ? 'cnpj' : 'cpf']: cpfCnpjDigits,
            name: analiseAberta.cliente_nome,
            branchInsertCode: branchCode,
            limits: [
              {
                branchCode: branchCode,
                saleLimitValue: limite,
                monthlyLimitValue: limite,
              },
            ],
          };
          try {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(totvsPayload),
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) {
              totvsStatus = 'erro';
              totvsMsg =
                data?.message ||
                data?.error ||
                `HTTP ${resp.status} ao atualizar TOTVS`;
            } else {
              totvsStatus = 'sincronizado';
              totvsMsg = data?.message || 'Limite atualizado no TOTVS';
            }
          } catch (e) {
            totvsStatus = 'erro';
            totvsMsg = `Falha ao chamar TOTVS: ${e.message}`;
          }
        }
      }

      // 2) Atualiza registro Supabase
      try {
        const payload = {
          status: decisao,
          limite_aprovado: decisao === 'aprovada' ? limite : null,
          branch_code: decisao === 'aprovada' ? branchCode : null,
          observacoes_analise: obsAnalise.trim() || null,
          aprovado_por: user?.id || null,
          aprovado_por_nome:
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.email ||
            null,
          aprovado_em: new Date().toISOString(),
          totvs_sync_status: totvsStatus,
          totvs_sync_message: totvsMsg,
          totvs_sync_em: totvsStatus ? new Date().toISOString() : null,
        };
        const { error } = await supabase
          .from('analises_credito')
          .update(payload)
          .eq('id', analiseAberta.id);
        if (error) throw error;
        fecharAnalise();
        await carregarPendentes();
        if (decisao === 'aprovada') {
          if (totvsStatus === 'sincronizado') {
            alert(
              'Análise aprovada e limite sincronizado com o TOTVS com sucesso.',
            );
          } else {
            alert(
              `Análise aprovada, mas houve falha ao sincronizar com o TOTVS:\n\n${totvsMsg}\n\nO limite foi registrado no Supabase. Verifique manualmente o cadastro no TOTVS.`,
            );
          }
        } else {
          alert('Análise rejeitada.');
        }
      } catch (e) {
        console.error('Erro ao concluir análise:', e);
        alert(`Erro ao salvar: ${e.message}`);
      } finally {
        setSalvandoAnalise(false);
      }
    },
    [
      analiseAberta,
      podeAnalisar,
      limiteInput,
      branchCodeInput,
      obsAnalise,
      user,
      fecharAnalise,
      carregarPendentes,
    ],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Lista (aba Solicitar) — backend já filtra/limita
  // ──────────────────────────────────────────────────────────────────────────
  const clientesFiltrados = clientes;

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'solicitar', label: 'Solicitar Análise', icon: PaperPlaneTilt },
    {
      id: 'analisar',
      label: `Analisar${solicitacoesPendentes.length ? ` (${solicitacoesPendentes.length})` : ''}`,
      icon: ListChecks,
      restrita: !podeAnalisar,
    },
    { id: 'analisadas', label: 'Clientes Analisados', icon: CheckCircle },
  ];

  const inputCls =
    'w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

  return (
    <div className="px-4 md:px-6 py-4">
      <PageTitle
        title="Análise de Crédito"
        subtitle="Multimarcas — solicitação e aprovação de limite de crédito"
        icon={ChartLineUp}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4 mt-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tabAtiva === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTabAtiva(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-[#000638] text-[#000638]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              } ${t.restrita ? 'opacity-60' : ''}`}
              title={
                t.restrita
                  ? 'Apenas financeiro/admin/owner podem concluir análises'
                  : ''
              }
            >
              <Icon size={14} weight={active ? 'bold' : 'regular'} />
              {t.label}
              {t.restrita && (
                <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">
                  RESTRITO
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Aba SOLICITAR ─────────────────────────────────────────────── */}
      {tabAtiva === 'solicitar' && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col md:flex-row gap-2 items-start md:items-end">
            <div className="w-full md:w-44">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                Buscar por
              </label>
              <select
                className={`${inputCls} mt-1`}
                value={tipoBusca}
                onChange={(e) => setTipoBusca(e.target.value)}
              >
                <option value="nome">Nome</option>
                <option value="fantasia">Nome Fantasia</option>
                <option value="cnpj">CPF / CNPJ</option>
                <option value="code">Código</option>
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                Pesquisar cliente
              </label>
              <div className="relative mt-1">
                <MagnifyingGlass
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  className={`${inputCls} pl-7`}
                  placeholder={
                    tipoBusca === 'code'
                      ? 'Digite o código e pressione Enter'
                      : tipoBusca === 'cnpj'
                        ? 'Digite o CPF/CNPJ (com ou sem máscara)'
                        : tipoBusca === 'fantasia'
                          ? 'Digite o nome fantasia'
                          : 'Digite o nome'
                  }
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      buscarClientes();
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex-1 w-full">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                Observação (opcional)
              </label>
              <input
                type="text"
                className={`${inputCls} mt-1`}
                placeholder="Motivo da análise, urgência, etc."
                value={obsSolicitacao}
                onChange={(e) => setObsSolicitacao(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={buscarClientes}
              disabled={loadingClientes || !busca.trim()}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-[#000638] text-white hover:bg-[#001A6B] flex items-center gap-1 disabled:opacity-50"
            >
              <MagnifyingGlass size={14} />
              Buscar
            </button>
          </div>

          {erroClientes && (
            <div className="p-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded flex items-center gap-2">
              <Warning size={14} weight="bold" /> {erroClientes}
            </div>
          )}

          {loadingClientes ? (
            <div className="py-10 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Buscando clientes...
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">
                        Código
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">
                        Nome
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">
                        CNPJ/CPF
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">
                        UF
                      </th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600">
                        Status
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-600">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-6 text-center text-gray-400"
                        >
                          {buscaJaExecutada
                            ? 'Nenhum cliente encontrado para esta busca.'
                            : 'Use o campo acima para pesquisar um cliente por nome, nome fantasia, CPF/CNPJ ou código.'}
                        </td>
                      </tr>
                    )}
                    {clientesFiltrados.map((c) => {
                      const personCode = c.code || c.personCode;
                      const jaSolicitado = clientesJaSolicitados[personCode];
                      return (
                        <tr
                          key={personCode}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-3 py-2 font-mono text-gray-700">
                            {personCode}
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            <div className="font-semibold">{c.name}</div>
                            {c.fantasyName && (
                              <div className="text-[10px] text-gray-500">
                                {c.fantasyName}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-600">
                            {formatCpfCnpj(c.cnpj || c.cpf)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {c.state || c.uf || '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {jaSolicitado ? (
                              <StatusBadge status={jaSolicitado.status} />
                            ) : (
                              <span className="text-[10px] text-gray-400">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => {
                                  setClientePerfilData({
                                    code: personCode,
                                    name: c.name,
                                    cnpj: c.cnpj || c.cpf,
                                  });
                                  setPerfilModalAberto(true);
                                }}
                                className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1"
                                title="Ver perfil completo"
                              >
                                <Eye size={12} /> Perfil
                              </button>
                              <button
                                onClick={() =>
                                  solicitarAnalise({
                                    ...c,
                                    code: personCode,
                                  })
                                }
                                disabled={jaSolicitado?.status === 'pendente'}
                                className="bg-[#000638] text-white px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 hover:bg-[#001A6B] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <PaperPlaneTilt size={12} /> Analisar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {clientesFiltrados.length >= 50 && (
                <div className="px-3 py-1.5 text-[10px] text-gray-500 bg-gray-50 border-t border-gray-200">
                  Mostrando os 50 primeiros resultados. Refine a busca para ver
                  mais.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Aba ANALISAR ──────────────────────────────────────────────── */}
      {tabAtiva === 'analisar' && (
        <div className="space-y-3">
          {!podeAnalisar && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
              <Warning size={16} weight="bold" className="mt-0.5" />
              <div>
                <strong>Acesso restrito:</strong> apenas usuários com perfil{' '}
                <strong>Financeiro, Administrador ou Proprietário</strong> podem
                concluir análises de crédito. Você pode visualizar as
                solicitações pendentes, mas não confirmar limites.
              </div>
            </div>
          )}

          {analiseAberta ? (
            <DetalheAnalise
              solicitacao={analiseAberta}
              dadosCliente={dadosClienteAnalise}
              perfil={perfilSupabase}
              docs={docsAnalise}
              loading={loadingDadosCliente}
              limiteInput={limiteInput}
              setLimiteInput={setLimiteInput}
              branchCodeInput={branchCodeInput}
              setBranchCodeInput={setBranchCodeInput}
              obsAnalise={obsAnalise}
              setObsAnalise={setObsAnalise}
              salvando={salvandoAnalise}
              podeAnalisar={podeAnalisar}
              onConcluir={concluirAnalise}
              onFechar={fecharAnalise}
              onVerPerfilCompleto={() => {
                setClientePerfilData({
                  code: analiseAberta.person_code,
                  name: analiseAberta.cliente_nome,
                  cnpj: analiseAberta.cliente_cpf_cnpj,
                });
                setPerfilModalAberto(true);
              }}
            />
          ) : (
            <ListaPendentes
              loading={loadingPendentes}
              pendentes={solicitacoesPendentes}
              onAbrir={abrirAnalise}
              onRefresh={carregarPendentes}
            />
          )}
        </div>
      )}

      {/* ─── Aba CLIENTES ANALISADOS ───────────────────────────────────── */}
      {tabAtiva === 'analisadas' && (
        <ListaAnalisadas
          loading={loadingAnalisadas}
          analisadas={analisadas}
          onRefresh={carregarAnalisadas}
          onAbrirPerfil={(a) => {
            setClientePerfilData({
              code: a.person_code,
              name: a.cliente_nome,
              cnpj: a.cliente_cpf_cnpj,
            });
            setPerfilModalAberto(true);
          }}
        />
      )}

      {/* Modal perfil cliente (reutilizado de Clientes MTM) */}
      <ClientePerfilModal
        isOpen={perfilModalAberto}
        onClose={() => {
          setPerfilModalAberto(false);
          setClientePerfilData(null);
        }}
        clienteCode={clientePerfilData?.code}
        clienteNome={clientePerfilData?.name}
        clienteCnpj={clientePerfilData?.cnpj}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Subcomponentes
// ════════════════════════════════════════════════════════════════════════════

function ListaPendentes({ loading, pendentes, onAbrir, onRefresh }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
          <Clock size={14} /> Solicitações pendentes ({pendentes.length})
        </h3>
        <button
          onClick={onRefresh}
          className="text-[10px] flex items-center gap-1 hover:underline text-gray-600"
        >
          <ArrowClockwise size={12} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>
      {loading ? (
        <div className="py-8 text-center text-xs text-gray-500">
          Carregando...
        </div>
      ) : pendentes.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400">
          Nenhuma solicitação pendente no momento.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">
                  Cliente
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">
                  CNPJ/CPF
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">
                  Solicitado por
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">
                  Data
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">
                  Observação
                </th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-100 hover:bg-amber-50/30"
                >
                  <td className="px-3 py-2">
                    <div className="font-semibold text-gray-800">
                      {p.cliente_nome || '—'}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      #{p.person_code} · {p.cliente_uf || ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-600">
                    {formatCpfCnpj(p.cliente_cpf_cnpj)}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {p.solicitado_por_nome || p.solicitado_por_email || '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {fmtData(p.solicitado_em)}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-xs truncate">
                    {p.observacoes_solicitacao || '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onAbrir(p)}
                      className="bg-[#000638] text-white px-2 py-1 rounded text-[10px] font-semibold hover:bg-[#001A6B] flex items-center gap-1 ml-auto"
                    >
                      <Eye size={12} /> Analisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DetalheAnalise({
  solicitacao: s,
  dadosCliente,
  perfil,
  docs,
  loading,
  limiteInput,
  setLimiteInput,
  branchCodeInput,
  setBranchCodeInput,
  obsAnalise,
  setObsAnalise,
  salvando,
  podeAnalisar,
  onConcluir,
  onFechar,
  onVerPerfilCompleto,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-[#000638] text-white rounded-t-lg">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <IdentificationCard size={16} weight="bold" />
            {s.cliente_nome}
          </h3>
          <p className="text-[10px] opacity-80">
            #{s.person_code} · {formatCpfCnpj(s.cliente_cpf_cnpj)} ·{' '}
            {s.cliente_uf || ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onVerPerfilCompleto}
            className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded flex items-center gap-1"
          >
            <Eye size={12} /> Perfil completo
          </button>
          <button
            onClick={onFechar}
            className="text-white hover:bg-white/10 p-1 rounded"
            title="Voltar"
          >
            <XCircle size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
        {/* Coluna 1-2: dados */}
        <div className="md:col-span-2 space-y-3">
          {loading ? (
            <div className="py-6 text-center text-xs text-gray-500">
              Carregando dados do cliente...
            </div>
          ) : (
            <>
              {/* Solicitação */}
              <div className="border border-gray-200 rounded p-2">
                <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1">
                  Solicitação
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Solicitado por:</span>{' '}
                    <strong>{s.solicitado_por_nome || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Em:</span>{' '}
                    <strong>{fmtData(s.solicitado_em)}</strong>
                  </div>
                  {s.observacoes_solicitacao && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Observação:</span>{' '}
                      <em>{s.observacoes_solicitacao}</em>
                    </div>
                  )}
                </div>
              </div>

              {/* Estatísticas TOTVS */}
              {dadosCliente?.stats && (
                <div className="border border-gray-200 rounded p-2">
                  <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1">
                    Histórico financeiro (TOTVS)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <Stat
                      label="Faturamento total"
                      value={fmtMoeda(dadosCliente.stats.totalSales)}
                    />
                    <Stat
                      label="Atraso médio (dias)"
                      value={
                        dadosCliente.stats.averageDelay !== undefined
                          ? `${dadosCliente.stats.averageDelay}`
                          : '—'
                      }
                    />
                    <Stat
                      label="Títulos em aberto"
                      value={dadosCliente.stats.openTitles ?? '—'}
                    />
                    <Stat
                      label="Total inadimplente"
                      value={fmtMoeda(dadosCliente.stats.totalOverdue)}
                    />
                  </div>
                </div>
              )}

              {/* CNPJ / QSA */}
              {dadosCliente?.cnpj && (
                <div className="border border-gray-200 rounded p-2">
                  <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                    <Buildings size={12} /> Dados CNPJ
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Razão social:</span>{' '}
                      <strong>
                        {dadosCliente.cnpj.razao_social ||
                          dadosCliente.cnpj.nome ||
                          '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Situação:</span>{' '}
                      <strong>
                        {dadosCliente.cnpj.situacao ||
                          dadosCliente.cnpj.descricao_situacao_cadastral ||
                          '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Abertura:</span>{' '}
                      <strong>
                        {dadosCliente.cnpj.data_inicio_atividade ||
                          dadosCliente.cnpj.abertura ||
                          '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Capital social:</span>{' '}
                      <strong>
                        {fmtMoeda(dadosCliente.cnpj.capital_social)}
                      </strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Endereço:</span>{' '}
                      <strong>
                        {[
                          dadosCliente.cnpj.logradouro ||
                            dadosCliente.cnpj.descricao_tipo_de_logradouro,
                          dadosCliente.cnpj.numero,
                          dadosCliente.cnpj.bairro,
                          dadosCliente.cnpj.municipio,
                          dadosCliente.cnpj.uf,
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </strong>
                    </div>
                  </div>

                  {dadosCliente.cnpj.qsa?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <h5 className="text-[10px] font-bold uppercase text-gray-500 mb-1">
                        Quadro societário (QSA)
                      </h5>
                      <ul className="space-y-0.5 text-xs">
                        {dadosCliente.cnpj.qsa.map((socio, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <User size={10} className="mt-0.5 text-gray-400" />
                            <span>
                              <strong>{socio.nome_socio || socio.nome}</strong>
                              {(socio.qualificacao_socio ||
                                socio.qual ||
                                socio.cargo) && (
                                <span className="text-gray-500 ml-1">
                                  ·{' '}
                                  {socio.qualificacao_socio ||
                                    socio.qual ||
                                    socio.cargo}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Perfil Supabase (instagram) */}
              {perfil && (perfil.instagram || perfil.foto_path) && (
                <div className="border border-gray-200 rounded p-2">
                  <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1">
                    Perfil do cliente
                  </h4>
                  <div className="flex items-center gap-3">
                    {perfil.foto_path && (
                      <img
                        src={`${SUPABASE_PUBLIC}/storage/v1/object/public/${BUCKET_DOCS}/${perfil.foto_path}`}
                        alt={s.cliente_nome}
                        className="w-16 h-16 rounded object-cover border"
                      />
                    )}
                    {perfil.instagram && (
                      <div className="text-xs">
                        <span className="text-gray-500">Instagram:</span>{' '}
                        <a
                          href={`https://instagram.com/${perfil.instagram.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-600 hover:underline font-semibold"
                        >
                          @{perfil.instagram.replace(/^@/, '')}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Documentos anexados */}
              <div className="border border-gray-200 rounded p-2">
                <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                  <FileText size={12} /> Documentos anexados ({docs.length})
                </h4>
                {docs.length === 0 ? (
                  <p className="text-[10px] text-gray-400">
                    Nenhum documento anexado a este cliente.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {docs.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <span className="truncate">
                          <span className="text-[10px] uppercase text-gray-500 mr-1">
                            [{d.categoria || 'doc'}]
                          </span>
                          {d.nome_arquivo}
                        </span>
                        <a
                          href={`${SUPABASE_PUBLIC}/storage/v1/object/public/${BUCKET_DOCS}/${d.file_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-[10px]"
                        >
                          Abrir
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* Coluna 3: ações */}
        <div className="space-y-3">
          <div className="border-2 border-[#000638] rounded-lg p-3 bg-blue-50/30">
            <h4 className="text-xs font-bold text-[#000638] uppercase mb-2 flex items-center gap-1">
              <CurrencyDollar size={14} weight="bold" /> Definir limite
            </h4>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase">
                  Limite de venda aprovado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full text-sm font-bold border-2 border-gray-300 rounded px-2 py-2 mt-1 focus:outline-none focus:border-[#000638]"
                  placeholder="0,00"
                  value={limiteInput}
                  onChange={(e) => setLimiteInput(e.target.value)}
                  disabled={!podeAnalisar || salvando}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase">
                  Filial (branchCode) — aplicar limite no TOTVS
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 mt-1 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                  placeholder="Ex.: 2"
                  value={branchCodeInput}
                  onChange={(e) => setBranchCodeInput(e.target.value)}
                  disabled={!podeAnalisar || salvando}
                />
                <p className="text-[9px] text-gray-500 mt-0.5">
                  Filial usada como <code>branchCode</code> e{' '}
                  <code>branchInsertCode</code> no payload TOTVS.
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase">
                  Observações da análise
                </label>
                <textarea
                  rows={3}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 mt-1 focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                  placeholder="Justificativa, condições, ressalvas..."
                  value={obsAnalise}
                  onChange={(e) => setObsAnalise(e.target.value)}
                  disabled={!podeAnalisar || salvando}
                />
              </div>

              <button
                onClick={() => onConcluir('aprovada')}
                disabled={!podeAnalisar || salvando}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-xs py-2 rounded flex items-center justify-center gap-1"
              >
                {salvando ? (
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={14} weight="bold" /> Aprovar limite
                  </>
                )}
              </button>
              <button
                onClick={() => onConcluir('rejeitada')}
                disabled={!podeAnalisar || salvando}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-xs py-2 rounded flex items-center justify-center gap-1"
              >
                <XCircle size={14} weight="bold" /> Rejeitar
              </button>
              <button
                onClick={onFechar}
                disabled={salvando}
                className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs py-1.5 rounded"
              >
                Voltar
              </button>
            </div>
            {!podeAnalisar && (
              <p className="text-[10px] text-amber-700 mt-2 flex items-center gap-1">
                <Warning size={10} /> Você não tem permissão para concluir.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListaAnalisadas({ loading, analisadas, onRefresh, onAbrirPerfil }) {
  const aprovadas = analisadas.filter((a) => a.status === 'aprovada');
  const rejeitadas = analisadas.filter((a) => a.status === 'rejeitada');
  const totalLimite = aprovadas.reduce(
    (acc, a) => acc + (parseFloat(a.limite_aprovado) || 0),
    0,
  );

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="bg-white border border-gray-200 rounded p-3">
          <p className="text-[10px] uppercase text-gray-500 font-bold">
            Clientes aprovados
          </p>
          <p className="text-xl font-bold text-green-600">{aprovadas.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded p-3">
          <p className="text-[10px] uppercase text-gray-500 font-bold">
            Total liberado
          </p>
          <p className="text-xl font-bold text-[#000638]">
            {fmtMoeda(totalLimite)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded p-3">
          <p className="text-[10px] uppercase text-gray-500 font-bold">
            Rejeitadas
          </p>
          <p className="text-xl font-bold text-red-600">{rejeitadas.length}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
          <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            <CheckCircle size={14} /> Análises concluídas ({analisadas.length})
          </h3>
          <button
            onClick={onRefresh}
            className="text-[10px] flex items-center gap-1 hover:underline text-gray-600"
          >
            <ArrowClockwise
              size={12}
              className={loading ? 'animate-spin' : ''}
            />
            Atualizar
          </button>
        </div>
        {loading ? (
          <div className="py-8 text-center text-xs text-gray-500">
            Carregando...
          </div>
        ) : analisadas.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            Nenhuma análise concluída ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    Cliente
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    CNPJ/CPF
                  </th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-600">
                    Status
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600">
                    Limite liberado
                  </th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-600">
                    TOTVS
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    Aprovado por
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    Em
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {analisadas.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-100 hover:bg-green-50/30"
                  >
                    <td className="px-3 py-2">
                      <div className="font-semibold text-gray-800">
                        {a.cliente_nome}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        #{a.person_code}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600">
                      {formatCpfCnpj(a.cliente_cpf_cnpj)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-[#000638]">
                      {a.status === 'aprovada'
                        ? fmtMoeda(a.limite_aprovado)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {a.status === 'aprovada' ? (
                        <TotvsSyncBadge
                          status={a.totvs_sync_status}
                          message={a.totvs_sync_message}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {a.aprovado_por_nome || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {fmtData(a.aprovado_em)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => onAbrirPerfil(a)}
                        className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 ml-auto"
                      >
                        <Eye size={12} /> Perfil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase font-bold">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}
