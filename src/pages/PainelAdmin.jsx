import React, { useEffect, useMemo, useState } from 'react';
import {
  UserGear,
  UserPlus,
  MagnifyingGlass,
  Funnel,
  Trash,
  PencilSimple,
  CheckCircle,
  XCircle,
  Users,
  X,
  Spinner,
  Warning,
} from '@phosphor-icons/react';
import { useAuth } from '../components/AuthContext';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  checkEmailExists,
} from '../lib/userProfiles';
import {
  saveUserCompanies,
  getUserCompanies,
} from '../services/userCompaniesService';
import LoadingSpinner from '../components/LoadingSpinner';
import Notification from '../components/Notification';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import { USER_ROLE_LABELS, USER_ROLE_COLORS } from '../config/constants';

const perfis = Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const FORM_VAZIO = {
  id: null,
  name: '',
  email: '',
  password: '',
  role: 'user',
  active: true,
};

// ─── Modal de criação/edição de usuário ──────────────────────────────────────
const ModalUsuario = ({
  form,
  setForm,
  editando,
  salvando,
  empresasSelecionadas,
  setEmpresasSelecionadas,
  loadingEmpresas,
  onSubmit,
  onClose,
}) => {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#000638] text-base">
            {editando ? 'Editar Usuário' : 'Novo Usuário'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Nome
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Nome completo"
              className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full text-sm bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              E-mail
            </label>
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="email@exemplo.com"
              type="email"
              className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full text-sm bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              required
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                {editando ? 'Nova senha (opcional)' : 'Senha'}
              </label>
              <input
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder={editando ? 'Manter a atual' : 'Senha'}
                type="password"
                minLength={4}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full text-sm bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Perfil
              </label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="border border-[#000638]/30 rounded-lg px-2 py-2 text-sm bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                {perfis.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#000638]">
            <input
              type="checkbox"
              name="active"
              checked={form.active}
              onChange={handleChange}
            />
            Usuário ativo
          </label>

          {/* Empresas vinculadas — obrigatório para o perfil franquias */}
          {form.role === 'franquias' && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#000638]">
                Empresas Vinculadas (obrigatório para Franquias)
              </label>
              {loadingEmpresas ? (
                <LoadingSpinner text="Carregando empresas..." />
              ) : (
                <FiltroEmpresa
                  empresasSelecionadas={empresasSelecionadas}
                  onSelectEmpresas={setEmpresasSelecionadas}
                />
              )}
              {empresasSelecionadas.length === 0 && (
                <p className="text-red-600 text-xs mt-1">
                  Selecione pelo menos uma empresa
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 bg-[#000638] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-60"
            >
              {salvando && <Spinner size={14} className="animate-spin" />}
              {editando ? 'Salvar' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Página ──────────────────────────────────────────────────────────────────
export default function PainelAdmin() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [success, setSuccess] = useState('');

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Seleção em massa
  const [selecionados, setSelecionados] = useState(new Set());
  const [roleMassa, setRoleMassa] = useState('');
  const [processandoMassa, setProcessandoMassa] = useState(false);

  // Modal criar/editar
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);

  const fetchUsuarios = async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await fetchUsers();
      setUsuarios(data);
    } catch (e) {
      setErro(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user || user.role !== 'owner') return;
    fetchUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  // Carrega empresas vinculadas ao editar usuário franquias
  useEffect(() => {
    const loadCompaniesForUser = async () => {
      if (modalAberto && editando && form.id && form.role === 'franquias') {
        setLoadingEmpresas(true);
        try {
          const { data } = await getUserCompanies(form.id);
          if (data) {
            setEmpresasSelecionadas(data.map((codigo) => ({ cd_empresa: codigo })));
          }
        } catch (error) {
          console.error('Erro ao carregar empresas:', error);
        } finally {
          setLoadingEmpresas(false);
        }
      } else if (form.role !== 'franquias') {
        setEmpresasSelecionadas([]);
      }
    };
    loadCompaniesForUser();
  }, [modalAberto, editando, form.id, form.role]);

  // ─── Filtro de usuários ────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let lista = usuarios;
    if (busca) {
      const s = busca.toLowerCase();
      lista = lista.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(s) ||
          (u.email || '').toLowerCase().includes(s),
      );
    }
    if (filtroRole) lista = lista.filter((u) => u.role === filtroRole);
    if (filtroStatus)
      lista = lista.filter((u) =>
        filtroStatus === 'ativo' ? u.active : !u.active,
      );
    return lista;
  }, [usuarios, busca, filtroRole, filtroStatus]);

  const resumo = useMemo(
    () => ({
      total: usuarios.length,
      ativos: usuarios.filter((u) => u.active).length,
      inativos: usuarios.filter((u) => !u.active).length,
    }),
    [usuarios],
  );

  // ─── Seleção ───────────────────────────────────────────────────────────────
  const toggleSelecionado = (id) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const todosFiltradosSelecionados =
    filtrados.length > 0 && filtrados.every((u) => selecionados.has(u.id));

  const toggleSelecionarTodos = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todosFiltradosSelecionados) {
        filtrados.forEach((u) => next.delete(u.id));
      } else {
        filtrados.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

  // ─── Ações em massa ────────────────────────────────────────────────────────
  // Aplica uma operação por usuário selecionado (a API não tem endpoint de
  // lote), pulando sempre o próprio usuário logado por segurança.
  const executarEmMassa = async (descricao, operacao, { pularProprio } = {}) => {
    const ids = [...selecionados].filter(
      (id) => !pularProprio || id !== user.id,
    );
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `${descricao} ${ids.length} usuário(s)?` +
          (pularProprio && selecionados.has(user.id)
            ? ' (o seu próprio usuário será pulado)'
            : ''),
      )
    )
      return;

    setProcessandoMassa(true);
    setErro('');
    let ok = 0;
    let falhas = 0;
    for (const id of ids) {
      try {
        await operacao(id);
        ok += 1;
      } catch (e) {
        console.error(`Falha em ${id}:`, e);
        falhas += 1;
      }
    }
    setProcessandoMassa(false);
    setSelecionados(new Set());
    setSuccess(
      `${ok} usuário(s) processado(s)` +
        (falhas > 0 ? ` — ${falhas} falha(s)` : ''),
    );
    fetchUsuarios();
  };

  const removerSelecionados = () =>
    executarEmMassa('Excluir', (id) => deleteUser(id), { pularProprio: true });

  const ativarSelecionados = () =>
    executarEmMassa('Ativar', (id) => updateUser(id, { active: true }));

  const desativarSelecionados = () =>
    executarEmMassa('Desativar', (id) => updateUser(id, { active: false }), {
      pularProprio: true,
    });

  const alterarPerfilSelecionados = () => {
    if (!roleMassa) return;
    executarEmMassa(
      `Alterar o perfil para "${USER_ROLE_LABELS[roleMassa] || roleMassa}" de`,
      (id) => updateUser(id, { role: roleMassa }),
      { pularProprio: true },
    );
  };

  // ─── Criar / editar ────────────────────────────────────────────────────────
  const abrirNovo = () => {
    setForm(FORM_VAZIO);
    setEditando(false);
    setEmpresasSelecionadas([]);
    setModalAberto(true);
  };

  const abrirEdicao = (usuario) => {
    setForm({ ...usuario, password: '' });
    setEditando(true);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setForm(FORM_VAZIO);
    setEditando(false);
    setEmpresasSelecionadas([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const emailExists = await checkEmailExists(
        form.email,
        editando ? form.id : null,
      );
      if (emailExists) {
        setErro('Este email já está em uso.');
        return;
      }
      if (form.role === 'franquias' && empresasSelecionadas.length === 0) {
        setErro(
          'Usuário do tipo Franquias deve ter pelo menos uma empresa vinculada.',
        );
        return;
      }

      let userId;
      if (editando) {
        const updateData = { ...form };
        if (!updateData.password) delete updateData.password;
        await updateUser(form.id, updateData);
        userId = form.id;
      } else {
        if (!form.password) {
          setErro('Senha é obrigatória para novos usuários.');
          return;
        }
        const newUser = await createUser(form);
        userId = newUser.id;
      }

      if (form.role === 'franquias') {
        const companyCodes = empresasSelecionadas.map((emp) => emp.cd_empresa);
        const { error: companiesError } = await saveUserCompanies(
          userId,
          companyCodes,
        );
        if (companiesError) {
          setErro(
            'Erro ao salvar empresas vinculadas: ' + companiesError.message,
          );
          return;
        }
      }

      setSuccess(
        editando
          ? 'Usuário atualizado com sucesso!'
          : 'Usuário criado com sucesso!',
      );
      fecharModal();
      fetchUsuarios();
    } catch (e2) {
      setErro(e2.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async (usuario) => {
    if (usuario.id === user.id) {
      setErro('Você não pode excluir o seu próprio usuário.');
      return;
    }
    if (!window.confirm(`Excluir o usuário "${usuario.name}"?`)) return;
    setErro('');
    try {
      await deleteUser(usuario.id);
      setSuccess('Usuário excluído com sucesso!');
      fetchUsuarios();
    } catch (e) {
      setErro(e.message);
    }
  };

  // Só Owner pode acessar
  if (!user || user.role !== 'owner') {
    return (
      <div className="p-8 text-red-600 font-bold text-center">
        <UserGear size={48} className="mx-auto mb-4 text-red-500" />
        <p>Acesso restrito ao Proprietário.</p>
        <p className="text-sm text-gray-600 mt-2">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  const temSelecao = selecionados.size > 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-screen-xl mx-auto px-6 pt-6">
        {erro && (
          <Notification
            message={erro}
            type="error"
            onClose={() => setErro('')}
          />
        )}
        {success && (
          <Notification
            message={success}
            type="success"
            onClose={() => setSuccess('')}
          />
        )}

        <PageTitle
          title="Painel Admin"
          subtitle="Gerencie os usuários do sistema: criação, edição e ações em massa"
          icon={UserGear}
          iconColor="text-red-600"
        />

        {/* ─── Cards de resumo ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-2 min-w-[130px]">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide">
              Usuários
            </p>
            <p className="text-sm font-bold text-[#000638]">{resumo.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-300 shadow-sm px-4 py-2 min-w-[130px]">
            <p className="text-[9px] text-green-700 uppercase tracking-wide">
              Ativos
            </p>
            <p className="text-sm font-bold text-green-700">{resumo.ativos}</p>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-300 shadow-sm px-4 py-2 min-w-[130px]">
            <p className="text-[9px] text-red-700 uppercase tracking-wide">
              Inativos
            </p>
            <p className="text-sm font-bold text-red-700">{resumo.inativos}</p>
          </div>
          <div className="bg-blue-50 rounded-lg border border-blue-300 shadow-sm px-4 py-2 min-w-[130px]">
            <p className="text-[9px] text-blue-700 uppercase tracking-wide">
              Selecionados
            </p>
            <p className="text-sm font-bold text-blue-700">
              {selecionados.size}
            </p>
          </div>
        </div>

        {/* ─── Filtros + novo usuário ──────────────────────────────────── */}
        <div className="bg-white border border-[#000638]/10 rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Funnel size={16} weight="bold" className="text-[#000638]" />
            <span className="font-bold text-[#000638] text-sm">Filtros</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Pesquisar
              </label>
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome ou e-mail..."
                  className="border border-[#000638]/30 rounded-lg pl-8 pr-3 py-1.5 w-full text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Perfil
              </label>
              <select
                value={filtroRole}
                onChange={(e) => setFiltroRole(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-40 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                <option value="">Todos</option>
                {perfis.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-32 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                <option value="">Todos</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
            </div>
            <button
              type="button"
              onClick={abrirNovo}
              className="flex items-center gap-1.5 bg-[#000638] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition ml-auto"
            >
              <UserPlus size={14} weight="bold" />
              Novo Usuário
            </button>
          </div>
        </div>

        {/* ─── Barra de ações em massa ─────────────────────────────────── */}
        {temSelecao && (
          <div className="bg-[#000638] text-white rounded-xl shadow-sm px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold">
              {selecionados.size} selecionado(s)
            </span>
            <div className="flex items-center gap-1.5">
              <select
                value={roleMassa}
                onChange={(e) => setRoleMassa(e.target.value)}
                className="border border-white/30 rounded-lg px-2 py-1.5 text-xs bg-white/10 text-white focus:outline-none [&>option]:text-[#000638]"
              >
                <option value="">Alterar perfil para...</option>
                {perfis.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                onClick={alterarPerfilSelecionados}
                disabled={!roleMassa || processandoMassa}
                className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={ativarSelecionados}
                disabled={processandoMassa}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-40"
              >
                <CheckCircle size={13} weight="bold" />
                Ativar
              </button>
              <button
                onClick={desativarSelecionados}
                disabled={processandoMassa}
                className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-40"
              >
                <XCircle size={13} weight="bold" />
                Desativar
              </button>
              <button
                onClick={removerSelecionados}
                disabled={processandoMassa}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-40"
              >
                {processandoMassa ? (
                  <Spinner size={13} className="animate-spin" />
                ) : (
                  <Trash size={13} weight="bold" />
                )}
                Excluir
              </button>
              <button
                onClick={() => setSelecionados(new Set())}
                disabled={processandoMassa}
                className="text-white/70 hover:text-white text-xs px-2 py-1.5 transition"
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* ─── Tabela de usuários ──────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Spinner size={36} className="animate-spin mb-3 text-[#000638]" />
            <p className="text-sm">Carregando usuários...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {usuarios.length === 0
                ? 'Nenhum usuário cadastrado.'
                : 'Nenhum usuário encontrado com os filtros atuais.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-3 py-2.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={todosFiltradosSelecionados}
                        onChange={toggleSelecionarTodos}
                        title="Selecionar todos os filtrados"
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left font-bold">Nome</th>
                    <th className="px-4 py-2.5 text-left font-bold">E-mail</th>
                    <th className="px-3 py-2.5 text-center font-bold">
                      Perfil
                    </th>
                    <th className="px-3 py-2.5 text-center font-bold">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-center font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-b border-gray-100 transition ${
                        selecionados.has(u.id)
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selecionados.has(u.id)}
                          onChange={() => toggleSelecionado(u.id)}
                        />
                      </td>
                      <td className="px-4 py-2 font-semibold text-[#000638]">
                        {u.name}
                        {u.id === user.id && (
                          <span className="ml-1.5 text-[9px] font-normal text-gray-400">
                            (você)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{u.email}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            USER_ROLE_COLORS[u.role] ||
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {USER_ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            u.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => abrirEdicao(u)}
                          className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold mr-3 transition"
                          title="Editar"
                        >
                          <PencilSimple size={13} weight="bold" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={u.id === user.id}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title={
                            u.id === user.id
                              ? 'Você não pode excluir a si mesmo'
                              : 'Excluir'
                          }
                        >
                          <Trash size={13} weight="bold" />
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
              Mostrando {filtrados.length} de {usuarios.length} usuário(s)
            </div>
          </div>
        )}
      </div>

      {/* ─── Modal criar/editar ─────────────────────────────────────────── */}
      {modalAberto && (
        <ModalUsuario
          form={form}
          setForm={setForm}
          editando={editando}
          salvando={salvando}
          empresasSelecionadas={empresasSelecionadas}
          setEmpresasSelecionadas={setEmpresasSelecionadas}
          loadingEmpresas={loadingEmpresas}
          onSubmit={handleSubmit}
          onClose={fecharModal}
        />
      )}
    </div>
  );
}
