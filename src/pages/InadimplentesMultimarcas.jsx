import React, { useState, useEffect, useMemo, useRef } from 'react';
import FiltroEstados from '../components/filters/FiltroEstados';
import FiltroClientes from '../components/filters/FiltroClientes';
import useApiClient from '../hooks/useApiClient';
import { useAuth } from '../components/AuthContext';
import useClassificacoesInadimplentes from '../hooks/useClassificacoesInadimplentes';
import PageTitle from '../components/ui/PageTitle';
import Notification from '../components/ui/Notification';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import {
  ChartBar,
  CalendarBlank,
  MagnifyingGlass,
  ArrowClockwise,
  CircleNotch,
  Users,
  CurrencyDollar,
  MapPin,
  Receipt,
  Clock,
  Warning,
  Handshake,
  ChatCircleDots,
  FileText,
  Gavel,
  TrendUp,
  Smiley,
  ClockClockwise,
  CheckCircle,
} from '@phosphor-icons/react';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

const InadimplentesMultimarcas = () => {
  const apiClient = useApiClient();
  const { user } = useAuth();
  const {
    salvarClassificacao,
    buscarClassificacoes,
    deletarClassificacao,
    buscarHistorico,
    salvarObservacao,
    buscarObservacoes,
  } = useClassificacoesInadimplentes();

  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  // Datas padrão: início em 01-04-2024 e fim no dia atual
  const [filtroDataInicial, setFiltroDataInicial] = useState('2024-04-01');
  const hojeStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [filtroDataFinal, setFiltroDataFinal] = useState(hojeStr);
  const [filtroClientes, setFiltroClientes] = useState([]); // array de cd_cliente selecionados
  const [filtroEstados, setFiltroEstados] = useState([]); // array de siglas selecionadas

  // Estado para o modal de detalhes do cliente
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [faturasSelecionadas, setFaturasSelecionadas] = useState([]);

  // Estado para o modal de lista de clientes filtrados
  const [modalListaAberto, setModalListaAberto] = useState(false);
  const [tituloModalLista, setTituloModalLista] = useState('');
  const [clientesFiltradosModal, setClientesFiltradosModal] = useState([]);

  // Estado para o modal de histórico
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [historicoSelecionado, setHistoricoSelecionado] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Estado para Feeling e Status de cada cliente (valores salvos)
  const [clienteFeeling, setClienteFeeling] = useState({}); // { cd_cliente: 'POSSÍVEL PAGAMENTO' | 'ATRASO' }
  const [clienteStatus, setClienteStatus] = useState({}); // { cd_cliente: 'ACORDO' | 'ACORDO EM ANDAMENTO' | 'COBRANÇA' | 'PROTESTADO' }
  const [clienteRepresentante, setClienteRepresentante] = useState({}); // { cd_cliente: 'Nome do Representante' }

  // Estados para controle de edição
  const [editandoFeeling, setEditandoFeeling] = useState(null); // cd_cliente em edição
  const [editandoStatus, setEditandoStatus] = useState(null); // cd_cliente em edição
  const [editandoRepresentante, setEditandoRepresentante] = useState(null); // cd_cliente em edição
  const [tempFeeling, setTempFeeling] = useState(''); // valor temporário do select
  const [tempStatus, setTempStatus] = useState(''); // valor temporário do select
  const [tempRepresentante, setTempRepresentante] = useState(''); // valor temporário do input

  // Estados para modal de observações
  const [modalObservacoesAberto, setModalObservacoesAberto] = useState(false);
  const [clienteObservacoes, setClienteObservacoes] = useState(null); // cliente selecionado para observações
  const [observacoesList, setObservacoesList] = useState([]); // lista de observações do cliente
  const [novaObservacao, setNovaObservacao] = useState(''); // texto da nova observação
  const [loadingObservacoes, setLoadingObservacoes] = useState(false);

  // Estados para controle de ordenação
  const [ordenarPor, setOrdenarPor] = useState(null); // coluna atual de ordenação
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState('asc'); // 'asc' ou 'desc'

  // Função para ordenar colunas
  const ordenarColuna = (coluna) => {
    if (ordenarPor === coluna) {
      // Se já está ordenando por esta coluna, inverte a direção
      setDirecaoOrdenacao(direcaoOrdenacao === 'asc' ? 'desc' : 'asc');
    } else {
      // Nova coluna, começa com ascendente
      setOrdenarPor(coluna);
      setDirecaoOrdenacao('asc');
    }
  };

  // Handlers para iniciar edição
  const iniciarEdicaoFeeling = (cdCliente, e) => {
    e.stopPropagation();
    setEditandoFeeling(cdCliente);
    setTempFeeling(clienteFeeling[cdCliente] || '');
  };

  const iniciarEdicaoStatus = (cdCliente, e) => {
    e.stopPropagation();
    setEditandoStatus(cdCliente);
    setTempStatus(clienteStatus[cdCliente] || '');
  };

  // Handlers para salvar
  const salvarFeeling = async (cdCliente, e) => {
    e.stopPropagation();
    if (!tempFeeling) return;

    // Atualizar estado local
    setClienteFeeling((prev) => ({
      ...prev,
      [cdCliente]: tempFeeling,
    }));
    setEditandoFeeling(null);
    setTempFeeling('');

    // SALVAR NO SUPABASE
    const cliente = clientesAgrupados.find((c) => c.cd_cliente === cdCliente);

    if (cliente && user) {
      const classificacao = {
        cd_cliente: cliente.cd_cliente,
        nm_cliente: cliente.nm_cliente,
        valor_total: cliente.valor_total,
        ds_siglaest: cliente.ds_siglaest?.trim() || null,
        situacao: cliente.situacao,
        feeling: tempFeeling,
        status: clienteStatus[cdCliente] || null,
        usuario: user.email || user.id,
      };

      const { success, error } = await salvarClassificacao(classificacao);

      if (success) {
        setNotification({
          type: 'success',
          message: 'Feeling salvo com sucesso!',
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({
          type: 'error',
          message: `Erro ao salvar: ${error}`,
        });
      }
    }
  };

  const salvarStatus = async (cdCliente, e) => {
    e.stopPropagation();
    if (!tempStatus) return;

    // Atualizar estado local
    setClienteStatus((prev) => ({
      ...prev,
      [cdCliente]: tempStatus,
    }));
    setEditandoStatus(null);
    setTempStatus('');

    // SALVAR NO SUPABASE
    const cliente = clientesAgrupados.find((c) => c.cd_cliente === cdCliente);

    if (cliente && user) {
      const classificacao = {
        cd_cliente: cliente.cd_cliente,
        nm_cliente: cliente.nm_cliente,
        valor_total: cliente.valor_total,
        ds_siglaest: cliente.ds_siglaest?.trim() || null,
        situacao: cliente.situacao,
        feeling: clienteFeeling[cdCliente] || null,
        status: tempStatus,
        usuario: user.email || user.id,
      };

      const { success, error } = await salvarClassificacao(classificacao);

      if (success) {
        setNotification({
          type: 'success',
          message: 'Status salvo com sucesso!',
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({
          type: 'error',
          message: `Erro ao salvar: ${error}`,
        });
      }
    }
  };

  // Handlers para cancelar
  const cancelarEdicaoFeeling = (e) => {
    e.stopPropagation();
    setEditandoFeeling(null);
    setTempFeeling('');
  };

  const cancelarEdicaoStatus = (e) => {
    e.stopPropagation();
    setEditandoStatus(null);
    setTempStatus('');
  };

  const cancelarEdicaoRepresentante = (e) => {
    e.stopPropagation();
    setEditandoRepresentante(null);
    setTempRepresentante('');
  };

  // Handler para iniciar edição do representante
  const iniciarEdicaoRepresentante = (cdCliente, e) => {
    e.stopPropagation();
    setEditandoRepresentante(cdCliente);
    setTempRepresentante(clienteRepresentante[cdCliente] || '');
  };

  // Handler para salvar representante
  const salvarRepresentante = async (cdCliente, e) => {
    e.stopPropagation();
    if (!tempRepresentante) return;

    // Atualizar estado local
    setClienteRepresentante((prev) => ({
      ...prev,
      [cdCliente]: tempRepresentante,
    }));
    setEditandoRepresentante(null);
    setTempRepresentante('');

    // SALVAR NO SUPABASE
    const cliente = clientesAgrupados.find((c) => c.cd_cliente === cdCliente);

    if (cliente && user) {
      const classificacao = {
        cd_cliente: cliente.cd_cliente,
        nm_cliente: cliente.nm_cliente,
        valor_total: cliente.valor_total,
        ds_siglaest: cliente.ds_siglaest?.trim() || null,
        situacao: cliente.situacao,
        feeling: clienteFeeling[cdCliente] || null,
        status: clienteStatus[cdCliente] || null,
        representante: tempRepresentante,
        usuario: user.email || user.id,
      };

      const { success, error } = await salvarClassificacao(classificacao);

      if (success) {
        setNotification({
          type: 'success',
          message: 'Representante salvo com sucesso!',
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({
          type: 'error',
          message: `Erro ao salvar: ${error}`,
        });
      }
    }
  };

  // Handler para abrir modal de observações
  const abrirModalObservacoes = async (cliente, e) => {
    e.stopPropagation();
    setClienteObservacoes(cliente);
    setModalObservacoesAberto(true);
    setLoadingObservacoes(true);

    // Buscar observações do cliente
    const { success, data } = await buscarObservacoes(cliente.cd_cliente);
    if (success) {
      setObservacoesList(data || []);
    } else {
      setObservacoesList([]);
    }
    setLoadingObservacoes(false);
  };

  // Handler para fechar modal de observações
  const fecharModalObservacoes = () => {
    setModalObservacoesAberto(false);
    setClienteObservacoes(null);
    setObservacoesList([]);
    setNovaObservacao('');
  };

  // Handler para adicionar nova observação
  const adicionarObservacao = async () => {
    if (!novaObservacao.trim() || !clienteObservacoes) return;

    setLoadingObservacoes(true);

    const observacao = {
      cd_cliente: clienteObservacoes.cd_cliente,
      nm_cliente: clienteObservacoes.nm_cliente,
      observacao: novaObservacao.trim(),
      usuario: user?.email || user?.id || 'Usuário',
    };

    const { success, data } = await salvarObservacao(observacao);

    if (success) {
      // Adicionar nova observação no início da lista
      setObservacoesList((prev) => [data[0], ...prev]);
      setNovaObservacao('');
      setNotification({
        type: 'success',
        message: 'Observação adicionada com sucesso!',
      });
      setTimeout(() => setNotification(null), 3000);
    } else {
      setNotification({
        type: 'error',
        message: 'Erro ao adicionar observação',
      });
    }

    setLoadingObservacoes(false);
  };

  // Funções para determinar classes CSS dos badges
  const getFeelingBadgeClass = (feeling) => {
    switch (feeling) {
      case 'POSSÍVEL PAGAMENTO':
        return 'bg-green-100 text-green-800';
      case 'ATRASO':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ACORDO':
        return 'bg-blue-100 text-blue-800';
      case 'ACORDO EM ANDAMENTO':
        return 'bg-cyan-100 text-cyan-800';
      case 'COBRANÇA':
        return 'bg-purple-100 text-purple-800';
      case 'PROTESTADO':
        return 'bg-red-100 text-red-800';
      case 'PAGO PENDENTE DE BAIXA':
        return 'bg-green-100 text-green-800';
      case 'LOJA FECHADA (Tentando ACORDO)':
        return 'bg-orange-100 text-orange-800';
      case 'ACORDO CONCLUÍDO':
        return 'bg-emerald-100 text-emerald-800';
      case 'NOTIFICAÇÃO JURÍDICA':
        return 'bg-yellow-100 text-yellow-800';
      case 'EM AÇÃO JUDICIAL':
        return 'bg-red-200 text-red-900';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // Funções para abrir modal de lista com filtros específicos
  const abrirModalLista = (titulo, clientesFiltrados) => {
    setTituloModalLista(titulo);
    setClientesFiltradosModal(clientesFiltrados);
    setModalListaAberto(true);
  };

  const fecharModalLista = () => {
    setModalListaAberto(false);
    setClientesFiltradosModal([]);
    setTituloModalLista('');
  };

  // Handlers para abrir modal por situação
  const abrirModalAtrasados = () => {
    const clientes = clientesAgrupados.filter((c) => c.situacao === 'ATRASADO');
    abrirModalLista('Clientes Atrasados (até 31 dias)', clientes);
  };

  const abrirModalInadimplentes = () => {
    const clientes = clientesAgrupados.filter(
      (c) => c.situacao === 'INADIMPLENTE',
    );
    abrirModalLista('Clientes Inadimplentes (acima de 31 dias)', clientes);
  };

  // Handlers para abrir modal por feeling
  const abrirModalFeelingAtraso = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteFeeling[c.cd_cliente] === 'ATRASO',
    );
    abrirModalLista('Clientes com Feeling: Atraso', clientes);
  };

  const abrirModalFeelingPossivelPagamento = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteFeeling[c.cd_cliente] === 'POSSÍVEL PAGAMENTO',
    );
    abrirModalLista('Clientes com Feeling: Possível Pagamento', clientes);
  };

  // Handlers para abrir modal por status
  const abrirModalStatusAcordo = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'ACORDO',
    );
    abrirModalLista('Clientes com Status: Acordo', clientes);
  };

  const abrirModalStatusAcordoAndamento = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'ACORDO EM ANDAMENTO',
    );
    abrirModalLista('Clientes com Status: Acordo em Andamento', clientes);
  };

  const abrirModalStatusCobranca = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'COBRANÇA',
    );
    abrirModalLista('Clientes com Status: Cobrança', clientes);
  };

  const abrirModalStatusProtestado = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'PROTESTADO',
    );
    abrirModalLista('Clientes com Status: Protestado', clientes);
  };

  // Handlers para os novos status
  const abrirModalStatusPagoPendente = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'PAGO PENDENTE DE BAIXA',
    );
    abrirModalLista('Clientes com Status: Pago Pendente de Baixa', clientes);
  };

  const abrirModalStatusLojaFechada = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'LOJA FECHADA (Tentando ACORDO)',
    );
    abrirModalLista(
      'Clientes com Status: Loja Fechada (Tentando Acordo)',
      clientes,
    );
  };

  const abrirModalStatusAcordoConcluido = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'ACORDO CONCLUÍDO',
    );
    abrirModalLista('Clientes com Status: Acordo Concluído', clientes);
  };

  const abrirModalStatusNotificacaoJuridica = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'NOTIFICAÇÃO JURÍDICA',
    );
    abrirModalLista('Clientes com Status: Notificação Jurídica', clientes);
  };

  const abrirModalStatusAcaoJudicial = () => {
    const clientes = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'EM AÇÃO JUDICIAL',
    );
    abrirModalLista('Clientes com Status: Em Ação Judicial', clientes);
  };

  // Handlers para matriz cruzada (Situação x Status)
  const abrirModalMatriz = (titulo, clientes) => {
    abrirModalLista(titulo, clientes);
  };

  // Buscar dados da API
  const fetchDados = async () => {
    try {
      setLoading(true);

      const params = {
        dt_vencimento_ini: '2024-01-01', // Data fixa obrigatória
        cd_empresa_min: 1, // Filtrar apenas empresas de 1 a 1000
        cd_empresa_max: 1000, // Filtrar apenas empresas de 1 a 1000
      };

      if (filtroDataInicial) params.dt_inicio = filtroDataInicial;
      if (filtroDataFinal) params.dt_fim = filtroDataFinal;
      // Nota: filtro por cliente será aplicado client-side via multi-select

      const response =
        await apiClient.financial.inadimplentesMultimarcas(params);

      // Verificar estrutura da resposta
      let dadosRecebidos = [];
      if (response?.success && response?.data) {
        dadosRecebidos = Array.isArray(response.data) ? response.data : [];
      } else if (Array.isArray(response)) {
        dadosRecebidos = response;
      }

      console.log('📊 Dados recebidos de inadimplentes:', dadosRecebidos);
      setDados(dadosRecebidos);

      // CARREGAR CLASSIFICAÇÕES DO SUPABASE
      if (dadosRecebidos.length > 0) {
        const { success, data: classificacoesSalvas } =
          await buscarClassificacoes();

        if (success && classificacoesSalvas) {
          const feelingMap = {};
          const statusMap = {};
          const representanteMap = {};

          classificacoesSalvas.forEach((c) => {
            if (c.feeling) {
              feelingMap[c.cd_cliente] = c.feeling;
            }
            if (c.status) {
              statusMap[c.cd_cliente] = c.status;
            }
            if (c.representante) {
              representanteMap[c.cd_cliente] = c.representante;
            }
          });

          setClienteFeeling(feelingMap);
          setClienteStatus(statusMap);
          setClienteRepresentante(representanteMap);
          console.log('✅ Classificações carregadas do Supabase:', {
            feeling: Object.keys(feelingMap).length,
            status: Object.keys(statusMap).length,
            representante: Object.keys(representanteMap).length,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados de inadimplentes:', error);
      setDados([]);
      setNotification({
        type: 'error',
        message: 'Erro ao carregar dados de inadimplentes',
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    fetchDados();
  }, []);

  // Dados filtrados
  const dadosFiltrados = useMemo(() => {
    return dados.filter((item) => {
      const matchCliente =
        filtroClientes.length === 0 ||
        filtroClientes.includes(String(item.cd_cliente));
      const sigla = item.ds_siglaest?.trim() || '';
      const matchEstado =
        filtroEstados.length === 0 || filtroEstados.includes(sigla);

      // Calcular dias de inadimplencia com base em dt_vencimento
      if (!item.dt_vencimento) return false;
      const hoje = new Date();
      const vencimento = new Date(item.dt_vencimento);
      const diferencaMs = hoje - vencimento;
      const diasAtraso = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

      const estaVencido = diasAtraso >= 1;

      // Verificar se o título NÃO foi pago (igual ao ContasPagarFranquias)
      const valorPago = parseFloat(item.vl_pago) || 0;
      const valorFatura = parseFloat(item.vl_fatura) || 0;
      const temLiquidacao =
        item.dt_liquidacao &&
        item.dt_liquidacao !== null &&
        item.dt_liquidacao !== '';

      // Se tem valor pago >= valor da fatura OU tem data de liquidação, não é inadimplente
      const foiPago =
        (valorPago > 0 && valorPago >= valorFatura) || temLiquidacao;

      // Só considera inadimplente se estiver vencido E não foi pago
      const estaInadimplente = estaVencido && !foiPago;

      return matchCliente && estaInadimplente && matchEstado;
    });
  }, [dados, filtroClientes, filtroEstados]);

  // Lista de estados disponíveis para o select
  const estadosDisponiveis = useMemo(() => {
    const setEstados = new Set();
    dados.forEach((d) => {
      if (d.ds_siglaest) setEstados.add(d.ds_siglaest.trim());
    });
    return Array.from(setEstados).filter(Boolean).sort();
  }, [dados]);

  // Lista de clientes disponíveis (únicos por cd_cliente)
  const clientesDisponiveis = useMemo(() => {
    const map = new Map();
    (dados || []).forEach((d) => {
      if (d.cd_cliente) {
        const key = String(d.cd_cliente);
        if (!map.has(key)) {
          map.set(key, { cd_cliente: key, nm_cliente: d.nm_cliente || key });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.nm_cliente > b.nm_cliente ? 1 : -1,
    );
  }, [dados]);

  // (filtros de cliente/estado foram externalizados para componentes)

  // Agrupar clientes por cd_cliente
  const clientesAgrupados = useMemo(() => {
    const agrupado = dadosFiltrados.reduce((acc, item) => {
      const cdCliente = item.cd_cliente;
      if (!acc[cdCliente]) {
        acc[cdCliente] = {
          cd_cliente: cdCliente,
          nm_cliente: item.nm_cliente,
          ds_siglaest: item.ds_siglaest,
          valor_total: 0,
          faturas: [],
        };
      }
      acc[cdCliente].valor_total += parseFloat(item.vl_fatura) || 0;
      acc[cdCliente].faturas.push(item);
      return acc;
    }, {});

    // Calcular situação de cada cliente (INADIMPLENTE se atraso > 60 dias)
    const resultado = Object.values(agrupado).map((cliente) => {
      const diasAtrasoMax = (cliente.faturas || []).reduce((max, fatura) => {
        if (!fatura.dt_vencimento) return max;
        const diff = Math.floor(
          (new Date() - new Date(fatura.dt_vencimento)) / (1000 * 60 * 60 * 24),
        );
        return Math.max(max, diff);
      }, 0);

      const situacao = diasAtrasoMax > 60 ? 'INADIMPLENTE' : 'ATRASADO';

      return {
        ...cliente,
        diasAtrasoMax,
        situacao,
        feeling: clienteFeeling[cliente.cd_cliente] || null,
        status: clienteStatus[cliente.cd_cliente] || null,
        representante: clienteRepresentante[cliente.cd_cliente] || null,
      };
    });

    // Aplicar ordenação
    if (ordenarPor) {
      resultado.sort((a, b) => {
        let valorA, valorB;

        switch (ordenarPor) {
          case 'cd_cliente':
            valorA = a.cd_cliente || '';
            valorB = b.cd_cliente || '';
            break;
          case 'nm_cliente':
            valorA = (a.nm_cliente || '').toLowerCase();
            valorB = (b.nm_cliente || '').toLowerCase();
            break;
          case 'ds_siglaest':
            valorA = (a.ds_siglaest || '').trim().toLowerCase();
            valorB = (b.ds_siglaest || '').trim().toLowerCase();
            break;
          case 'valor_total':
            valorA = parseFloat(a.valor_total) || 0;
            valorB = parseFloat(b.valor_total) || 0;
            break;
          case 'situacao':
            valorA = (a.situacao || '').toLowerCase();
            valorB = (b.situacao || '').toLowerCase();
            break;
          case 'feeling':
            valorA = (a.feeling || '').toLowerCase();
            valorB = (b.feeling || '').toLowerCase();
            break;
          case 'status':
            valorA = (a.status || '').toLowerCase();
            valorB = (b.status || '').toLowerCase();
            break;
          case 'representante':
            valorA = (a.representante || '').toLowerCase();
            valorB = (b.representante || '').toLowerCase();
            break;
          default:
            return 0;
        }

        if (valorA < valorB) return direcaoOrdenacao === 'asc' ? -1 : 1;
        if (valorA > valorB) return direcaoOrdenacao === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return resultado;
  }, [
    dadosFiltrados,
    clienteFeeling,
    clienteStatus,
    clienteRepresentante,
    ordenarPor,
    direcaoOrdenacao,
  ]);

  // Calcular métricas
  const metricas = useMemo(() => {
    const totalClientes = clientesAgrupados.length;
    const valorTotal = clientesAgrupados.reduce(
      (acc, cliente) => acc + cliente.valor_total,
      0,
    );
    const jurosTotal = dadosFiltrados.reduce(
      (acc, item) => acc + (parseFloat(item.vl_juros) || 0),
      0,
    );
    const valorCorrigidoTotal = dadosFiltrados.reduce(
      (acc, item) => acc + (parseFloat(item.vl_corrigido) || 0),
      0,
    );

    // Métricas por Situação
    const atrasados = clientesAgrupados.filter(
      (c) => c.situacao === 'ATRASADO',
    );
    const inadimplentes = clientesAgrupados.filter(
      (c) => c.situacao === 'INADIMPLENTE',
    );

    const qtdAtrasados = atrasados.length;
    const valorAtrasados = atrasados.reduce((acc, c) => acc + c.valor_total, 0);
    const qtdInadimplentes = inadimplentes.length;
    const valorInadimplentes = inadimplentes.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );

    // Métricas por Feeling
    const feelingAtraso = clientesAgrupados.filter(
      (c) => clienteFeeling[c.cd_cliente] === 'ATRASO',
    );
    const feelingPossivelPagamento = clientesAgrupados.filter(
      (c) => clienteFeeling[c.cd_cliente] === 'POSSÍVEL PAGAMENTO',
    );

    const qtdFeelingAtraso = feelingAtraso.length;
    const valorFeelingAtraso = feelingAtraso.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );
    const qtdFeelingPossivelPagamento = feelingPossivelPagamento.length;
    const valorFeelingPossivelPagamento = feelingPossivelPagamento.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );

    // Métricas por Status
    const statusAcordo = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'ACORDO',
    );
    const statusAcordoAndamento = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'ACORDO EM ANDAMENTO',
    );
    const statusCobranca = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'COBRANÇA',
    );
    const statusProtestado = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'PROTESTADO',
    );

    const qtdAcordo = statusAcordo.length;
    const valorAcordo = statusAcordo.reduce((acc, c) => acc + c.valor_total, 0);
    const qtdAcordoAndamento = statusAcordoAndamento.length;
    const valorAcordoAndamento = statusAcordoAndamento.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );
    const qtdCobranca = statusCobranca.length;
    const valorCobranca = statusCobranca.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );
    const qtdProtestado = statusProtestado.length;
    const valorProtestado = statusProtestado.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );

    // Métricas para os novos status
    const statusPagoPendente = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'PAGO PENDENTE DE BAIXA',
    );
    const statusLojaFechada = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'LOJA FECHADA (Tentando ACORDO)',
    );
    const statusAcordoConcluido = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'ACORDO CONCLUÍDO',
    );
    const statusNotificacaoJuridica = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'NOTIFICAÇÃO JURÍDICA',
    );
    const statusAcaoJudicial = clientesAgrupados.filter(
      (c) => clienteStatus[c.cd_cliente] === 'EM AÇÃO JUDICIAL',
    );

    const qtdPagoPendente = statusPagoPendente.length;
    const valorPagoPendente = statusPagoPendente.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );
    const qtdLojaFechada = statusLojaFechada.length;
    const valorLojaFechada = statusLojaFechada.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );
    const qtdAcordoConcluido = statusAcordoConcluido.length;
    const valorAcordoConcluido = statusAcordoConcluido.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );
    const qtdNotificacaoJuridica = statusNotificacaoJuridica.length;
    const valorNotificacaoJuridica = statusNotificacaoJuridica.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );
    const qtdAcaoJudicial = statusAcaoJudicial.length;
    const valorAcaoJudicial = statusAcaoJudicial.reduce(
      (acc, c) => acc + c.valor_total,
      0,
    );

    return {
      totalClientes,
      valorTotal,
      jurosTotal,
      valorCorrigidoTotal,
      // Situação
      qtdAtrasados,
      valorAtrasados,
      qtdInadimplentes,
      valorInadimplentes,
      // Feeling
      qtdFeelingAtraso,
      valorFeelingAtraso,
      qtdFeelingPossivelPagamento,
      valorFeelingPossivelPagamento,
      // Status
      qtdAcordo,
      valorAcordo,
      qtdAcordoAndamento,
      valorAcordoAndamento,
      qtdCobranca,
      valorCobranca,
      qtdProtestado,
      valorProtestado,
      // Novos Status
      qtdPagoPendente,
      valorPagoPendente,
      qtdLojaFechada,
      valorLojaFechada,
      qtdAcordoConcluido,
      valorAcordoConcluido,
      qtdNotificacaoJuridica,
      valorNotificacaoJuridica,
      qtdAcaoJudicial,
      valorAcaoJudicial,
    };
  }, [clientesAgrupados, dadosFiltrados, clienteFeeling, clienteStatus]);

  // Matriz cruzada: Situação x Status
  const matrizSituacaoStatus = useMemo(() => {
    const matriz = {
      atrasadosAcordo: clientesAgrupados.filter(
        (c) =>
          c.situacao === 'ATRASADO' && clienteStatus[c.cd_cliente] === 'ACORDO',
      ),
      atrasadosAcordoAndamento: clientesAgrupados.filter(
        (c) =>
          c.situacao === 'ATRASADO' &&
          clienteStatus[c.cd_cliente] === 'ACORDO EM ANDAMENTO',
      ),
      atrasadosCobranca: clientesAgrupados.filter(
        (c) =>
          c.situacao === 'ATRASADO' &&
          clienteStatus[c.cd_cliente] === 'COBRANÇA',
      ),
      atrasadosProtestado: clientesAgrupados.filter(
        (c) =>
          c.situacao === 'ATRASADO' &&
          clienteStatus[c.cd_cliente] === 'PROTESTADO',
      ),

      inadimplentesAcordo: clientesAgrupados.filter(
        (c) =>
          c.situacao === 'INADIMPLENTE' &&
          clienteStatus[c.cd_cliente] === 'ACORDO',
      ),
      inadimplentesAcordoAndamento: clientesAgrupados.filter(
        (c) =>
          c.situacao === 'INADIMPLENTE' &&
          clienteStatus[c.cd_cliente] === 'ACORDO EM ANDAMENTO',
      ),
      inadimplentesCobranca: clientesAgrupados.filter(
        (c) =>
          c.situacao === 'INADIMPLENTE' &&
          clienteStatus[c.cd_cliente] === 'COBRANÇA',
      ),
      inadimplentesProtestado: clientesAgrupados.filter(
        (c) =>
          c.situacao === 'INADIMPLENTE' &&
          clienteStatus[c.cd_cliente] === 'PROTESTADO',
      ),
    };

    return {
      atrasadosAcordo: {
        clientes: matriz.atrasadosAcordo,
        qtd: matriz.atrasadosAcordo.length,
        valor: matriz.atrasadosAcordo.reduce(
          (acc, c) => acc + c.valor_total,
          0,
        ),
      },
      atrasadosAcordoAndamento: {
        clientes: matriz.atrasadosAcordoAndamento,
        qtd: matriz.atrasadosAcordoAndamento.length,
        valor: matriz.atrasadosAcordoAndamento.reduce(
          (acc, c) => acc + c.valor_total,
          0,
        ),
      },
      atrasadosCobranca: {
        clientes: matriz.atrasadosCobranca,
        qtd: matriz.atrasadosCobranca.length,
        valor: matriz.atrasadosCobranca.reduce(
          (acc, c) => acc + c.valor_total,
          0,
        ),
      },
      atrasadosProtestado: {
        clientes: matriz.atrasadosProtestado,
        qtd: matriz.atrasadosProtestado.length,
        valor: matriz.atrasadosProtestado.reduce(
          (acc, c) => acc + c.valor_total,
          0,
        ),
      },
      inadimplentesAcordo: {
        clientes: matriz.inadimplentesAcordo,
        qtd: matriz.inadimplentesAcordo.length,
        valor: matriz.inadimplentesAcordo.reduce(
          (acc, c) => acc + c.valor_total,
          0,
        ),
      },
      inadimplentesAcordoAndamento: {
        clientes: matriz.inadimplentesAcordoAndamento,
        qtd: matriz.inadimplentesAcordoAndamento.length,
        valor: matriz.inadimplentesAcordoAndamento.reduce(
          (acc, c) => acc + c.valor_total,
          0,
        ),
      },
      inadimplentesCobranca: {
        clientes: matriz.inadimplentesCobranca,
        qtd: matriz.inadimplentesCobranca.length,
        valor: matriz.inadimplentesCobranca.reduce(
          (acc, c) => acc + c.valor_total,
          0,
        ),
      },
      inadimplentesProtestado: {
        clientes: matriz.inadimplentesProtestado,
        qtd: matriz.inadimplentesProtestado.length,
        valor: matriz.inadimplentesProtestado.reduce(
          (acc, c) => acc + c.valor_total,
          0,
        ),
      },
    };
  }, [clientesAgrupados, clienteStatus]);

  // Dados para gráfico por estado
  const dadosPorEstado = useMemo(() => {
    const agrupado = dadosFiltrados.reduce((acc, item) => {
      const estado = item.ds_siglaest?.trim() || 'Não informado';
      if (!acc[estado]) {
        acc[estado] = { clientes: 0, valor: 0 };
      }
      acc[estado].clientes += 1;
      acc[estado].valor += parseFloat(item.vl_fatura) || 0;
      return acc;
    }, {});

    const estados = Object.keys(agrupado);
    const clientesPorEstado = estados.map(
      (estado) => agrupado[estado].clientes,
    );
    const valoresPorEstado = estados.map((estado) => agrupado[estado].valor);

    return {
      estados,
      clientesPorEstado,
      valoresPorEstado,
    };
  }, [dadosFiltrados]);

  // Configuração do gráfico geral
  // Top clientes por valor inadimplente (top 10) com dias de atraso máximos
  const topClientes = useMemo(() => {
    if (!clientesAgrupados || clientesAgrupados.length === 0) return [];
    const sorted = [...clientesAgrupados]
      .sort((a, b) => b.valor_total - a.valor_total)
      .slice(0, 10);
    return sorted.map((c) => {
      const diasMax = (c.faturas || []).reduce((max, f) => {
        if (!f.dt_vencimento) return max;
        const diff = Math.floor(
          (new Date() - new Date(f.dt_vencimento)) / (1000 * 60 * 60 * 24),
        );
        return Math.max(max, diff);
      }, 0);
      return { ...c, diasAtrasoMax: diasMax };
    });
  }, [clientesAgrupados]);

  const graficoPrincipalData = {
    labels: topClientes.map((c) =>
      c.nm_cliente ? c.nm_cliente : c.cd_cliente,
    ),
    datasets: [
      {
        label: 'Valor Inadimplente (R$)',
        data: topClientes.map((c) => Number(c.valor_total || 0)),
        backgroundColor: '#000638',
        borderColor: '#000638',
        borderWidth: 1,
      },
    ],
  };

  // Configuração do gráfico por estado
  const graficoEstadoData = {
    labels: dadosPorEstado.estados,
    datasets: [
      {
        label: 'Clientes',
        data: dadosPorEstado.clientesPorEstado,
        backgroundColor: '#000638',
        borderColor: '#000638',
        borderWidth: 1,
      },
    ],
  };

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  };

  const formatarData = (data) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const calcularTempoInadimplencia = (dtVencimento) => {
    if (!dtVencimento) return 'N/A';

    const hoje = new Date();
    const vencimento = new Date(dtVencimento);
    const diferencaMs = hoje - vencimento;
    const dias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

    if (dias <= 0) return '0 dias';
    if (dias === 1) return '1 dia';
    if (dias < 30) return `${dias} dias`;
    if (dias < 365) {
      const meses = Math.floor(dias / 30);
      return meses === 1 ? '1 mês' : `${meses} meses`;
    }
    const anos = Math.floor(dias / 365);
    return anos === 1 ? '1 ano' : `${anos} anos`;
  };

  // Funções do modal
  const abrirModal = (cliente) => {
    setClienteSelecionado(cliente);
    setFaturasSelecionadas(cliente.faturas);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setClienteSelecionado(null);
    setFaturasSelecionadas([]);
  };

  // Funções do modal de histórico
  const abrirModalHistorico = async (cdCliente) => {
    setLoadingHistorico(true);
    setModalHistoricoAberto(true);
    setHistoricoSelecionado([]);

    const { success, data } = await buscarHistorico(cdCliente);

    if (success && data) {
      setHistoricoSelecionado(data);
    } else {
      setNotification({
        type: 'error',
        message: 'Erro ao carregar histórico',
      });
      setTimeout(() => setNotification(null), 3000);
    }

    setLoadingHistorico(false);
  };

  const fecharModalHistorico = () => {
    setModalHistoricoAberto(false);
    setHistoricoSelecionado([]);
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 space-y-6">
      <PageTitle
        title="Inadimplencia Multimarcas"
        subtitle="Acompanhe os clientes inadimplentes e suas métricas"
        icon={ChartBar}
        iconColor="text-purple-600"
      />

      {/* Filtros */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchDados();
          }}
        >
          <div className="text-sm font-semibold text-[#000638] mb-2">
            Configurações para análise de Inadimplência Multimarcas
          </div>
          <span className="text-xs text-gray-500 mt-1">
            Filtros para consulta de clientes inadimplentes
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 mt-4">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Inicial
              </label>
              <input
                type="date"
                value={filtroDataInicial}
                onChange={(e) => setFiltroDataInicial(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Final
              </label>
              <input
                type="date"
                value={filtroDataFinal}
                onChange={(e) => setFiltroDataFinal(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div className="col-span-1">
              <FiltroClientes
                clientes={clientesDisponiveis}
                selected={filtroClientes}
                onChange={setFiltroClientes}
              />
            </div>
            <div className="col-span-1">
              <FiltroEstados
                estados={estadosDisponiveis}
                selected={filtroEstados}
                onChange={setFiltroEstados}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={fetchDados}
              disabled={loading}
              className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
            >
              {loading ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <ChartBar size={16} />
                  Buscar Dados
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <CardTitle className="text-sm font-bold text-blue-700">
                Total de Clientes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-blue-600 mb-0.5">
              {metricas.totalClientes}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Clientes inadimplentes
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CurrencyDollar size={18} className="text-green-600" />
              <CardTitle className="text-sm font-bold text-green-700">
                Valor Total
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-green-600 mb-0.5">
              {formatarMoeda(metricas.valorTotal)}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Valor em aberto
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Handshake size={18} className="text-purple-600" />
              <CardTitle className="text-sm font-bold text-purple-700">
                Valor Total - Acordos
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-purple-600 mb-0.5">
              {formatarMoeda(
                metricas.valorTotal -
                  (matrizSituacaoStatus.atrasadosAcordo.valor +
                    matrizSituacaoStatus.atrasadosAcordoAndamento.valor +
                    matrizSituacaoStatus.inadimplentesAcordo.valor +
                    matrizSituacaoStatus.inadimplentesAcordoAndamento.valor),
              )}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Valor em aberto - Acordos - Acordos em Andamento
            </CardDescription>
          </CardContent>
        </Card>

        {/* Juros e Valor Corrigido removidos por solicitação */}
      </div>

      {/* Sessão Situação */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-[#000638] mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-[#000638] rounded"></span>
          Por Situação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalAtrasados}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-yellow-600" />
                <CardTitle className="text-sm font-bold text-yellow-700">
                  Atrasados
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-yellow-600 mb-0.5">
                {metricas.qtdAtrasados} cliente
                {metricas.qtdAtrasados !== 1 ? 's' : ''}
              </div>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {formatarMoeda(metricas.valorAtrasados)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Até 31 dias de atraso
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalInadimplentes}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Warning size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">
                  Inadimplentes
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-red-600 mb-0.5">
                {metricas.qtdInadimplentes} cliente
                {metricas.qtdInadimplentes !== 1 ? 's' : ''}
              </div>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {formatarMoeda(metricas.valorInadimplentes)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Acima de 31 dias de atraso
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sessão Feeling */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-[#000638] mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-[#000638] rounded"></span>
          Por Feeling
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalFeelingAtraso}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ChatCircleDots size={18} className="text-orange-600" />
                <CardTitle className="text-sm font-bold text-orange-700">
                  Atraso
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-orange-600 mb-0.5">
                {metricas.qtdFeelingAtraso} cliente
                {metricas.qtdFeelingAtraso !== 1 ? 's' : ''}
              </div>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {formatarMoeda(metricas.valorFeelingAtraso)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Clientes marcados com atraso
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalFeelingPossivelPagamento}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendUp size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">
                  Possível Pagamento
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-green-600 mb-0.5">
                {metricas.qtdFeelingPossivelPagamento} cliente
                {metricas.qtdFeelingPossivelPagamento !== 1 ? 's' : ''}
              </div>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                {formatarMoeda(metricas.valorFeelingPossivelPagamento)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Clientes com possibilidade de pagamento
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sessão Status */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-[#000638] mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-[#000638] rounded"></span>
          Por Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalStatusAcordo}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Handshake size={18} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-700">
                  Acordo
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-blue-600 mb-0.5">
                {metricas.qtdAcordo}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {metricas.qtdAcordo !== 1 ? 'Clientes' : 'Cliente'} -{' '}
                {formatarMoeda(metricas.valorAcordo)}
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalStatusAcordoAndamento}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-cyan-600" />
                <CardTitle className="text-sm font-bold text-cyan-700">
                  Acordo em Andamento
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-cyan-600 mb-0.5">
                {metricas.qtdAcordoAndamento}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {metricas.qtdAcordoAndamento !== 1 ? 'Clientes' : 'Cliente'} -{' '}
                {formatarMoeda(metricas.valorAcordoAndamento)}
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalStatusCobranca}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-purple-600" />
                <CardTitle className="text-sm font-bold text-purple-700">
                  Cobrança
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-purple-600 mb-0.5">
                {metricas.qtdCobranca}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {metricas.qtdCobranca !== 1 ? 'Clientes' : 'Cliente'} -{' '}
                {formatarMoeda(metricas.valorCobranca)}
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalStatusProtestado}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Gavel size={18} className="text-red-600" />
                <CardTitle className="text-sm font-bold text-red-700">
                  Protestado
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-red-600 mb-0.5">
                {metricas.qtdProtestado}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {metricas.qtdProtestado !== 1 ? 'Clientes' : 'Cliente'} -{' '}
                {formatarMoeda(metricas.valorProtestado)}
              </CardDescription>
            </CardContent>
          </Card>

          {/* Novos cards de status */}
          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalStatusPagoPendente}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">
                  Pago Pendente de Baixa
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-green-600 mb-0.5">
                {metricas.qtdPagoPendente}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {metricas.qtdPagoPendente !== 1 ? 'Clientes' : 'Cliente'} -{' '}
                {formatarMoeda(metricas.valorPagoPendente)}
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalStatusLojaFechada}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Warning size={18} className="text-orange-600" />
                <CardTitle className="text-sm font-bold text-orange-700">
                  Loja Fechada (Tentando Acordo)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-orange-600 mb-0.5">
                {metricas.qtdLojaFechada}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {metricas.qtdLojaFechada !== 1 ? 'Clientes' : 'Cliente'} -{' '}
                {formatarMoeda(metricas.valorLojaFechada)}
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalStatusAcordoConcluido}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Smiley size={18} className="text-emerald-600" />
                <CardTitle className="text-sm font-bold text-emerald-700">
                  Acordo Concluído
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-emerald-600 mb-0.5">
                {metricas.qtdAcordoConcluido}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {metricas.qtdAcordoConcluido !== 1 ? 'Clientes' : 'Cliente'} -{' '}
                {formatarMoeda(metricas.valorAcordoConcluido)}
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalStatusNotificacaoJuridica}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-yellow-600" />
                <CardTitle className="text-sm font-bold text-yellow-700">
                  Notificação Jurídica
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-yellow-600 mb-0.5">
                {metricas.qtdNotificacaoJuridica}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {metricas.qtdNotificacaoJuridica !== 1 ? 'Clientes' : 'Cliente'}{' '}
                - {formatarMoeda(metricas.valorNotificacaoJuridica)}
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white cursor-pointer"
            onClick={abrirModalStatusAcaoJudicial}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Gavel size={18} className="text-red-700" />
                <CardTitle className="text-sm font-bold text-red-800">
                  Em Ação Judicial
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-red-700 mb-0.5">
                {metricas.qtdAcaoJudicial}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {metricas.qtdAcaoJudicial !== 1 ? 'Clientes' : 'Cliente'} -{' '}
                {formatarMoeda(metricas.valorAcaoJudicial)}
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Matriz: Situação x Status */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-[#000638] mb-3 flex items-center gap-2">
          <span className="w-1 h-4 bg-[#000638] rounded"></span>
          Cruzamento: Situação x Status
        </h3>
        <Card className="shadow-lg rounded-xl bg-white">
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="px-4 py-3 text-left font-bold text-[#000638]">
                      Situação / Status
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-blue-700">
                      Acordo
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-cyan-700">
                      Acordo em Andamento
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-[#000638] bg-gray-100">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Linha ATRASADOS */}
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-yellow-700 bg-yellow-50">
                      <div className="flex items-center gap-2">
                        <Clock size={16} />
                        ATRASADOS
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() =>
                        abrirModalMatriz(
                          'Atrasados - Acordo',
                          matrizSituacaoStatus.atrasadosAcordo.clientes,
                        )
                      }
                    >
                      <div className="font-bold text-blue-600">
                        {matrizSituacaoStatus.atrasadosAcordo.qtd}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatarMoeda(
                          matrizSituacaoStatus.atrasadosAcordo.valor,
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-center cursor-pointer hover:bg-cyan-50 transition-colors"
                      onClick={() =>
                        abrirModalMatriz(
                          'Atrasados - Acordo em Andamento',
                          matrizSituacaoStatus.atrasadosAcordoAndamento
                            .clientes,
                        )
                      }
                    >
                      <div className="font-bold text-cyan-600">
                        {matrizSituacaoStatus.atrasadosAcordoAndamento.qtd}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatarMoeda(
                          matrizSituacaoStatus.atrasadosAcordoAndamento.valor,
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center font-bold bg-yellow-50 border-l-2 border-yellow-300">
                      <div className="text-base text-blue-700">
                        {metricas.qtdAtrasados -
                          (matrizSituacaoStatus.atrasadosAcordo.qtd +
                            matrizSituacaoStatus.atrasadosAcordoAndamento.qtd)}
                      </div>
                      <div className="text-sm font-semibold text-gray-700 mt-1">
                        {formatarMoeda(
                          metricas.valorAtrasados -
                            (matrizSituacaoStatus.atrasadosAcordo.valor +
                              matrizSituacaoStatus.atrasadosAcordoAndamento
                                .valor),
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 italic">
                        Total - Acordos
                      </div>
                    </td>
                  </tr>

                  {/* Linha INADIMPLENTES */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-red-700 bg-red-50">
                      <div className="flex items-center gap-2">
                        <Warning size={16} />
                        INADIMPLENTES
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() =>
                        abrirModalMatriz(
                          'Inadimplentes - Acordo',
                          matrizSituacaoStatus.inadimplentesAcordo.clientes,
                        )
                      }
                    >
                      <div className="font-bold text-blue-600">
                        {matrizSituacaoStatus.inadimplentesAcordo.qtd}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatarMoeda(
                          matrizSituacaoStatus.inadimplentesAcordo.valor,
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-center cursor-pointer hover:bg-cyan-50 transition-colors"
                      onClick={() =>
                        abrirModalMatriz(
                          'Inadimplentes - Acordo em Andamento',
                          matrizSituacaoStatus.inadimplentesAcordoAndamento
                            .clientes,
                        )
                      }
                    >
                      <div className="font-bold text-cyan-600">
                        {matrizSituacaoStatus.inadimplentesAcordoAndamento.qtd}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatarMoeda(
                          matrizSituacaoStatus.inadimplentesAcordoAndamento
                            .valor,
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold bg-red-50 border-l-2 border-red-300">
                      <div className="text-base text-red-700">
                        {metricas.qtdInadimplentes -
                          (matrizSituacaoStatus.inadimplentesAcordo.qtd +
                            matrizSituacaoStatus.inadimplentesAcordoAndamento
                              .qtd)}
                      </div>
                      <div className="text-sm font-semibold text-gray-700 mt-1">
                        {formatarMoeda(
                          metricas.valorInadimplentes -
                            (matrizSituacaoStatus.inadimplentesAcordo.valor +
                              matrizSituacaoStatus.inadimplentesAcordoAndamento
                                .valor),
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 italic">
                        Total - Acordos
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-500 italic">
              💡 Clique em qualquer célula para ver a lista detalhada de
              clientes
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ChartBar size={18} className="text-blue-600" />
              <CardTitle className="text-sm font-bold text-blue-700">
                TOP CLIENTES INADIMPLENTES
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <CardDescription className="text-xs text-gray-500 mb-3">
              Visão geral dos dados de inadimplência
            </CardDescription>
            <div className="h-64">
              <Bar
                data={graficoPrincipalData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          const idx = context.dataIndex;
                          const cliente = topClientes[idx];
                          const valor = context.dataset.data[idx] || 0;
                          const valorFmt = new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(valor);
                          const dias = cliente?.diasAtrasoMax ?? 0;
                          return `${valorFmt} — ${dias} dias em atraso`;
                        },
                      },
                    },
                  },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-green-600" />
              <CardTitle className="text-sm font-bold text-green-700">
                Clientes por Estado
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <CardDescription className="text-xs text-gray-500 mb-3">
              Distribuição de inadimplentes por estado
            </CardDescription>
            <div className="h-64">
              <Bar
                data={graficoEstadoData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-[#000638]" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Lista de Clientes Inadimplentes
              </CardTitle>
            </div>
            <button
              onClick={() => abrirModalHistorico(null)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#000638] text-white text-xs font-medium rounded hover:bg-[#fe0000] transition-colors"
              title="Ver histórico completo de alterações"
            >
              <ClockClockwise size={16} weight="bold" />
              Log
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <CardDescription className="text-xs text-gray-500 mb-4">
            Detalhes completos dos clientes em situação de inadimplência
          </CardDescription>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" text="Carregando dados..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('cd_cliente')}
                      title="Clique para ordenar"
                    >
                      <div className="flex items-center gap-1">
                        Código Cliente
                        {ordenarPor === 'cd_cliente' && (
                          <span>{direcaoOrdenacao === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('nm_cliente')}
                      title="Clique para ordenar"
                    >
                      <div className="flex items-center gap-1">
                        Nome Cliente
                        {ordenarPor === 'nm_cliente' && (
                          <span>{direcaoOrdenacao === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('ds_siglaest')}
                      title="Clique para ordenar"
                    >
                      <div className="flex items-center gap-1">
                        Estado
                        {ordenarPor === 'ds_siglaest' && (
                          <span>{direcaoOrdenacao === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('valor_total')}
                      title="Clique para ordenar"
                    >
                      <div className="flex items-center gap-1">
                        Valor Total
                        {ordenarPor === 'valor_total' && (
                          <span>{direcaoOrdenacao === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('situacao')}
                      title="Clique para ordenar"
                    >
                      <div className="flex items-center gap-1">
                        Situação
                        {ordenarPor === 'situacao' && (
                          <span>{direcaoOrdenacao === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('feeling')}
                      title="Clique para ordenar"
                    >
                      <div className="flex items-center gap-1">
                        Feeling
                        {ordenarPor === 'feeling' && (
                          <span>{direcaoOrdenacao === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('status')}
                      title="Clique para ordenar"
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {ordenarPor === 'status' && (
                          <span>{direcaoOrdenacao === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('representante')}
                      title="Clique para ordenar"
                    >
                      <div className="flex items-center gap-1">
                        Representante
                        {ordenarPor === 'representante' && (
                          <span>{direcaoOrdenacao === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesAgrupados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Nenhum cliente inadimplente encontrado
                      </td>
                    </tr>
                  ) : (
                    clientesAgrupados.map((cliente, index) => (
                      <tr
                        key={index}
                        className="bg-white border-b hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => abrirModal(cliente)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {cliente.cd_cliente || 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {cliente.nm_cliente || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                            {cliente.ds_siglaest?.trim() || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-green-600">
                          {formatarMoeda(cliente.valor_total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${
                              cliente.situacao === 'INADIMPLENTE'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {cliente.situacao}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {editandoFeeling === cliente.cd_cliente ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={tempFeeling}
                                onChange={(e) => setTempFeeling(e.target.value)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">Selecione...</option>
                                <option value="POSSÍVEL PAGAMENTO">
                                  POSSÍVEL PAGAMENTO
                                </option>
                                <option value="ATRASO">ATRASO</option>
                              </select>
                              <button
                                onClick={(e) =>
                                  salvarFeeling(cliente.cd_cliente, e)
                                }
                                className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded transition-colors"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={cancelarEdicaoFeeling}
                                className="bg-gray-400 hover:bg-gray-500 text-white text-xs px-2 py-1 rounded transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span
                              onClick={(e) =>
                                iniciarEdicaoFeeling(cliente.cd_cliente, e)
                              }
                              className={`text-xs font-semibold px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${getFeelingBadgeClass(
                                cliente.feeling,
                              )}`}
                            >
                              {cliente.feeling || '---'}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {editandoStatus === cliente.cd_cliente ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={tempStatus}
                                onChange={(e) => setTempStatus(e.target.value)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">Selecione...</option>
                                <option value="ACORDO">ACORDO</option>
                                <option value="ACORDO EM ANDAMENTO">
                                  ACORDO EM ANDAMENTO
                                </option>
                                <option value="COBRANÇA">COBRANÇA</option>
                                <option value="PROTESTADO">PROTESTADO</option>
                                <option value="PAGO PENDENTE DE BAIXA">
                                  PAGO PENDENTE DE BAIXA
                                </option>
                                <option value="LOJA FECHADA (Tentando ACORDO)">
                                  LOJA FECHADA (Tentando ACORDO)
                                </option>
                                <option value="ACORDO CONCLUÍDO">
                                  ACORDO CONCLUÍDO
                                </option>
                                <option value="NOTIFICAÇÃO JURÍDICA">
                                  NOTIFICAÇÃO JURÍDICA
                                </option>
                                <option value="EM AÇÃO JUDICIAL">
                                  EM AÇÃO JUDICIAL
                                </option>
                              </select>
                              <button
                                onClick={(e) =>
                                  salvarStatus(cliente.cd_cliente, e)
                                }
                                className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded transition-colors"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={cancelarEdicaoStatus}
                                className="bg-gray-400 hover:bg-gray-500 text-white text-xs px-2 py-1 rounded transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span
                              onClick={(e) =>
                                iniciarEdicaoStatus(cliente.cd_cliente, e)
                              }
                              className={`text-xs font-semibold px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${getStatusBadgeClass(
                                cliente.status,
                              )}`}
                            >
                              {cliente.status || '---'}
                            </span>
                          )}
                        </td>
                        {/* Coluna Representante */}
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {editandoRepresentante === cliente.cd_cliente ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={tempRepresentante}
                                onChange={(e) =>
                                  setTempRepresentante(e.target.value)
                                }
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-32"
                                placeholder="Nome do representante"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) =>
                                  salvarRepresentante(cliente.cd_cliente, e)
                                }
                                className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded transition-colors"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={cancelarEdicaoRepresentante}
                                className="bg-gray-400 hover:bg-gray-500 text-white text-xs px-2 py-1 rounded transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span
                              onClick={(e) =>
                                iniciarEdicaoRepresentante(
                                  cliente.cd_cliente,
                                  e,
                                )
                              }
                              className="text-xs font-semibold px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity bg-purple-100 text-purple-800"
                            >
                              {cliente.representante || '---'}
                            </span>
                          )}
                        </td>
                        {/* Coluna Observações */}
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => abrirModalObservacoes(cliente, e)}
                            className="bg-[#000638] hover:bg-[#fe0000] text-white text-xs font-medium px-3 py-1 rounded transition-colors"
                          >
                            OBS
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Lista de Clientes Filtrados */}
      {modalListaAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {tituloModalLista}
              </h3>
              <button
                onClick={fecharModalLista}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Nome Cliente</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Valor Total</th>
                    <th className="px-4 py-3">Dias Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltradosModal.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Nenhum cliente encontrado nesta categoria
                      </td>
                    </tr>
                  ) : (
                    clientesFiltradosModal.map((cliente, index) => (
                      <tr
                        key={index}
                        className="bg-white border-b hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => {
                          fecharModalLista();
                          abrirModal(cliente);
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {cliente.cd_cliente || 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {cliente.nm_cliente || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                            {cliente.ds_siglaest?.trim() || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-green-600">
                          {formatarMoeda(cliente.valor_total)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded">
                            {cliente.diasAtrasoMax || 0} dias
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={fecharModalLista}
                className="px-4 py-2 bg-[#000638] text-white rounded hover:bg-[#fe0000] transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Observações */}
      {modalObservacoesAberto && clienteObservacoes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden mx-4 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ChatCircleDots
                  size={24}
                  weight="bold"
                  className="text-[#000638]"
                />
                <h3 className="text-lg font-semibold text-gray-900">
                  Observações - {clienteObservacoes.nm_cliente}
                </h3>
              </div>
              <button
                onClick={fecharModalObservacoes}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Cliente: {clienteObservacoes.cd_cliente} | Valor:{' '}
              {formatarMoeda(clienteObservacoes.valor_total)}
            </p>

            {/* Área de chat com observações */}
            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 mb-4 min-h-[300px] max-h-[400px]">
              {loadingObservacoes ? (
                <div className="flex justify-center items-center py-8">
                  <CircleNotch
                    size={32}
                    className="animate-spin text-[#000638]"
                  />
                </div>
              ) : observacoesList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ChatCircleDots
                    size={48}
                    className="mx-auto mb-2 opacity-50"
                  />
                  <p>Nenhuma observação registrada ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {observacoesList.map((obs, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-[#000638]" />
                          <span className="text-sm font-semibold text-[#000638]">
                            {obs.usuario}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(obs.data_criacao).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {obs.observacao}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Campo para adicionar nova observação */}
            <div className="border-t pt-4">
              <div className="flex gap-2">
                <textarea
                  value={novaObservacao}
                  onChange={(e) => setNovaObservacao(e.target.value)}
                  placeholder="Digite sua observação..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638] resize-none"
                  rows={3}
                />
                <button
                  onClick={adicionarObservacao}
                  disabled={!novaObservacao.trim() || loadingObservacoes}
                  className="bg-[#000638] hover:bg-[#fe0000] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
                >
                  Enviar
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={fecharModalObservacoes}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Alterações */}
      {modalHistoricoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ClockClockwise
                  size={24}
                  weight="bold"
                  className="text-[#000638]"
                />
                <h3 className="text-lg font-semibold text-gray-900">
                  Histórico Completo de Alterações
                </h3>
              </div>
              <button
                onClick={fecharModalHistorico}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Registro de todas as alterações de classificação realizadas
            </p>

            {loadingHistorico ? (
              <div className="flex justify-center items-center py-8">
                <CircleNotch
                  size={32}
                  className="animate-spin text-[#000638]"
                />
              </div>
            ) : historicoSelecionado.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ClockClockwise size={48} className="mx-auto mb-2 opacity-50" />
                <p>Nenhuma alteração de classificação foi registrada ainda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-3">Data/Hora</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Valor</th>
                      <th className="px-4 py-3">Situação</th>
                      <th className="px-4 py-3">Feeling</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Usuário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoSelecionado.map((item, index) => (
                      <tr
                        key={index}
                        className="bg-white border-b hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-xs">
                          {new Date(item.data_alteracao).toLocaleString(
                            'pt-BR',
                            {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="text-xs font-bold">
                            {item.cd_cliente}
                          </div>
                          <div className="text-xs text-gray-600">
                            {item.nm_cliente}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-green-600">
                          {formatarMoeda(item.valor_total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${
                              item.situacao === 'INADIMPLENTE'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {item.situacao || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${getFeelingBadgeClass(
                              item.feeling,
                            )}`}
                          >
                            {item.feeling || '---'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadgeClass(
                              item.status,
                            )}`}
                          >
                            {item.status || '---'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex items-center gap-1">
                            <Users size={14} className="text-gray-400" />
                            <span className="text-gray-700">
                              {item.usuario}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={fecharModalHistorico}
                className="px-4 py-2 bg-[#000638] text-white rounded hover:bg-[#fe0000] transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes das Faturas */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Detalhes das Faturas - {clienteSelecionado?.nm_cliente}
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Emissão</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3">Valor Fatura</th>
                    <th className="px-4 py-3">Juros</th>
                    <th className="px-4 py-3">Parcela</th>
                    <th className="px-4 py-3">Tempo Inadimplência</th>
                  </tr>
                </thead>
                <tbody>
                  {faturasSelecionadas.map((fatura, index) => (
                    <tr key={index} className="bg-white border-b">
                      <td className="px-4 py-3">
                        {fatura.cd_empresa || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {formatarData(fatura.dt_emissao)}
                      </td>
                      <td className="px-4 py-3">
                        {formatarData(fatura.dt_vencimento)}
                      </td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        {formatarMoeda(fatura.vl_fatura)}
                      </td>
                      <td className="px-4 py-3 font-medium text-red-600">
                        {formatarMoeda(fatura.vl_juros)}
                      </td>
                      <td className="px-4 py-3">
                        {fatura.nr_parcela || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded">
                          {calcularTempoInadimplencia(fatura.dt_vencimento)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={fecharModal}
                className="px-4 py-2 bg-[#000638] text-white rounded hover:bg-[#fe0000] transition-colors"
              >
                Fechar
              </button>
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

export default InadimplentesMultimarcas;
