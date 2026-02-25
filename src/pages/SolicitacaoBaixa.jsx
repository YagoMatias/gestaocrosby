import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabase, supabaseAdmin } from '../lib/supabase';
import PageTitle from '../components/ui/PageTitle';
import Notification from '../components/ui/Notification';
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
} from '@phosphor-icons/react';

const SolicitacaoBaixa = () => {
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [filtroPortador, setFiltroPortador] = useState('TODOS');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [processingBaixa, setProcessingBaixa] = useState(false);

  // Modal de comprovante
  const [modalComprovante, setModalComprovante] = useState(null);

  // Modal de rejeição
  const [modalRejeicao, setModalRejeicao] = useState(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';

  // Carregar solicitações
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
    return lista;
  }, [solicitacoes, filtroStatus, filtroPortador]);

  // Totais por status
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
  const toggleItem = (id) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Selecionar todos filtrados
  const toggleSelectAll = () => {
    const ids = solicitacoesFiltradas.map((s) => s.id);
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
    const selecionadas = solicitacoesFiltradas.filter((s) =>
      selectedItems.has(s.id),
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

    if (
      !window.confirm(
        `Processar baixa de ${pendentes.length} fatura(s) no TOTVS?\n\nValor total: ${valorTotalSelecionado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\nEssa ação não pode ser desfeita.`,
      )
    )
      return;

    setProcessingBaixa(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const items = pendentes.map((s) => ({
        branchCode: s.cd_empresa,
        customerCode: s.cd_cliente,
        receivableCode: s.nr_fat,
        installmentCode: s.nr_parcela || 1,
        paidValue: parseFloat(s.vl_fatura) || 0,
      }));

      const response = await fetch(`${TotvsURL}invoices-settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      const result = await response.json();

      // Atualizar status no Supabase baseado nos resultados
      if (result.results) {
        for (const r of result.results) {
          const sol = pendentes.find(
            (s) =>
              s.nr_fat === r.receivableCode && s.cd_empresa === r.branchCode,
          );
          if (sol) {
            await supabaseAdmin
              .from('solicitacoes_baixa')
              .update({
                status: 'processada',
                processado_por: user?.id || null,
                processado_em: new Date().toISOString(),
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
        setNotification({
          type: 'error',
          message: `${successCount} sucesso, ${errorCount} erro(s). Verifique os detalhes.`,
        });
      }
      setTimeout(() => setNotification(null), 5000);
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
    const d = new Date(data);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('pt-BR');
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
          {selectedItems.size > 0 && (
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
                        className="accent-[#000638] cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleItem(sol.id)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.color}`}
                      >
                        <StatusIcon size={12} weight="bold" />
                        {config.label}
                      </span>
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
                    <td className="px-3 py-2">
                      <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium text-[10px]">
                        {sol.nm_portador || sol.cd_portador || '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium">{sol.user_nome || '--'}</div>
                      <div className="text-[10px] text-gray-400">
                        {sol.user_email}
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
                  <img
                    src={modalComprovante.comprovante_url}
                    alt="Comprovante"
                    className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                  />
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
