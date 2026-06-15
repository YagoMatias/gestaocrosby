import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabaseAdmin } from '../lib/supabase';
import { API_BASE_URL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import Notification from '../components/ui/Notification';
import CadastrarFornecedorModal from '../components/CadastrarFornecedorModal';
import DESPESAS_JSON from '../config/despesas.json';
import CENTROS_CUSTO from '../config/centrosCusto.json';
import {
  ShoppingCart,
  Wrench,
  Spinner,
  X,
  Eye,
  ArrowClockwise,
  Link as LinkIcon,
  Clock,
  CheckCircle,
  CheckSquare,
  Calendar,
  Storefront,
  User,
  Tag,
  Phone,
  CurrencyCircleDollar,
  CaretDown,
  CaretRight,
  List,
  Kanban,
  PencilSimple,
  FloppyDisk,
  Receipt,
  Warning,
  UploadSimple,
  FileText,
  PaperPlaneTilt,
  Trash,
  ArrowUUpLeft,
  Info,
  MagnifyingGlass,
} from '@phosphor-icons/react';

const ETAPAS = [
  {
    value: null,
    label: 'Aguardando início',
    color: 'bg-gray-100 text-gray-700',
    headerBg: 'bg-gray-200',
    headerText: 'text-gray-700',
    border: 'border-gray-300',
  },
  {
    value: 'em_processo',
    label: 'Em Processo',
    color: 'bg-sky-100 text-sky-800',
    headerBg: 'bg-sky-500',
    headerText: 'text-white',
    border: 'border-sky-300',
  },
  {
    value: 'orcado',
    label: 'Orçado',
    color: 'bg-violet-100 text-violet-800',
    headerBg: 'bg-violet-500',
    headerText: 'text-white',
    border: 'border-violet-300',
  },
  {
    value: 'contratado',
    label: 'Comprado / Contratado',
    color: 'bg-amber-100 text-amber-900',
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
    border: 'border-amber-300',
  },
  {
    value: 'finalizado',
    label: 'Finalizado',
    color: 'bg-teal-100 text-teal-800',
    headerBg: 'bg-teal-600',
    headerText: 'text-white',
    border: 'border-teal-300',
  },
];

const TIPO_CONFIG = {
  compra: {
    label: 'Compra',
    icon: ShoppingCart,
    color: 'bg-blue-100 text-blue-800',
    accent: 'text-blue-600',
  },
  manutencao: {
    label: 'Manutenção',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800',
    accent: 'text-orange-600',
  },
};

const STORAGE_BUCKET = 'solicitacoes-crosby';

const DESPESAS_OPTIONS = Object.entries(DESPESAS_JSON)
  .filter(([code]) => parseInt(code) >= 1000)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

const CENTROS_CUSTO_OPTIONS = Object.entries(CENTROS_CUSTO).sort(
  (a, b) => parseInt(a[0]) - parseInt(b[0]),
);

const getDespesaNome = (code) =>
  code ? DESPESAS_JSON[String(code)] || String(code) : '--';

const fmtDataHora = (data) => {
  if (!data) return '--';
  const d = new Date(data);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString('pt-BR');
};

const fmtData = (val) => {
  if (!val) return '--';
  const s = String(val).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return fmtDataHora(val);
};

const fmtMoeda = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const inpCls =
  'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#000638] bg-white';
const lblCls =
  'text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-0.5 block';

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================
const SolicitacoesCrosbyComprasManutencao = () => {
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [atualizandoId, setAtualizandoId] = useState(null);
  const [enviandoTotvs, setEnviandoTotvs] = useState(false);

  const [visao, setVisao] = useState('kanban');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroSetor, setFiltroSetor] = useState('TODOS');
  const [filtroEtapa, setFiltroEtapa] = useState('TODOS');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [modalDetalhe, setModalDetalhe] = useState(null);

  const role = user?.role || user?.user_metadata?.role;
  const isAdmin = role === 'owner' || role === 'admin' || role === 'user';
  const podeAlterar =
    role === 'owner' ||
    role === 'admin' ||
    role === 'user' ||
    role === 'manager';

  const userNome =
    user?.name ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'Usuário';

  const carregarSolicitacoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .select('*')
        .in('tipo_solicitacao', ['compra', 'manutencao'])
        .not('status', 'in', '("rejeitado","cancelada")')
        .order('data_solicitacao', { ascending: false });
      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (err) {
      console.error(err);
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

  const solicitacoesFiltradas = useMemo(() => {
    let lista = solicitacoes;
    if (filtroTipo !== 'TODOS')
      lista = lista.filter((s) => s.tipo_solicitacao === filtroTipo);
    if (filtroSetor !== 'TODOS')
      lista = lista.filter((s) => s.setor === filtroSetor);
    if (filtroEtapa !== 'TODOS') {
      if (filtroEtapa === 'null')
        lista = lista.filter((s) => !s.status_secundario);
      else lista = lista.filter((s) => s.status_secundario === filtroEtapa);
    }
    if (filtroDataInicio) {
      const inicio = new Date(filtroDataInicio + 'T00:00:00');
      lista = lista.filter(
        (s) => s.data_solicitacao && new Date(s.data_solicitacao) >= inicio,
      );
    }
    if (filtroDataFim) {
      const fim = new Date(filtroDataFim + 'T23:59:59');
      lista = lista.filter(
        (s) => s.data_solicitacao && new Date(s.data_solicitacao) <= fim,
      );
    }
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      lista = lista.filter(
        (s) =>
          (s.solicitante || '').toLowerCase().includes(q) ||
          (s.descricao || '').toLowerCase().includes(q) ||
          (s.supplier_name || '').toLowerCase().includes(q) ||
          (s.marca_modelo || '').toLowerCase().includes(q) ||
          String(s.duplicate_code || '').includes(q),
      );
    }
    return lista;
  }, [
    solicitacoes,
    filtroTipo,
    filtroSetor,
    filtroEtapa,
    filtroDataInicio,
    filtroDataFim,
    busca,
  ]);

  const setoresDisponiveis = useMemo(
    () =>
      Array.from(
        new Set(solicitacoes.map((s) => s.setor).filter(Boolean)),
      ).sort(),
    [solicitacoes],
  );

  const porEtapa = useMemo(() => {
    const map = new Map();
    ETAPAS.forEach((e) => map.set(e.value, []));
    for (const s of solicitacoesFiltradas) {
      const key = s.status_secundario || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return map;
  }, [solicitacoesFiltradas]);

  const totais = useMemo(
    () =>
      ETAPAS.reduce((acc, e) => {
        acc[String(e.value)] = (porEtapa.get(e.value) || []).length;
        return acc;
      }, {}),
    [porEtapa],
  );

  const atualizarEtapa = async (sol, novoStatus) => {
    if (!podeAlterar) {
      notify('error', 'Sem permissão.');
      return;
    }
    setAtualizandoId(sol.id);
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update({ status_secundario: novoStatus })
        .eq('id', sol.id);
      if (error) throw error;
      setSolicitacoes((prev) =>
        prev.map((s) =>
          s.id === sol.id ? { ...s, status_secundario: novoStatus } : s,
        ),
      );
      if (modalDetalhe?.id === sol.id)
        setModalDetalhe((m) => ({ ...m, status_secundario: novoStatus }));
      notify('success', 'Etapa atualizada.');
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao atualizar etapa.');
    } finally {
      setAtualizandoId(null);
    }
  };

  const salvarEdicao = async (solId, patch) => {
    if (!podeAlterar) {
      notify('error', 'Sem permissão.');
      return false;
    }
    try {
      const { error } = await supabaseAdmin
        .from('solicitacoes_crosby')
        .update(patch)
        .eq('id', solId);
      if (error) throw error;
      setSolicitacoes((prev) =>
        prev.map((s) => (s.id === solId ? { ...s, ...patch } : s)),
      );
      if (modalDetalhe?.id === solId)
        setModalDetalhe((m) => ({ ...m, ...patch }));
      notify('success', 'Salvo com sucesso.');
      return true;
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao salvar: ' + (err.message || ''));
      return false;
    }
  };

  const enviarParaTotvs = async (sol) => {
    if (!isAdmin) {
      notify('error', 'Apenas financeiro/admin pode enviar ao TOTVS.');
      return;
    }
    if (sol.tem_nota_fiscal) {
      notify(
        'error',
        'Esta solicitação possui nota fiscal — não envia ao TOTVS.',
      );
      return;
    }
    const onlyDig = (v) => String(v ?? '').replace(/\D+/g, '');
    const payload = {
      branchCnpj: onlyDig(sol.branch_cnpj) || '',
      supplierCpfCnpj: onlyDig(sol.supplier_cpf_cnpj) || '',
      duplicateCode: sol.duplicate_code ? parseInt(sol.duplicate_code) : null,
      installments: [
        {
          installmentCode: 1,
          bearerCode: null,
          issueDate: sol.dt_emissao
            ? String(sol.dt_emissao).slice(0, 10)
            : null,
          dueDate: sol.dt_vencimento
            ? String(sol.dt_vencimento).slice(0, 10)
            : null,
          arrivalDate: null,
          duplicateValue: sol.valor_total ?? null,
          expenses: sol.despesa_code
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
    if (!payload.supplierCpfCnpj) {
      notify('error', 'Preencha o CPF/CNPJ do fornecedor antes de enviar.');
      return;
    }
    if (!payload.branchCnpj) {
      notify('error', 'CNPJ da empresa (filial) não encontrado.');
      return;
    }
    if (!payload.duplicateCode) {
      notify('error', 'Preencha o código da duplicata antes de enviar.');
      return;
    }
    if (!payload.installments[0].dueDate) {
      notify('error', 'Preencha a data de vencimento.');
      return;
    }
    if (!payload.installments[0].duplicateValue) {
      notify('error', 'Preencha o valor.');
      return;
    }
    if (
      !window.confirm(
        `Confirmar envio da duplicata ${sol.duplicate_code} (${sol.supplier_name || ''}) ao TOTVS?`,
      )
    )
      return;
    setEnviandoTotvs(true);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/accounts-payable/duplicates/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok || result?.success === false) {
        const msg = result?.message || `Falha TOTVS (HTTP ${resp.status})`;
        await supabaseAdmin
          .from('solicitacoes_crosby')
          .update({
            status: 'erro_envio',
            totvs_erro: msg,
            totvs_response: result?.details || result || null,
          })
          .eq('id', sol.id);
        const upd = { status: 'erro_envio', totvs_erro: msg };
        setSolicitacoes((prev) =>
          prev.map((s) => (s.id === sol.id ? { ...s, ...upd } : s)),
        );
        if (modalDetalhe?.id === sol.id)
          setModalDetalhe((m) => ({ ...m, ...upd }));
        notify('error', `Erro TOTVS: ${msg}`);
      } else {
        const upd = {
          status: 'enviado_totvs',
          enviado_totvs_em: new Date().toISOString(),
          totvs_response: result?.data ?? result ?? null,
          totvs_erro: null,
        };
        await supabaseAdmin
          .from('solicitacoes_crosby')
          .update(upd)
          .eq('id', sol.id);
        setSolicitacoes((prev) =>
          prev.map((s) => (s.id === sol.id ? { ...s, ...upd } : s)),
        );
        if (modalDetalhe?.id === sol.id)
          setModalDetalhe((m) => ({ ...m, ...upd }));
        notify('success', 'Duplicata enviada com sucesso ao TOTVS!');
      }
    } catch (err) {
      console.error(err);
      notify('error', 'Erro ao enviar: ' + (err.message || ''));
    } finally {
      setEnviandoTotvs(false);
    }
  };

  const limparFiltros = () => {
    setFiltroTipo('TODOS');
    setFiltroSetor('TODOS');
    setFiltroEtapa('TODOS');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setBusca('');
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Compras & Manutenção"
        subtitle="Controle de etapas — Em Processo · Orçado · Comprado/Contratado · Finalizado"
        icon={ShoppingCart}
        iconColor="text-blue-600"
      />

      {/* Cards de etapa (clicáveis para filtrar) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {ETAPAS.map((e) => {
          const filtKey = e.value === null ? 'null' : e.value;
          const ativo = filtroEtapa === filtKey;
          return (
            <button
              key={String(e.value)}
              onClick={() => setFiltroEtapa(ativo ? 'TODOS' : filtKey)}
              className={`p-2.5 rounded-xl border bg-white shadow-sm text-center transition-all hover:shadow-md ${ativo ? `${e.border} ring-2 ring-offset-1` : 'border-gray-200'}`}
            >
              <p className="text-[10px] font-medium text-gray-500">{e.label}</p>
              <p className="text-xl font-extrabold mt-0.5 text-[#000638]">
                {totais[String(e.value)] || 0}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white border rounded-xl p-3 mb-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className={lblCls}>Tipo</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className={inpCls + ' min-w-[120px]'}
          >
            <option value="TODOS">Todos</option>
            <option value="compra">Compra</option>
            <option value="manutencao">Manutenção</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className={lblCls}>Setor</label>
          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value)}
            className={inpCls + ' min-w-[140px]'}
          >
            <option value="TODOS">Todos</option>
            {setoresDisponiveis.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className={lblCls}>Data início</label>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
            className={inpCls + ' min-w-[130px]'}
          />
        </div>
        <div className="flex flex-col">
          <label className={lblCls}>Data fim</label>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
            className={inpCls + ' min-w-[130px]'}
          />
        </div>
        <div className="flex flex-col flex-1 min-w-[200px]">
          <label className={lblCls}>Buscar</label>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Solicitante, descrição, fornecedor..."
            className={inpCls}
          />
        </div>
        <button
          onClick={limparFiltros}
          className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Limpar
        </button>
        <button
          onClick={carregarSolicitacoes}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#000638] bg-white border rounded-lg hover:bg-gray-50"
        >
          <ArrowClockwise size={14} weight="bold" />
          Atualizar
        </button>
        <span className="text-xs text-gray-500">
          {solicitacoesFiltradas.length} / {solicitacoes.length}
        </span>
        {/* Toggle visão */}
        <div className="flex items-center border rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setVisao('kanban')}
            title="Kanban"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${visao === 'kanban' ? 'bg-[#000638] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <Kanban size={14} weight="bold" />
            Kanban
          </button>
          <button
            onClick={() => setVisao('lista')}
            title="Lista"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors border-l ${visao === 'lista' ? 'bg-[#000638] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <List size={14} weight="bold" />
            Lista
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} className="animate-spin text-[#000638]" />
          <span className="ml-3 text-gray-500">Carregando...</span>
        </div>
      ) : visao === 'kanban' ? (
        <KanbanView
          porEtapa={porEtapa}
          atualizandoId={atualizandoId}
          podeAlterar={podeAlterar}
          onAbrirDetalhe={setModalDetalhe}
          onAtualizarEtapa={atualizarEtapa}
        />
      ) : (
        <ListaView
          solicitacoes={solicitacoesFiltradas}
          atualizandoId={atualizandoId}
          podeAlterar={podeAlterar}
          onAbrirDetalhe={setModalDetalhe}
          onAtualizarEtapa={atualizarEtapa}
        />
      )}

      {modalDetalhe && (
        <ModalDetalheCompraManut
          sol={modalDetalhe}
          onClose={() => setModalDetalhe(null)}
          etapas={ETAPAS}
          podeAlterar={podeAlterar}
          isAdmin={isAdmin}
          userNome={userNome}
          userId={user?.id}
          onAtualizarEtapa={(novo) => atualizarEtapa(modalDetalhe, novo)}
          atualizando={atualizandoId === modalDetalhe.id}
          onSalvarEdicao={salvarEdicao}
          onEnviarTotvs={enviarParaTotvs}
          enviandoTotvs={enviandoTotvs}
        />
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
// KANBAN VIEW
// =====================================================================
const KanbanView = ({
  porEtapa,
  atualizandoId,
  podeAlterar,
  onAbrirDetalhe,
  onAtualizarEtapa,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
    {ETAPAS.map((etapa) => {
      const itens = porEtapa.get(etapa.value) || [];
      return (
        <div
          key={String(etapa.value)}
          className={`border-2 ${etapa.border} rounded-xl bg-gray-50/40 flex flex-col min-h-[280px]`}
        >
          <div
            className={`${etapa.headerBg} ${etapa.headerText} rounded-t-lg px-3 py-2 flex items-center justify-between sticky top-0 z-10`}
          >
            <span className="text-xs font-extrabold uppercase tracking-wide">
              {etapa.label}
            </span>
            <span className="bg-white/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {itens.length}
            </span>
          </div>
          <div className="p-2 space-y-2 overflow-y-auto max-h-[70vh]">
            {itens.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic text-center py-6">
                Nenhuma solicitação
              </p>
            ) : (
              itens.map((sol) => (
                <CardSolicitacao
                  key={sol.id}
                  sol={sol}
                  etapas={ETAPAS}
                  onAbrirDetalhe={() => onAbrirDetalhe(sol)}
                  onAtualizarEtapa={(novo) => onAtualizarEtapa(sol, novo)}
                  carregando={atualizandoId === sol.id}
                  podeAlterar={podeAlterar}
                />
              ))
            )}
          </div>
        </div>
      );
    })}
  </div>
);

// =====================================================================
// LISTA VIEW
// =====================================================================
const ListaView = ({
  solicitacoes,
  atualizandoId,
  podeAlterar,
  onAbrirDetalhe,
  onAtualizarEtapa,
}) => {
  if (solicitacoes.length === 0)
    return (
      <p className="text-center text-gray-400 py-20 text-sm italic">
        Nenhuma solicitação encontrada.
      </p>
    );
  return (
    <div className="bg-white border rounded-xl overflow-x-auto shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b">
            {[
              'Tipo',
              'Duplicata',
              'Descrição',
              'Solicitante',
              'Setor',
              'Loja',
              'Fornecedor',
              'Valor',
              'Vencimento',
              'Etapa',
              'NF',
              'TOTVS',
              '',
            ].map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-bold text-gray-500 uppercase text-[10px] tracking-wide whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {solicitacoes.map((sol) => {
            const tipoCfg =
              TIPO_CONFIG[sol.tipo_solicitacao] || TIPO_CONFIG.compra;
            const TipoIcon = tipoCfg.icon;
            const etapaAtual =
              ETAPAS.find((e) => e.value === (sol.status_secundario || null)) ||
              ETAPAS[0];
            return (
              <tr
                key={sol.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onAbrirDetalhe(sol)}
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${tipoCfg.color}`}
                  >
                    <TipoIcon size={10} weight="bold" />
                    {tipoCfg.label}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                  {sol.duplicate_code ? `#${sol.duplicate_code}` : '--'}
                </td>
                <td className="px-3 py-2 max-w-[220px]">
                  <p className="truncate text-gray-800 font-medium">
                    {sol.descricao || '--'}
                  </p>
                  {sol.marca_modelo && (
                    <p className="text-[10px] text-gray-400 truncate">
                      {sol.marca_modelo}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {sol.solicitante || '--'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold">
                    {sol.setor || '--'}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600 max-w-[120px] truncate">
                  {sol.nm_empresa || '--'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-medium max-w-[140px] truncate">
                  {sol.supplier_name || '--'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-bold text-[#000638]">
                  {sol.valor_total ? fmtMoeda(sol.valor_total) : '--'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                  {fmtData(sol.dt_vencimento)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${etapaAtual.color}`}
                  >
                    {etapaAtual.label}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {sol.tem_nota_fiscal === true && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                      <CheckCircle size={11} weight="fill" />
                      Sim
                    </span>
                  )}
                  {sol.tem_nota_fiscal === false && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
                      <Warning size={11} weight="fill" />
                      Não
                    </span>
                  )}
                  {(sol.tem_nota_fiscal === null ||
                    sol.tem_nota_fiscal === undefined) && (
                    <span className="text-[10px] text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {sol.status === 'enviado_totvs' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-teal-700">
                      <CheckCircle size={11} weight="fill" />
                      Enviado
                    </span>
                  )}
                  {sol.status === 'erro_envio' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600">
                      <Warning size={11} weight="fill" />
                      Erro
                    </span>
                  )}
                  {sol.status !== 'enviado_totvs' &&
                    sol.status !== 'erro_envio' && (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                </td>
                <td
                  className="px-3 py-2 whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onAbrirDetalhe(sol)}
                    className="p-1.5 text-[#000638] hover:bg-blue-50 rounded-lg"
                    title="Ver / editar"
                  >
                    <Eye size={14} weight="bold" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// =====================================================================
// CARD KANBAN
// =====================================================================
const CardSolicitacao = ({
  sol,
  etapas,
  onAbrirDetalhe,
  onAtualizarEtapa,
  carregando,
  podeAlterar,
}) => {
  const tipoCfg = TIPO_CONFIG[sol.tipo_solicitacao] || TIPO_CONFIG.compra;
  const TipoIcon = tipoCfg.icon;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${tipoCfg.color}`}
        >
          <TipoIcon size={10} weight="bold" />
          {tipoCfg.label}
        </span>
        {sol.duplicate_code && (
          <span className="text-[9px] font-mono text-gray-400">
            #{sol.duplicate_code}
          </span>
        )}
        {sol.tem_nota_fiscal === true && (
          <span title="Com nota fiscal" className="ml-auto">
            <FileText size={12} weight="fill" className="text-emerald-600" />
          </span>
        )}
        {sol.tem_nota_fiscal === false && (
          <span title="Sem nota fiscal" className="ml-auto">
            <Warning size={12} weight="fill" className="text-amber-500" />
          </span>
        )}
        <button
          onClick={onAbrirDetalhe}
          className={`p-0.5 text-[#000638] hover:bg-blue-50 rounded transition-colors ${sol.tem_nota_fiscal !== null && sol.tem_nota_fiscal !== undefined ? '' : 'ml-auto'}`}
          title="Ver / editar"
        >
          <Eye size={13} weight="bold" />
        </button>
      </div>

      <p
        className="text-xs font-semibold text-gray-800 line-clamp-2 mb-1"
        title={sol.descricao}
      >
        {sol.descricao || '— sem descrição —'}
      </p>

      {sol.marca_modelo && (
        <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1">
          <Tag size={10} className={tipoCfg.accent} />
          <span className="truncate">{sol.marca_modelo}</span>
        </p>
      )}

      <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-1">
        <User size={10} className="shrink-0" />
        <span className="truncate font-medium">{sol.solicitante || '--'}</span>
        {sol.setor && (
          <span className="ml-auto px-1 py-px rounded bg-gray-100 text-gray-600 font-bold text-[9px]">
            {sol.setor}
          </span>
        )}
      </div>

      {sol.nm_empresa && (
        <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1 truncate">
          <Storefront size={10} />
          {sol.nm_empresa}
        </p>
      )}
      {sol.supplier_name && (
        <p className="text-[10px] text-gray-700 font-semibold truncate mb-1">
          {sol.supplier_name}
        </p>
      )}

      <div className="flex items-center gap-2 mb-1.5">
        {sol.valor_total ? (
          <span className="text-[11px] font-bold text-[#000638] flex items-center gap-1">
            <CurrencyCircleDollar size={11} weight="bold" />
            {fmtMoeda(sol.valor_total)}
          </span>
        ) : null}
        {sol.dt_vencimento && (
          <span className="text-[10px] text-gray-500 flex items-center gap-1 ml-auto">
            <Calendar size={10} />
            {fmtData(sol.dt_vencimento)}
          </span>
        )}
      </div>

      {podeAlterar && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            disabled={carregando}
            className="w-full text-[10px] font-bold border border-gray-200 rounded px-2 py-1 flex items-center justify-between hover:bg-gray-50 disabled:opacity-60"
          >
            <span>Mover etapa</span>
            {carregando ? (
              <Spinner size={10} className="animate-spin" />
            ) : menuOpen ? (
              <CaretDown size={10} weight="bold" />
            ) : (
              <CaretRight size={10} weight="bold" />
            )}
          </button>
          {menuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {etapas
                .filter((e) => e.value !== (sol.status_secundario || null))
                .map((e) => (
                  <button
                    key={String(e.value)}
                    onClick={() => {
                      setMenuOpen(false);
                      onAtualizarEtapa(e.value);
                    }}
                    className="w-full text-left px-2 py-1.5 text-[10px] font-semibold hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                  >
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${e.headerBg}`}
                    />
                    {e.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// MODAL DETALHE + EDIÇÃO
// =====================================================================
const ModalDetalheCompraManut = ({
  sol,
  onClose,
  etapas,
  podeAlterar,
  isAdmin,
  userNome,
  userId,
  onAtualizarEtapa,
  atualizando,
  onSalvarEdicao,
  onEnviarTotvs,
  enviandoTotvs,
}) => {
  const tipoCfg = TIPO_CONFIG[sol.tipo_solicitacao] || TIPO_CONFIG.compra;
  const TipoIcon = tipoCfg.icon;
  const etapaAtual =
    etapas.find((e) => e.value === (sol.status_secundario || null)) ||
    etapas[0];

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [uploadingNF, setUploadingNF] = useState(false);
  const fileRef = useRef(null);

  const [fSupplier, setFSupplier] = useState(sol.supplier_name || '');
  const [fCnpj, setFCnpj] = useState(sol.supplier_cpf_cnpj || '');
  const [buscandoFornecedor, setBuscandoFornecedor] = useState(false);
  const [modalCadastroForn, setModalCadastroForn] = useState(false);
  const [fBranchCnpj, setFBranchCnpj] = useState(sol.branch_cnpj || '');
  const [fDupCode, setFDupCode] = useState(
    sol.duplicate_code != null ? String(sol.duplicate_code) : '',
  );
  const [fEmissao, setFEmissao] = useState(
    sol.dt_emissao ? String(sol.dt_emissao).slice(0, 10) : '',
  );
  const [fVencimento, setFVencimento] = useState(
    sol.dt_vencimento ? String(sol.dt_vencimento).slice(0, 10) : '',
  );
  const [fValor, setFValor] = useState(
    sol.valor_total != null ? String(sol.valor_total) : '',
  );
  const [fDespesa, setFDespesa] = useState(
    sol.despesa_code ? String(sol.despesa_code) : '',
  );
  const [fCcusto, setFCcusto] = useState(
    sol.cost_center_code ? String(sol.cost_center_code) : '',
  );
  const [fDescricao, setFDescricao] = useState(sol.descricao || '');
  const [fMarca, setFMarca] = useState(sol.marca_modelo || '');
  const [fTemNF, setFTemNF] = useState(
    sol.tem_nota_fiscal === true
      ? 'sim'
      : sol.tem_nota_fiscal === false
        ? 'nao'
        : '',
  );
  const [fNFUrl, setFNFUrl] = useState(sol.nota_fiscal_url || '');
  const [fNFPath, setFNFPath] = useState(sol.nota_fiscal_path || '');
  const [despesaBusca, setDespesaBusca] = useState('');

  const buscarFornecedor = async () => {
    const onlyDig = (v) => String(v ?? '').replace(/\D+/g, '');
    const digits = onlyDig(fCnpj);
    if (digits.length !== 11 && digits.length !== 14) return;
    setBuscandoFornecedor(true);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/totvs/supplier/search?cpfCnpj=${digits}`,
      );
      if (resp.status === 404) {
        setFSupplier('');
        setModalCadastroForn(true);
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setFSupplier(data?.data?.name || '');
    } catch (err) {
      console.error('Erro ao buscar fornecedor:', err);
    } finally {
      setBuscandoFornecedor(false);
    }
  };

  const despesasFiltradas = useMemo(() => {
    const q = despesaBusca.trim().toLowerCase();
    if (!q) return DESPESAS_OPTIONS;
    return DESPESAS_OPTIONS.filter(
      ([code, name]) => code.includes(q) || name.toLowerCase().includes(q),
    );
  }, [despesaBusca]);

  const handleSalvar = async () => {
    setSalvando(true);
    const patch = {
      supplier_name: fSupplier.trim() || null,
      supplier_cpf_cnpj: fCnpj.trim() || null,
      branch_cnpj: fBranchCnpj.trim() || null,
      duplicate_code: fDupCode ? parseInt(fDupCode) : null,
      dt_emissao: fEmissao || null,
      dt_vencimento: fVencimento || null,
      valor_total:
        fValor !== '' && !isNaN(parseFloat(fValor)) ? parseFloat(fValor) : null,
      despesa_code: fDespesa ? parseInt(fDespesa) : null,
      cost_center_code: fCcusto ? parseInt(fCcusto) : null,
      descricao: fDescricao.trim() || null,
      marca_modelo: fMarca.trim() || null,
      tem_nota_fiscal:
        fTemNF === 'sim' ? true : fTemNF === 'nao' ? false : null,
      nota_fiscal_url: fNFUrl || null,
      nota_fiscal_path: fNFPath || null,
    };
    const ok = await onSalvarEdicao(sol.id, patch);
    setSalvando(false);
    if (ok) setEditando(false);
  };

  const handleUploadNF = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo: 10MB.');
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `notas-fiscais/${sol.id}/${Date.now()}.${ext}`;
    setUploadingNF(true);
    try {
      const { error: upErr } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);
      setFNFUrl(urlData?.publicUrl || '');
      setFNFPath(path);
      setFTemNF('sim');
    } catch (err) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setUploadingNF(false);
    }
  };

  const handleRemoverNF = async () => {
    if (!window.confirm('Remover a nota fiscal?')) return;
    if (fNFPath)
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([fNFPath]);
    setFNFUrl('');
    setFNFPath('');
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      {modalCadastroForn && (
        <CadastrarFornecedorModal
          cpfCnpj={String(fCnpj).replace(/\D+/g, '')}
          onClose={() => setModalCadastroForn(false)}
          onSuccess={({ name, cpfCnpj }) => {
            if (cpfCnpj) setFCnpj(cpfCnpj);
            setFSupplier(name || '');
            setModalCadastroForn(false);
          }}
        />
      )}
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center z-10">
          <h3 className="text-base font-bold flex items-center gap-2">
            <TipoIcon size={18} weight="bold" />
            {tipoCfg.label}
            {sol.duplicate_code && (
              <span className="ml-1 bg-white/20 font-mono text-xs px-2 py-0.5 rounded">
                #{sol.duplicate_code}
              </span>
            )}
            {editando && (
              <span className="text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full ml-1">
                Editando
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {podeAlterar && !editando && (
              <button
                onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-bold"
              >
                <PencilSimple size={14} weight="bold" />
                Editar
              </button>
            )}
            {editando && (
              <>
                <button
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg font-bold disabled:opacity-60"
                >
                  {salvando ? (
                    <Spinner size={12} className="animate-spin" />
                  ) : (
                    <FloppyDisk size={14} weight="bold" />
                  )}
                  Salvar
                </button>
                <button
                  onClick={() => setEditando(false)}
                  className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-bold"
                >
                  <ArrowUUpLeft size={14} weight="bold" />
                  Cancelar
                </button>
              </>
            )}
            <button onClick={onClose} className="text-white hover:text-red-300">
              <X size={22} weight="bold" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* ── ETAPA ── */}
          <section className="border rounded-xl p-3 bg-gray-50">
            <p className={`${lblCls} mb-2`}>Etapa atual</p>
            <div className="flex flex-wrap gap-2">
              {etapas.map((e) => (
                <button
                  key={String(e.value)}
                  onClick={() => onAtualizarEtapa(e.value)}
                  disabled={atualizando || !podeAlterar}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border-2 disabled:opacity-50 ${etapaAtual.value === e.value ? `${e.color} border-current shadow-sm` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── NOTA FISCAL ── */}
          <section className="border rounded-xl p-4 bg-white">
            <p className={`${lblCls} mb-3 flex items-center gap-1.5`}>
              <FileText size={13} weight="bold" className="text-[#000638]" />
              Nota Fiscal
            </p>
            {editando ? (
              <div className="space-y-3">
                <div className="flex gap-3">
                  {[
                    {
                      value: 'sim',
                      icon: CheckCircle,
                      title: 'Tem nota fiscal',
                      sub: 'Não envia ao TOTVS',
                      activeClass:
                        'border-emerald-500 bg-emerald-50 text-emerald-800',
                      iconClass: 'text-emerald-600',
                    },
                    {
                      value: 'nao',
                      icon: Warning,
                      title: 'Sem nota fiscal',
                      sub: 'Deve enviar ao TOTVS',
                      activeClass:
                        'border-amber-500 bg-amber-50 text-amber-800',
                      iconClass: 'text-amber-600',
                    },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = fTemNF === opt.value;
                    return (
                      <label key={opt.value} className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name={`nf-${sol.id}`}
                          value={opt.value}
                          checked={active}
                          onChange={() => setFTemNF(opt.value)}
                          className="sr-only"
                        />
                        <div
                          className={`flex items-center gap-2 border-2 rounded-xl px-4 py-3 transition-all ${active ? opt.activeClass : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}
                        >
                          <Icon
                            size={18}
                            weight={active ? 'fill' : 'regular'}
                            className={active ? opt.iconClass : 'text-gray-400'}
                          />
                          <div>
                            <p className="text-xs font-bold">{opt.title}</p>
                            <p className="text-[10px] text-gray-500">
                              {opt.sub}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {fTemNF === 'sim' && (
                  <div className="mt-2">
                    {fNFUrl ? (
                      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <FileText
                          size={20}
                          weight="fill"
                          className="text-emerald-600 shrink-0"
                        />
                        <a
                          href={fNFUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-xs font-semibold text-emerald-800 underline hover:text-emerald-600 truncate"
                        >
                          {fNFPath?.split('/').pop() || 'Nota fiscal'}
                        </a>
                        <button
                          onClick={handleRemoverNF}
                          className="text-red-500 hover:text-red-700 p-1 rounded"
                          title="Remover"
                        >
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => handleUploadNF(e.target.files?.[0])}
                        />
                        <button
                          onClick={() => fileRef.current?.click()}
                          disabled={uploadingNF}
                          className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 hover:border-emerald-400 text-gray-600 hover:text-emerald-700 rounded-xl w-full justify-center text-xs font-semibold transition-colors disabled:opacity-60"
                        >
                          {uploadingNF ? (
                            <Spinner size={14} className="animate-spin" />
                          ) : (
                            <UploadSimple size={16} weight="bold" />
                          )}
                          {uploadingNF
                            ? 'Enviando...'
                            : 'Importar nota fiscal (PDF ou imagem, até 10 MB) — opcional'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {sol.tem_nota_fiscal === true && (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                      <CheckCircle size={16} weight="fill" />
                      Possui nota fiscal — não envia ao TOTVS
                    </span>
                    {sol.nota_fiscal_url && (
                      <a
                        href={sol.nota_fiscal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-700 underline hover:text-blue-900"
                      >
                        <FileText size={12} />
                        Ver NF
                      </a>
                    )}
                  </div>
                )}
                {sol.tem_nota_fiscal === false && (
                  <span className="flex items-center gap-1.5 text-sm font-bold text-amber-700">
                    <Warning size={16} weight="fill" />
                    Sem nota fiscal — deve enviar ao TOTVS
                  </span>
                )}
                {(sol.tem_nota_fiscal === null ||
                  sol.tem_nota_fiscal === undefined) && (
                  <p className="text-xs text-gray-400 italic flex items-center gap-1">
                    <Info size={12} />
                    Não definido. Clique em &quot;Editar&quot; para configurar.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── DADOS DA DUPLICATA ── */}
          <section className="border rounded-xl p-4 bg-white">
            <p className={`${lblCls} mb-3 flex items-center gap-1.5`}>
              <Receipt size={13} weight="bold" className="text-[#000638]" />
              Dados da Duplicata
            </p>
            {editando ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={lblCls}>Descrição / Itens</label>
                  <textarea
                    className={inpCls}
                    rows={2}
                    value={fDescricao}
                    onChange={(e) => setFDescricao(e.target.value)}
                  />
                </div>
                <div>
                  <label className={lblCls}>Marca / Modelo</label>
                  <input
                    className={inpCls}
                    value={fMarca}
                    onChange={(e) => setFMarca(e.target.value)}
                  />
                </div>
                <div>
                  <label className={lblCls}>Cód. Duplicata</label>
                  <input
                    className={inpCls}
                    type="number"
                    value={fDupCode}
                    onChange={(e) => setFDupCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className={lblCls}>Fornecedor (nome)</label>
                  <input
                    className={inpCls}
                    value={fSupplier}
                    onChange={(e) => setFSupplier(e.target.value)}
                    placeholder="Preenchido automaticamente ao buscar"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={lblCls}>CPF / CNPJ do Fornecedor</label>
                  <div className="flex gap-2">
                    <input
                      className={inpCls}
                      value={fCnpj}
                      onChange={(e) => setFCnpj(e.target.value)}
                      placeholder="xx.xxx.xxx/xxxx-xx ou xxx.xxx.xxx-xx"
                      maxLength={18}
                      onKeyDown={(e) => e.key === 'Enter' && buscarFornecedor()}
                    />
                    <button
                      type="button"
                      onClick={buscarFornecedor}
                      disabled={buscandoFornecedor}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#000638] text-white rounded-lg hover:bg-blue-900 disabled:opacity-60 shrink-0 transition-colors"
                      title="Buscar fornecedor no TOTVS"
                    >
                      {buscandoFornecedor ? (
                        <Spinner size={13} className="animate-spin" />
                      ) : (
                        <MagnifyingGlass size={13} weight="bold" />
                      )}
                      Buscar
                    </button>
                  </div>
                  {fSupplier && (
                    <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                      <CheckCircle size={11} weight="fill" />
                      {fSupplier}
                    </p>
                  )}
                </div>
                <div>
                  <label className={lblCls}>CNPJ Empresa / Filial</label>
                  <input
                    className={inpCls}
                    value={fBranchCnpj}
                    onChange={(e) => setFBranchCnpj(e.target.value)}
                    placeholder="xx.xxx.xxx/xxxx-xx"
                  />
                </div>
                <div>
                  <label className={lblCls}>Valor (R$)</label>
                  <input
                    className={inpCls}
                    type="number"
                    step="0.01"
                    min="0"
                    value={fValor}
                    onChange={(e) => setFValor(e.target.value)}
                  />
                </div>
                <div>
                  <label className={lblCls}>Data de Emissão</label>
                  <input
                    className={inpCls}
                    type="date"
                    value={fEmissao}
                    onChange={(e) => setFEmissao(e.target.value)}
                  />
                </div>
                <div>
                  <label className={lblCls}>Data de Vencimento</label>
                  <input
                    className={inpCls}
                    type="date"
                    value={fVencimento}
                    onChange={(e) => setFVencimento(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={lblCls}>Código de Despesa</label>
                  <input
                    className={inpCls + ' mb-1'}
                    placeholder="Buscar por código ou nome..."
                    value={despesaBusca}
                    onChange={(e) => setDespesaBusca(e.target.value)}
                  />
                  <select
                    className={inpCls}
                    value={fDespesa}
                    onChange={(e) => setFDespesa(e.target.value)}
                    size={Math.min(5, despesasFiltradas.length + 1)}
                  >
                    <option value="">— Nenhuma —</option>
                    {despesasFiltradas.map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} — {name}
                      </option>
                    ))}
                  </select>
                  {fDespesa && (
                    <p className="text-[10px] text-blue-700 mt-0.5">
                      Selecionado: {fDespesa} — {getDespesaNome(fDespesa)}
                    </p>
                  )}
                </div>
                <div>
                  <label className={lblCls}>Centro de Custo</label>
                  <select
                    className={inpCls}
                    value={fCcusto}
                    onChange={(e) => setFCcusto(e.target.value)}
                  >
                    <option value="">— Nenhum —</option>
                    {CENTROS_CUSTO_OPTIONS.map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} — {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Solicitante" value={sol.solicitante} />
                <Field label="Setor" value={sol.setor} />
                <Field label="Loja" value={sol.nm_empresa} />
                <Field
                  label="Data Solicitação"
                  value={fmtDataHora(sol.data_solicitacao)}
                />
                {sol.supplier_name && (
                  <Field label="Fornecedor" value={sol.supplier_name} />
                )}
                {sol.supplier_cpf_cnpj && (
                  <Field
                    label="CPF/CNPJ Fornecedor"
                    value={sol.supplier_cpf_cnpj}
                  />
                )}
                {sol.branch_cnpj && (
                  <Field label="CNPJ Empresa" value={sol.branch_cnpj} />
                )}
                {sol.duplicate_code != null && (
                  <Field
                    label="Cód. Duplicata"
                    value={`#${sol.duplicate_code}`}
                  />
                )}
                {sol.valor_total != null && (
                  <Field
                    label="Valor"
                    value={fmtMoeda(sol.valor_total)}
                    highlight
                  />
                )}
                {sol.dt_emissao && (
                  <Field label="Emissão" value={fmtData(sol.dt_emissao)} />
                )}
                {sol.dt_vencimento && (
                  <Field
                    label="Vencimento"
                    value={fmtData(sol.dt_vencimento)}
                  />
                )}
                {sol.despesa_code && (
                  <Field
                    label="Despesa"
                    value={`${sol.despesa_code} — ${getDespesaNome(sol.despesa_code)}`}
                  />
                )}
                {sol.cost_center_code && (
                  <Field
                    label="Centro de Custo"
                    value={`${sol.cost_center_code}${CENTROS_CUSTO[String(sol.cost_center_code)] ? ' — ' + CENTROS_CUSTO[String(sol.cost_center_code)] : ''}`}
                  />
                )}
                {sol.marca_modelo && (
                  <Field label="Marca / Modelo" value={sol.marca_modelo} />
                )}
              </div>
            )}
          </section>

          {/* ── DESCRIÇÃO / OBSERVAÇÃO (só leitura) ── */}
          {!editando && sol.descricao && (
            <section>
              <p className={`${lblCls} mb-1`}>Descrição / Itens</p>
              <p className="text-sm whitespace-pre-wrap text-gray-700 bg-gray-50 border rounded-lg p-3">
                {sol.descricao}
              </p>
            </section>
          )}
          {!editando && sol.observacao && (
            <section>
              <p className={`${lblCls} mb-1`}>Observação</p>
              <p className="text-sm whitespace-pre-wrap text-gray-700 bg-gray-50 border rounded-lg p-3">
                {sol.observacao}
              </p>
            </section>
          )}
          {!editando && sol.recomendacao_fornecedores && (
            <section>
              <p className={`${lblCls} mb-1`}>Recomendação de Fornecedores</p>
              <p className="text-sm whitespace-pre-wrap text-gray-700 bg-gray-50 border rounded-lg p-3">
                {sol.recomendacao_fornecedores}
              </p>
            </section>
          )}

          {/* ── LINK + IMAGENS ── */}
          {!editando && sol.link_exemplo && (
            <section>
              <p className={`${lblCls} mb-1`}>Link de Referência</p>
              <a
                href={sol.link_exemplo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-700 underline break-all hover:text-blue-900"
              >
                <LinkIcon size={14} weight="bold" className="shrink-0" />
                {sol.link_exemplo}
              </a>
            </section>
          )}
          {!editando &&
            Array.isArray(sol.imagens_exemplo_urls) &&
            sol.imagens_exemplo_urls.length > 0 && (
              <section>
                <p className={`${lblCls} mb-2`}>
                  Imagens de Referência ({sol.imagens_exemplo_urls.length})
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
                          className="w-full h-32 object-cover rounded-lg border hover:opacity-80 bg-gray-50"
                        />
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-blue-700 underline p-2 border rounded-lg bg-gray-50">
                          <LinkIcon size={12} />
                          Arquivo {i + 1}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </section>
            )}

          {/* ── CONTATOS PRESTADORES ── */}
          {!editando &&
            Array.isArray(sol.contatos_prestadores) &&
            sol.contatos_prestadores.some((c) => c.nome || c.telefone) && (
              <section>
                <p className={`${lblCls} mb-2`}>Contatos de Prestadores</p>
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
                            className="text-green-700 hover:underline font-mono flex items-center gap-1"
                          >
                            <Phone size={12} />
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
              </section>
            )}

          {/* ── STATUS FLUXO APROVAÇÃO ── */}
          <section className="border rounded-xl p-3 bg-blue-50/40 border-blue-200">
            <p className={`${lblCls} text-blue-800 mb-2`}>
              Status do fluxo de aprovação
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge
                label="Aprovado Gestor"
                ok={!!sol.aprovado_gestor_em}
                tooltip={
                  sol.aprovado_gestor_por_nome
                    ? `${sol.aprovado_gestor_por_nome} · ${fmtDataHora(sol.aprovado_gestor_em)}`
                    : ''
                }
              />
              <Badge
                label="Aprovado Financeiro"
                ok={!!sol.aprovado_financeiro_em}
                tooltip={
                  sol.aprovado_financeiro_por_nome
                    ? `${sol.aprovado_financeiro_por_nome} · ${fmtDataHora(sol.aprovado_financeiro_em)}`
                    : ''
                }
              />
              <Badge
                label="Enviado TOTVS"
                ok={sol.status === 'enviado_totvs'}
                tooltip={
                  sol.enviado_totvs_em ? fmtDataHora(sol.enviado_totvs_em) : ''
                }
              />
            </div>
            {sol.status === 'erro_envio' && sol.totvs_erro && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                <strong>Erro TOTVS:</strong> {sol.totvs_erro}
              </div>
            )}
          </section>

          {/* ── ENVIO AO TOTVS ── */}
          {isAdmin && sol.tem_nota_fiscal === false && (
            <section className="border rounded-xl p-4 bg-amber-50 border-amber-200">
              <p
                className={`${lblCls} text-amber-800 mb-2 flex items-center gap-1.5`}
              >
                <PaperPlaneTilt size={13} weight="bold" />
                Envio ao TOTVS
              </p>
              {sol.status === 'enviado_totvs' ? (
                <div className="flex items-center gap-2 text-sm font-bold text-teal-700">
                  <CheckCircle size={16} weight="fill" />
                  Duplicata já enviada ao TOTVS em{' '}
                  {fmtDataHora(sol.enviado_totvs_em)}
                </div>
              ) : (
                <>
                  <p className="text-xs text-amber-700 mb-3">
                    Esta solicitação não possui nota fiscal. Preencha os dados
                    da duplicata e envie ao TOTVS.
                  </p>
                  <div className="space-y-1 mb-3">
                    {[
                      {
                        ok: !!sol.duplicate_code,
                        label: 'Código da duplicata preenchido',
                      },
                      {
                        ok: !!sol.supplier_cpf_cnpj,
                        label: 'CPF/CNPJ do fornecedor preenchido',
                      },
                      {
                        ok: !!sol.branch_cnpj,
                        label: 'CNPJ da filial preenchido',
                      },
                      {
                        ok: !!sol.dt_vencimento,
                        label: 'Data de vencimento preenchida',
                      },
                      { ok: !!sol.valor_total, label: 'Valor preenchido' },
                      {
                        ok: !!sol.despesa_code,
                        label: 'Código de despesa preenchido',
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-[11px] font-semibold ${item.ok ? 'text-emerald-700' : 'text-red-600'}`}
                      >
                        {item.ok ? (
                          <CheckSquare size={12} weight="fill" />
                        ) : (
                          <Warning size={12} weight="fill" />
                        )}
                        {item.label}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => onEnviarTotvs(sol)}
                    disabled={enviandoTotvs}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#000638] text-white text-xs font-bold rounded-lg hover:bg-blue-900 disabled:opacity-60"
                  >
                    {enviandoTotvs ? (
                      <Spinner size={14} className="animate-spin" />
                    ) : (
                      <PaperPlaneTilt size={14} weight="bold" />
                    )}
                    {enviandoTotvs ? 'Enviando...' : 'Enviar ao TOTVS'}
                  </button>
                  {sol.status === 'erro_envio' && (
                    <p className="text-[11px] text-red-600 mt-2 font-semibold">
                      Falha anterior — corrija os dados e tente novamente.
                    </p>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// AUXILIARES
// =====================================================================
const Field = ({ label, value, highlight }) => (
  <div className="bg-gray-50 border rounded-lg px-3 py-2">
    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
      {label}
    </p>
    <p
      className={`text-sm ${highlight ? 'font-extrabold text-[#000638]' : 'font-semibold text-gray-800'}`}
    >
      {value || '--'}
    </p>
  </div>
);

const Badge = ({ label, ok, tooltip }) => (
  <span
    title={tooltip}
    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-bold border text-[11px] ${ok ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}
  >
    {ok ? (
      <CheckCircle size={11} weight="bold" />
    ) : (
      <Clock size={11} weight="bold" />
    )}
    {label}
  </span>
);

export default SolicitacoesCrosbyComprasManutencao;
