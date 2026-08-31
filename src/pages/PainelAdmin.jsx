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
  UsersThree,
  X,
  Spinner,
  Crown,
  Buildings,
  Plus,
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
import {
  getSetoresComMembros,
  setGestorSetor,
  addUsersToSetores,
  removeUserFromSetor,
} from '../services/setoresService';
import LoadingSpinner from '../components/LoadingSpinner';
import Notification from '../components/Notification';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import {
  USER_ROLE_LABELS,
  USER_ROLE_COLORS,
  GESTOR_ELIGIBLE_ROLES,
} from '../config/constants';

const perfis = Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const FORM_VAZIO = {
  id: null,
  name: '',
  email: '',
  password: '',
  role: 'guest',
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

// ─── Modal: adicionar usuários em massa aos setores ──────────────────────────
const ModalSetoresMassa = ({
  usuarios,
  setores,
  preSelectedUserIds,
  onClose,
  onDone,
}) => {
  const [userIds, setUserIds] = useState(new Set(preSelectedUserIds || []));
  const [setorIds, setSetorIds] = useState(new Set());
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const usuariosFiltrados = useMemo(() => {
    const lista = usuarios.filter((u) => u.role !== 'franquias');
    if (!busca) return lista;
    const s = busca.toLowerCase();
    return lista.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s),
    );
  }, [usuarios, busca]);

  const toggle = (set, setFn, id) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const todosFiltradosMarcados =
    usuariosFiltrados.length > 0 &&
    usuariosFiltrados.every((u) => userIds.has(u.id));

  const toggleTodos = () => {
    setUserIds((prev) => {
      const next = new Set(prev);
      if (todosFiltradosMarcados) {
        usuariosFiltrados.forEach((u) => next.delete(u.id));
      } else {
        usuariosFiltrados.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

  const handleAplicar = async () => {
    setErro('');
    if (userIds.size === 0 || setorIds.size === 0) {
      setErro('Selecione pelo menos um usuário e um setor.');
      return;
    }
    setSalvando(true);
    const { error } = await addUsersToSetores([...userIds], [...setorIds]);
    setSalvando(false);
    if (error) {
      setErro(error.message || 'Erro ao adicionar usuários aos setores.');
      return;
    }
    onDone(userIds.size, setorIds.size);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#000638] text-base flex items-center gap-2">
            <UsersThree size={20} weight="bold" />
            Adicionar Usuários aos Setores
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 overflow-hidden flex-1">
          {/* Coluna usuários */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#000638]">
                Usuários ({userIds.size} selecionado(s))
              </span>
              <button
                type="button"
                onClick={toggleTodos}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900"
              >
                {todosFiltradosMarcados
                  ? 'Desmarcar filtrados'
                  : `Marcar filtrados (${usuariosFiltrados.length})`}
              </button>
            </div>
            <div className="relative mb-2">
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="border border-[#000638]/30 rounded-lg pl-8 pr-3 py-1.5 w-full text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
            </div>
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 min-h-[200px]">
              {usuariosFiltrados.map((u) => (
                <label
                  key={u.id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs transition ${
                    userIds.has(u.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={userIds.has(u.id)}
                    onChange={() => toggle(userIds, setUserIds, u.id)}
                    className="!w-4 !h-4 !p-0 !m-0 flex-none shrink-0 accent-[#000638]"
                  />
                  <span className="flex-1 min-w-0 flex flex-col text-left">
                    <span className="font-semibold text-[#000638] truncate">
                      {u.name}
                    </span>
                    <span className="text-gray-400 text-[10px] truncate">
                      {u.email}
                    </span>
                  </span>
                </label>
              ))}
              {usuariosFiltrados.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">
                  Nenhum usuário encontrado.
                </p>
              )}
            </div>
          </div>

          {/* Coluna setores */}
          <div className="flex flex-col min-h-0">
            <span className="text-xs font-bold text-[#000638] mb-2">
              Setores ({setorIds.size} selecionado(s))
            </span>
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 min-h-[200px]">
              {setores.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer text-xs transition ${
                    setorIds.has(s.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={setorIds.has(s.id)}
                    onChange={() => toggle(setorIds, setSetorIds, s.id)}
                    className="!w-4 !h-4 !p-0 !m-0 flex-none shrink-0 accent-[#000638]"
                  />
                  <Buildings size={14} className="text-[#000638] shrink-0" />
                  <span className="flex-1 min-w-0 font-semibold text-[#000638] truncate text-left">
                    {s.nome}
                  </span>
                  <span className="text-gray-400 shrink-0 whitespace-nowrap">
                    {s.membros.length} membro(s)
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
          {erro && <p className="text-red-600 text-xs">{erro}</p>}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAplicar}
              disabled={salvando}
              className="flex items-center gap-2 bg-[#000638] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-60"
            >
              {salvando && <Spinner size={14} className="animate-spin" />}
              Adicionar aos Setores
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Card de setor (aba Setores & Gestores) ──────────────────────────────────
const SetorCard = ({ setor, usuariosById, gestoresElegiveis, onSetGestor, onRemoverMembro }) => {
  const gestor = setor.gestor_id ? usuariosById[setor.gestor_id] : null;
  // Membros abaixo do gestor (gestor não aparece duplicado na lista)
  const membros = setor.membros
    .map((m) => usuariosById[m.user_id])
    .filter((u) => u && u.id !== setor.gestor_id)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="bg-[#000638] text-white px-4 py-2.5 flex items-center justify-between">
        <span className="font-bold text-xs tracking-wide flex items-center gap-2">
          <Buildings size={15} weight="bold" />
          {setor.nome}
        </span>
        <span className="text-[10px] bg-white/15 rounded-full px-2 py-0.5">
          {membros.length + (gestor ? 1 : 0)} pessoa(s)
        </span>
      </div>

      {/* Gestor */}
      <div className="px-4 py-3 border-b border-gray-100 bg-amber-50/50">
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">
          <Crown size={13} weight="fill" className="text-amber-500" />
          Gestor do Setor
        </label>
        <select
          value={setor.gestor_id || ''}
          onChange={(e) => onSetGestor(setor, e.target.value || null)}
          className="border border-amber-300 rounded-lg px-2 py-1.5 w-full text-xs bg-white text-[#000638] focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">— Sem gestor definido —</option>
          {gestoresElegiveis.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({USER_ROLE_LABELS[g.role] || g.role})
            </option>
          ))}
        </select>
      </div>

      {/* Membros abaixo do gestor */}
      <div className="flex-1 px-2 py-2 max-h-56 overflow-y-auto">
        {membros.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-4">
            Nenhum membro neste setor.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {membros.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-lg hover:bg-gray-50 group relative"
              >
                <span className="absolute left-2 top-0 bottom-1/2 w-2.5 border-l border-b border-gray-300 rounded-bl" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#000638] truncate">
                    {m.name}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 ${
                    USER_ROLE_COLORS[m.role] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {USER_ROLE_LABELS[m.role] || m.role}
                </span>
                <button
                  onClick={() => onRemoverMembro(setor, m)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition shrink-0"
                  title={`Remover ${m.name} do setor ${setor.nome}`}
                >
                  <X size={13} weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ─── Página ──────────────────────────────────────────────────────────────────
export default function PainelAdmin() {
  const { user } = useAuth();
  const [aba, setAba] = useState('usuarios'); // 'usuarios' | 'setores'
  const [usuarios, setUsuarios] = useState([]);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSetores, setLoadingSetores] = useState(true);
  const [erro, setErro] = useState('');
  const [success, setSuccess] = useState('');

  // Filtros (aba usuários)
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');

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

  // Modal setores em massa
  const [modalSetoresAberto, setModalSetoresAberto] = useState(false);

  const usuariosById = useMemo(() => {
    const map = {};
    usuarios.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [usuarios]);

  // Mapa user_id → nomes de setores (membro ou gestor)
  const setoresPorUsuario = useMemo(() => {
    const map = {};
    const add = (userId, nome) => {
      if (!userId) return;
      if (!map[userId]) map[userId] = [];
      if (!map[userId].includes(nome)) map[userId].push(nome);
    };
    setores.forEach((s) => {
      add(s.gestor_id, s.nome);
      s.membros.forEach((m) => add(m.user_id, s.nome));
    });
    return map;
  }, [setores]);

  const gestoresElegiveis = useMemo(
    () =>
      usuarios
        .filter((u) => u.active && GESTOR_ELIGIBLE_ROLES.includes(u.role))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [usuarios],
  );

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

  const fetchSetores = async () => {
    setLoadingSetores(true);
    const { data, error } = await getSetoresComMembros();
    if (error) {
      setErro(
        'Erro ao carregar setores. Verifique se a migration create_setores_gestores.sql foi executada. ' +
          (error.message || ''),
      );
    } else {
      setSetores(data);
    }
    setLoadingSetores(false);
  };

  useEffect(() => {
    if (!user || user.role !== 'owner') return;
    fetchUsuarios();
    fetchSetores();
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
    if (filtroSetor)
      lista = lista.filter((u) =>
        (setoresPorUsuario[u.id] || []).includes(filtroSetor),
      );
    return lista;
  }, [usuarios, busca, filtroRole, filtroStatus, filtroSetor, setoresPorUsuario]);

  const resumo = useMemo(
    () => ({
      total: usuarios.length,
      ativos: usuarios.filter((u) => u.active).length,
      inativos: usuarios.filter((u) => !u.active).length,
      gestores: setores.filter((s) => s.gestor_id).length,
    }),
    [usuarios, setores],
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
      (id) => {
        const u = usuariosById[id];
        return updateUser(id, { name: u?.name, role: roleMassa });
      },
      { pularProprio: true },
    );
  };

  // ─── Setores ───────────────────────────────────────────────────────────────
  const handleSetGestor = async (setor, gestorId) => {
    setErro('');
    const { error } = await setGestorSetor(setor.id, gestorId);
    if (error) {
      setErro('Erro ao definir gestor: ' + (error.message || ''));
      return;
    }
    setSuccess(
      gestorId
        ? `Gestor do setor ${setor.nome} atualizado!`
        : `Gestor removido do setor ${setor.nome}.`,
    );
    fetchSetores();
  };

  const handleRemoverMembro = async (setor, membro) => {
    if (
      !window.confirm(`Remover "${membro.name}" do setor ${setor.nome}?`)
    )
      return;
    setErro('');
    const { error } = await removeUserFromSetor(setor.id, membro.id);
    if (error) {
      setErro('Erro ao remover membro: ' + (error.message || ''));
      return;
    }
    setSuccess(`${membro.name} removido(a) do setor ${setor.nome}.`);
    fetchSetores();
  };

  const handleSetoresMassaDone = (qtdUsuarios, qtdSetores) => {
    setModalSetoresAberto(false);
    setSelecionados(new Set());
    setSuccess(
      `${qtdUsuarios} usuário(s) adicionado(s) a ${qtdSetores} setor(es)!`,
    );
    fetchSetores();
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
      fetchSetores();
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
          subtitle="Gerencie usuários, perfis, setores e gestores do sistema"
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
          <div className="bg-amber-50 rounded-lg border border-amber-300 shadow-sm px-4 py-2 min-w-[130px]">
            <p className="text-[9px] text-amber-700 uppercase tracking-wide">
              Setores c/ Gestor
            </p>
            <p className="text-sm font-bold text-amber-700">
              {resumo.gestores}/{setores.length}
            </p>
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

        {/* ─── Abas ────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
          <button
            onClick={() => setAba('usuarios')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              aba === 'usuarios'
                ? 'bg-[#000638] text-white shadow'
                : 'text-gray-500 hover:text-[#000638] hover:bg-gray-50'
            }`}
          >
            <Users size={15} weight="bold" />
            Usuários
          </button>
          <button
            onClick={() => setAba('setores')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              aba === 'setores'
                ? 'bg-[#000638] text-white shadow'
                : 'text-gray-500 hover:text-[#000638] hover:bg-gray-50'
            }`}
          >
            <Buildings size={15} weight="bold" />
            Setores & Gestores
          </button>
        </div>

        {/* ════════════════ ABA USUÁRIOS ════════════════ */}
        {aba === 'usuarios' && (
          <>
            {/* ─── Filtros + novo usuário ──────────────────────────────── */}
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
                    Setor
                  </label>
                  <select
                    value={filtroSetor}
                    onChange={(e) => setFiltroSetor(e.target.value)}
                    className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-44 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
                  >
                    <option value="">Todos</option>
                    {setores.map((s) => (
                      <option key={s.id} value={s.nome}>
                        {s.nome}
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

            {/* ─── Barra de ações em massa ─────────────────────────────── */}
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
                <button
                  onClick={() => setModalSetoresAberto(true)}
                  disabled={processandoMassa}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                >
                  <Buildings size={13} weight="bold" />
                  Adicionar a Setores
                </button>
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

            {/* ─── Tabela de usuários ──────────────────────────────────── */}
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
                        <th className="px-3 py-2.5 text-left font-bold">
                          Setores
                        </th>
                        <th className="px-3 py-2.5 text-center font-bold">
                          Status
                        </th>
                        <th className="px-3 py-2.5 text-center font-bold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map((u) => {
                        const setoresDoUsuario = setoresPorUsuario[u.id] || [];
                        const ehGestor = setores.some(
                          (s) => s.gestor_id === u.id,
                        );
                        return (
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
                              <span className="inline-flex items-center gap-1">
                                {ehGestor && (
                                  <Crown
                                    size={12}
                                    weight="fill"
                                    className="text-amber-500"
                                    title="Gestor de setor"
                                  />
                                )}
                                {u.name}
                              </span>
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
                            <td className="px-3 py-2">
                              {setoresDoUsuario.length === 0 ? (
                                <span className="text-[10px] text-gray-300">
                                  —
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                  {setoresDoUsuario.slice(0, 3).map((nome) => (
                                    <span
                                      key={nome}
                                      className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-semibold border border-indigo-100"
                                    >
                                      {nome}
                                    </span>
                                  ))}
                                  {setoresDoUsuario.length > 3 && (
                                    <span
                                      className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[9px] font-semibold"
                                      title={setoresDoUsuario.slice(3).join(', ')}
                                    >
                                      +{setoresDoUsuario.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
                  Mostrando {filtrados.length} de {usuarios.length} usuário(s)
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════ ABA SETORES & GESTORES ════════════════ */}
        {aba === 'setores' && (
          <>
            <div className="bg-white border border-[#000638]/10 rounded-xl shadow-sm p-4 mb-4 flex flex-wrap items-center gap-3">
              <div>
                <p className="font-bold text-[#000638] text-sm">
                  Setores & Gestores
                </p>
                <p className="text-xs text-gray-500">
                  Defina o gestor de cada setor (perfil Gerente, Administrador
                  ou Proprietário) e gerencie os membros. Um usuário pode estar
                  em vários setores e um gestor pode cuidar de mais de um setor.
                </p>
              </div>
              <button
                onClick={() => setModalSetoresAberto(true)}
                className="flex items-center gap-1.5 bg-[#000638] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition ml-auto"
              >
                <Plus size={14} weight="bold" />
                Adicionar Usuários em Massa
              </button>
            </div>

            {loadingSetores || loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Spinner size={36} className="animate-spin mb-3 text-[#000638]" />
                <p className="text-sm">Carregando setores...</p>
              </div>
            ) : setores.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                <Buildings size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  Nenhum setor encontrado. Execute a migration
                  create_setores_gestores.sql no Supabase.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {setores.map((setor) => (
                  <SetorCard
                    key={setor.id}
                    setor={setor}
                    usuariosById={usuariosById}
                    gestoresElegiveis={gestoresElegiveis}
                    onSetGestor={handleSetGestor}
                    onRemoverMembro={handleRemoverMembro}
                  />
                ))}
              </div>
            )}
          </>
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

      {/* ─── Modal setores em massa ─────────────────────────────────────── */}
      {modalSetoresAberto && (
        <ModalSetoresMassa
          usuarios={usuarios}
          setores={setores}
          preSelectedUserIds={[...selecionados]}
          onClose={() => setModalSetoresAberto(false)}
          onDone={handleSetoresMassaDone}
        />
      )}
    </div>
  );
}
