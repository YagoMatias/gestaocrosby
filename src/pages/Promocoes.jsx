import React, { useState, useCallback, useEffect } from 'react';
import useApiClient from '../hooks/useApiClient';
import { useAuth } from '../components/AuthContext';
import PageTitle from '../components/ui/PageTitle';
import Modal from '../components/ui/Modal';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '../components/ui/cards';
import {
  Ticket,
  MagnifyingGlass,
  CircleNotch,
  User,
  IdentificationCard,
  CheckCircle,
  WarningCircle,
  Copy,
  Check,
  Plus,
  ListBullets,
  Tag,
  PencilSimple,
  Trash,
  Power,
} from '@phosphor-icons/react';

const ADMIN_ROLES = ['owner', 'admin'];

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
};

const formatDocument = (doc) => {
  if (!doc) return '—';
  const d = String(doc).replace(/\D/g, '');
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
};

const formatDesconto = (tipo, valor) =>
  tipo === 'percentual' ? `${Number(valor || 0)}%` : formatCurrency(valor);

// ISO/timestamptz -> 'yyyy-mm-dd' para <input type="date">
const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');

const STATUS_STYLES = {
  ativa: 'bg-green-100 text-green-700 border-green-200',
  agendada: 'bg-blue-100 text-blue-700 border-blue-200',
  encerrada: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelada: 'bg-red-100 text-red-700 border-red-200',
};
const STATUS_LABELS = {
  ativa: 'Ativa',
  agendada: 'Agendada',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
      STATUS_STYLES[status] || STATUS_STYLES.encerrada
    }`}
  >
    {STATUS_LABELS[status] || status}
  </span>
);

const emptyForm = {
  nome: '',
  dataInicio: '',
  dataFim: '',
  descontoTipo: 'valor',
  descontoValor: '',
  compraMinima: '',
};

const Promocoes = () => {
  const { apiCall, apiMutate } = useApiClient();
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  // Grupos
  const [grupos, setGrupos] = useState([]);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [erroGrupos, setErroGrupos] = useState(null);

  // Modal criar/editar promoção
  const [modalForm, setModalForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(null);

  // Ativar/desativar e exclusão
  const [togglingId, setTogglingId] = useState(null);
  const [grupoExcluir, setGrupoExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  // Geração de voucher
  const [grupoSelecionado, setGrupoSelecionado] = useState('');
  const [query, setQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [erroBusca, setErroBusca] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [voucher, setVoucher] = useState(null);
  const [erroGeracao, setErroGeracao] = useState(null);
  const [copiado, setCopiado] = useState(false);

  // Modal lista de vouchers do grupo
  const [modalLista, setModalLista] = useState(false);
  const [listaGrupo, setListaGrupo] = useState(null);
  const [listaVouchers, setListaVouchers] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(false);

  const carregarGrupos = useCallback(async () => {
    setCarregandoGrupos(true);
    setErroGrupos(null);
    try {
      const result = await apiCall('/api/totvs/vouchers/promocoes');
      setGrupos(result?.data?.grupos || result?.grupos || []);
    } catch (error) {
      setErroGrupos(error.message || 'Erro ao carregar promoções.');
    } finally {
      setCarregandoGrupos(false);
    }
  }, [apiCall]);

  useEffect(() => {
    carregarGrupos();
  }, [carregarGrupos]);

  const gruposAtivos = grupos.filter((g) => g.status === 'ativa');

  const abrirCriar = useCallback(() => {
    setEditandoId(null);
    setForm(emptyForm);
    setErroSalvar(null);
    setModalForm(true);
  }, []);

  const abrirEditar = useCallback((g) => {
    setEditandoId(g.id);
    setForm({
      nome: g.nome || '',
      dataInicio: toDateInput(g.data_inicio),
      dataFim: toDateInput(g.data_fim),
      descontoTipo: g.desconto_tipo || 'valor',
      descontoValor: String(g.desconto_valor ?? ''),
      compraMinima: String(g.compra_minima ?? ''),
    });
    setErroSalvar(null);
    setModalForm(true);
  }, []);

  const salvarPromocao = useCallback(async () => {
    setErroSalvar(null);
    if (!form.nome.trim()) return setErroSalvar('Informe o nome da promoção.');
    if (!form.dataInicio) return setErroSalvar('Informe a data de início.');
    if (!form.dataFim) return setErroSalvar('Informe a data final.');
    if (new Date(form.dataInicio) > new Date(form.dataFim)) {
      return setErroSalvar('A data de início deve ser anterior à data final.');
    }
    const valor = Number(form.descontoValor);
    if (!Number.isFinite(valor) || valor <= 0) {
      return setErroSalvar('Informe um valor de desconto válido.');
    }
    if (form.descontoTipo === 'percentual' && valor > 100) {
      return setErroSalvar('O percentual não pode ser maior que 100%.');
    }

    setSalvando(true);
    try {
      const body = {
        nome: form.nome.trim(),
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        descontoTipo: form.descontoTipo,
        descontoValor: valor,
        compraMinima: form.compraMinima === '' ? 0 : Number(form.compraMinima),
      };
      if (editandoId) {
        await apiMutate(
          `/api/totvs/vouchers/promocoes/${editandoId}`,
          'PUT',
          { ...body, atualizadoPor: user?.email || null },
        );
      } else {
        await apiMutate('/api/totvs/vouchers/promocoes', 'POST', {
          ...body,
          criadoPor: user?.email || null,
        });
      }
      setModalForm(false);
      setEditandoId(null);
      setForm(emptyForm);
      await carregarGrupos();
    } catch (error) {
      setErroSalvar(error.message || 'Erro ao salvar promoção.');
    } finally {
      setSalvando(false);
    }
  }, [form, editandoId, apiMutate, user, carregarGrupos]);

  const toggleAtivo = useCallback(
    async (g) => {
      setTogglingId(g.id);
      try {
        await apiMutate(`/api/totvs/vouchers/promocoes/${g.id}`, 'PUT', {
          cancelado: !g.cancelado,
          atualizadoPor: user?.email || null,
        });
        await carregarGrupos();
      } catch (error) {
        setErroGrupos(error.message || 'Erro ao atualizar a promoção.');
      } finally {
        setTogglingId(null);
      }
    },
    [apiMutate, user, carregarGrupos],
  );

  const excluirPromocao = useCallback(async () => {
    if (!grupoExcluir) return;
    setExcluindo(true);
    try {
      await apiMutate(
        `/api/totvs/vouchers/promocoes/${grupoExcluir.id}`,
        'DELETE',
      );
      setGrupoExcluir(null);
      if (String(grupoSelecionado) === String(grupoExcluir.id)) {
        setGrupoSelecionado('');
      }
      await carregarGrupos();
    } catch (error) {
      setErroGrupos(error.message || 'Erro ao excluir a promoção.');
    } finally {
      setExcluindo(false);
    }
  }, [grupoExcluir, grupoSelecionado, apiMutate, carregarGrupos]);

  const buscarCliente = useCallback(async () => {
    const termo = query.trim();
    if (!termo) {
      setErroBusca('Informe o CPF, CNPJ ou código do cliente.');
      return;
    }
    setBuscando(true);
    setCliente(null);
    setErroBusca(null);
    setVoucher(null);
    setErroGeracao(null);
    try {
      const result = await apiMutate(
        '/api/totvs/vouchers/varejo/customer-lookup',
        'POST',
        { query: termo },
      );
      const c = result?.data?.customer;
      if (!c) {
        setErroBusca('Cliente não encontrado.');
        return;
      }
      setCliente(c);
    } catch (error) {
      setErroBusca(error.message || 'Erro ao buscar cliente.');
    } finally {
      setBuscando(false);
    }
  }, [query, apiMutate]);

  const gerarVoucher = useCallback(async () => {
    if (!cliente) return;
    if (!grupoSelecionado) {
      setErroGeracao('Selecione um grupo de promoção.');
      return;
    }
    setGerando(true);
    setErroGeracao(null);
    setVoucher(null);
    setCopiado(false);
    try {
      const result = await apiMutate(
        `/api/totvs/vouchers/promocoes/${grupoSelecionado}/generate`,
        'POST',
        {
          customerCode: cliente.code,
          cpfCnpj: cliente.document,
          customerName: cliente.name,
          criadoPor: user?.email || null,
        },
      );
      const data = result?.data;
      if (!data) {
        setErroGeracao('Resposta inesperada ao gerar o voucher.');
        return;
      }
      setVoucher(data);
      carregarGrupos();
    } catch (error) {
      setErroGeracao(error.message || 'Erro ao gerar o voucher.');
    } finally {
      setGerando(false);
    }
  }, [cliente, grupoSelecionado, apiMutate, user, carregarGrupos]);

  const copiarCodigo = useCallback((codigo) => {
    if (!codigo) return;
    try {
      navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  }, []);

  const abrirLista = useCallback(
    async (grupo) => {
      setListaGrupo(grupo);
      setModalLista(true);
      setCarregandoLista(true);
      setListaVouchers([]);
      try {
        const result = await apiCall(`/api/totvs/vouchers/promocoes/${grupo.id}`);
        setListaVouchers(result?.data?.vouchers || result?.vouchers || []);
      } catch {
        setListaVouchers([]);
      } finally {
        setCarregandoLista(false);
      }
    },
    [apiCall],
  );

  const codigoVoucher =
    voucher?.voucher?.voucherCode || voucher?.baseVoucherCode || null;

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      <PageTitle
        title="Promoções"
        subtitle="Crie campanhas de voucher e gere descontos vinculados a clientes"
        icon={Tag}
        iconColor="text-purple-600"
      />

      {/* ===== Grupos de promoção ===== */}
      <Card className="shadow-lg rounded-xl bg-white mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Ticket size={18} className="text-[#000638]" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Grupos de promoção
              </CardTitle>
            </div>
            {isAdmin && (
              <button
                onClick={abrirCriar}
                className="flex items-center gap-2 bg-[#000638] text-white px-3 py-1.5 rounded-lg hover:bg-[#fe0000] font-medium transition-colors text-sm"
              >
                <Plus size={16} weight="bold" />
                Criar Promoção
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          {carregandoGrupos ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-6 justify-center">
              <CircleNotch size={18} className="animate-spin" />
              Carregando promoções...
            </div>
          ) : erroGrupos ? (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <WarningCircle size={18} className="mt-0.5 shrink-0" />
              <span>{erroGrupos}</span>
            </div>
          ) : grupos.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              Nenhuma promoção cadastrada
              {isAdmin ? '. Clique em "Criar Promoção" para começar.' : '.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3">Promoção</th>
                    <th className="py-2 px-3">Desconto</th>
                    <th className="py-2 px-3">Compra mín.</th>
                    <th className="py-2 px-3">Período</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-center">Clientes</th>
                    <th className="py-2 pl-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr
                      key={g.id}
                      className="border-b border-gray-50 hover:bg-[#f8f9fb]"
                    >
                      <td className="py-2 pr-3 font-semibold text-[#000638]">
                        {g.nome}
                      </td>
                      <td className="py-2 px-3">
                        {formatDesconto(g.desconto_tipo, g.desconto_valor)}
                      </td>
                      <td className="py-2 px-3">
                        {formatCurrency(g.compra_minima)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-gray-600">
                        {formatDate(g.data_inicio)} — {formatDate(g.data_fim)}
                      </td>
                      <td className="py-2 px-3">
                        <StatusBadge status={g.status} />
                      </td>
                      <td className="py-2 px-3 text-center">{g.participantes}</td>
                      <td className="py-2 pl-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirLista(g)}
                            className="inline-flex items-center gap-1 text-[#000638] hover:text-[#fe0000] text-xs font-medium px-2 py-1 rounded hover:bg-gray-100"
                            title="Ver vouchers"
                          >
                            <ListBullets size={14} />
                            Ver vouchers
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => toggleAtivo(g)}
                                disabled={togglingId === g.id}
                                className={`p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 ${
                                  g.cancelado
                                    ? 'text-green-600'
                                    : 'text-amber-600'
                                }`}
                                title={
                                  g.cancelado
                                    ? 'Reativar promoção'
                                    : 'Desativar promoção'
                                }
                              >
                                {togglingId === g.id ? (
                                  <CircleNotch size={16} className="animate-spin" />
                                ) : (
                                  <Power size={16} weight={g.cancelado ? 'regular' : 'fill'} />
                                )}
                              </button>
                              <button
                                onClick={() => abrirEditar(g)}
                                className="p-1.5 rounded hover:bg-gray-100 text-[#000638]"
                                title="Editar promoção"
                              >
                                <PencilSimple size={16} />
                              </button>
                              <button
                                onClick={() => setGrupoExcluir(g)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-600"
                                title="Excluir promoção"
                              >
                                <Trash size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Gerar voucher ===== */}
      <Card className="shadow-lg rounded-xl bg-white mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Ticket size={18} className="text-[#000638]" />
            <CardTitle className="text-sm font-bold text-[#000638]">
              Gerar voucher
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <CardDescription className="text-xs text-gray-500 mb-4">
            Escolha uma promoção ativa e o cliente que receberá o voucher
          </CardDescription>

          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">
              Promoção
            </label>
            <select
              value={grupoSelecionado}
              onChange={(e) => setGrupoSelecionado(e.target.value)}
              className="w-full border border-[#000638]/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-sm"
            >
              <option value="">Selecione uma promoção ativa...</option>
              {gruposAtivos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome} — {formatDesconto(g.desconto_tipo, g.desconto_valor)}{' '}
                  (mín. {formatCurrency(g.compra_minima)})
                </option>
              ))}
            </select>
            {gruposAtivos.length === 0 && !carregandoGrupos && (
              <p className="text-xs text-amber-600 mt-1">
                Nenhuma promoção ativa no momento.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') buscarCliente();
              }}
              placeholder="CPF, CNPJ ou código do cliente"
              className="flex-1 border border-[#000638]/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-sm"
            />
            <button
              onClick={buscarCliente}
              disabled={buscando || !query.trim()}
              className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors justify-center text-sm"
            >
              {buscando ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <MagnifyingGlass size={16} />
                  Buscar
                </>
              )}
            </button>
          </div>

          {erroBusca && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <WarningCircle size={18} className="mt-0.5 shrink-0" />
              <span>{erroBusca}</span>
            </div>
          )}

          {cliente && (
            <div className="mt-4 border border-[#000638]/15 rounded-xl p-4 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#000638]/10 text-[#000638]">
                  {cliente.personType === 'PJ'
                    ? 'Pessoa Jurídica'
                    : 'Pessoa Física'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <User size={18} className="text-[#000638] shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      Nome
                    </p>
                    <p className="text-sm font-semibold text-[#000638]">
                      {cliente.name || '—'}
                    </p>
                    {cliente.fantasyName && (
                      <p className="text-xs text-gray-500">
                        {cliente.fantasyName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IdentificationCard
                    size={18}
                    className="text-[#000638] shrink-0"
                  />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">
                      {cliente.documentType}
                    </p>
                    <p className="text-sm font-semibold text-[#000638]">
                      {formatDocument(cliente.document)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Código: {cliente.code}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={gerarVoucher}
                disabled={gerando || !grupoSelecionado}
                className="mt-4 w-full flex items-center gap-2 bg-[#fe0000] text-white px-4 py-2.5 rounded-lg hover:bg-[#c50000] disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors justify-center text-sm"
              >
                {gerando ? (
                  <>
                    <CircleNotch size={18} className="animate-spin" />
                    Gerando voucher...
                  </>
                ) : (
                  <>
                    <Ticket size={18} />
                    GERAR VOUCHER
                  </>
                )}
              </button>
            </div>
          )}

          {erroGeracao && (
            <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <WarningCircle size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Não foi possível gerar o voucher</p>
                <p className="text-red-600">{erroGeracao}</p>
              </div>
            </div>
          )}

          {voucher && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={20} className="text-green-600" weight="fill" />
                <p className="text-sm font-bold text-green-700">
                  Voucher gerado com sucesso
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <p className="text-[10px] uppercase tracking-wide text-green-700">
                  Código do voucher
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-extrabold tracking-wider text-green-800">
                    {codigoVoucher || '—'}
                  </p>
                  {codigoVoucher && (
                    <button
                      onClick={() => copiarCodigo(codigoVoucher)}
                      className="p-1.5 rounded-lg hover:bg-green-100 text-green-700 transition-colors"
                      title="Copiar código"
                    >
                      {copiado ? (
                        <Check size={18} weight="bold" />
                      ) : (
                        <Copy size={18} />
                      )}
                    </button>
                  )}
                </div>
                {voucher.voucher?.voucherNumber && (
                  <p className="text-xs text-green-700 mt-1">
                    Nº {voucher.voucher.voucherNumber}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Modal: Criar/Editar Promoção ===== */}
      <Modal
        isOpen={modalForm}
        onClose={() => setModalForm(false)}
        title={editandoId ? 'Editar Promoção' : 'Criar Promoção'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nome da promoção
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Promoção de Aniversário"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Data de início
              </label>
              <input
                type="date"
                value={form.dataInicio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dataInicio: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Data final
              </label>
              <input
                type="date"
                value={form.dataFim}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dataFim: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tipo de desconto
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="descontoTipo"
                  value="valor"
                  checked={form.descontoTipo === 'valor'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, descontoTipo: e.target.value }))
                  }
                />
                Valor (R$)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="descontoTipo"
                  value="percentual"
                  checked={form.descontoTipo === 'percentual'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, descontoTipo: e.target.value }))
                  }
                />
                Percentual (%)
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {form.descontoTipo === 'percentual'
                  ? 'Desconto (%)'
                  : 'Desconto (R$)'}
              </label>
              <input
                type="number"
                min="0"
                step={form.descontoTipo === 'percentual' ? '1' : '0.01'}
                value={form.descontoValor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descontoValor: e.target.value }))
                }
                placeholder={form.descontoTipo === 'percentual' ? '10' : '50.00'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Compra mínima (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.compraMinima}
                onChange={(e) =>
                  setForm((f) => ({ ...f, compraMinima: e.target.value }))
                }
                placeholder="100.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]"
              />
            </div>
          </div>

          {erroSalvar && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <WarningCircle size={18} className="mt-0.5 shrink-0" />
              <span>{erroSalvar}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalForm(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={salvarPromocao}
              disabled={salvando}
              className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 font-medium text-sm"
            >
              {salvando ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  {editandoId ? (
                    <Check size={16} weight="bold" />
                  ) : (
                    <Plus size={16} weight="bold" />
                  )}
                  {editandoId ? 'Salvar alterações' : 'Criar Promoção'}
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== Modal: Confirmar exclusão ===== */}
      <Modal
        isOpen={!!grupoExcluir}
        onClose={() => setGrupoExcluir(null)}
        title="Excluir Promoção"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-gray-700 text-sm">
            <WarningCircle size={22} className="mt-0.5 shrink-0 text-red-600" />
            <p>
              Tem certeza que deseja excluir a promoção{' '}
              <span className="font-semibold text-[#000638]">
                {grupoExcluir?.nome}
              </span>
              ?
              {grupoExcluir?.participantes > 0 && (
                <>
                  {' '}Ela possui{' '}
                  <span className="font-semibold">
                    {grupoExcluir.participantes}
                  </span>{' '}
                  voucher(s) vinculado(s), que também serão removidos do
                  registro. Esta ação não pode ser desfeita.
                </>
              )}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setGrupoExcluir(null)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={excluirPromocao}
              disabled={excluindo}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
            >
              {excluindo ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash size={16} />
                  Excluir
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== Modal: Lista de vouchers do grupo ===== */}
      <Modal
        isOpen={modalLista}
        onClose={() => setModalLista(false)}
        title={listaGrupo ? `Vouchers — ${listaGrupo.nome}` : 'Vouchers'}
        size="3xl"
      >
        {carregandoLista ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-6 justify-center">
            <CircleNotch size={18} className="animate-spin" />
            Carregando...
          </div>
        ) : listaVouchers.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            Nenhum voucher gerado nesta promoção ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 px-3">Documento</th>
                  <th className="py-2 px-3">Desconto</th>
                  <th className="py-2 px-3">Código</th>
                  <th className="py-2 pl-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {listaVouchers.map((v) => (
                  <tr key={v.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-medium text-[#000638]">
                      {v.customer_name || `Cód. ${v.customer_code}`}
                    </td>
                    <td className="py-2 px-3 text-gray-600">
                      {formatDocument(v.customer_cpf_cnpj)}
                    </td>
                    <td className="py-2 px-3">
                      {formatDesconto(v.desconto_tipo, v.valor)}
                    </td>
                    <td className="py-2 px-3 font-semibold text-green-700">
                      {v.voucher_code || '—'}
                    </td>
                    <td className="py-2 pl-3 text-gray-600 whitespace-nowrap">
                      {formatDate(v.criado_em)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Promocoes;
