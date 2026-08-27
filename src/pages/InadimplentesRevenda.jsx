import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import FiltroEstados from '../components/filters/FiltroEstados';
import FiltroClientes from '../components/filters/FiltroClientes';
import FiltroRepresentantes from '../components/filters/FiltroRepresentantes';
import useApiClient from '../hooks/useApiClient';
import { useAuth } from '../components/AuthContext';
import useClassificacoesInadimplentes from '../hooks/useClassificacoesInadimplentes';
import { supabase, supabaseAdmin } from '../lib/supabase';
import PageTitle from '../components/ui/PageTitle';
import { TotvsURL } from '../config/constants';
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
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line } from 'react-chartjs-2';
import {
  ChartBar,
  CalendarBlank,
  MagnifyingGlass,
  ArrowClockwise,
  CircleNotch,
  Users,
  CurrencyDollar,
  Receipt,
  Clock,
  Warning,
  ChatCircleDots,
  FileText,
  TrendUp,
  ArrowUp,
  ArrowDown,
  ChartLineUp,
  ListBullets,
  ClockClockwise,
  CheckCircle,
  Trash,
  UploadSimple,
  PaperclipHorizontal,
  PaperPlaneRight,
  Image,
  X,
  Spinner,
  Gavel,
  FileXls,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';

// Rótulos das seções da aba Situação de Clientes
// Empresas FILIAL — mesma regra do componente FiltroEmpresa: codigo abaixo de
// 5999, exceto 98 e 980 que sao franquias. As franquias (6000+) ficam de fora.
const FRANQUIA_CODES = ['98', '980'];
let filiaisCache = null;

async function buscarCodigosFiliais() {
  if (filiaisCache) return filiaisCache;
  const resp = await fetch(`${TotvsURL}branches`);
  if (!resp.ok) throw new Error(`Erro ao buscar empresas: HTTP ${resp.status}`);
  const result = await resp.json();
  const empresas = result.data?.data || result.data || [];
  filiaisCache = empresas
    .map((e) => String(e.cd_empresa))
    .filter(
      (cd) =>
        /^\d+$/.test(cd) &&
        parseInt(cd, 10) < 5999 &&
        !FRANQUIA_CODES.includes(cd),
    );
  return filiaisCache;
}

// Maximo de clientes por consulta ao contas a receber — o TOTVS recusa
// (HTTP 400) listas acima de ~1000 codigos
const LOTE_CLIENTES = 500;
// Consultas simultaneas ao contas a receber
const LOTES_SIMULTANEOS = 5;

const LABEL_STATUS = {
  inativos: 'Inativos',
  bloqueados: 'Bloqueados',
  ativos: 'Ativos',
};

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler,
  ChartDataLabels,
);

const InadimplentesRevenda = () => {
  const apiClient = useApiClient();
  const { user } = useAuth();
  const {
    salvarClassificacao,
    buscarClassificacoes,
    deletarClassificacao,
    buscarHistorico,
    salvarObservacao,
    buscarObservacoes,
    deletarObservacao,
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
  const [filtroRepresentantes, setFiltroRepresentantes] = useState([]); // array de representantes selecionados

  // Estado para o modal de detalhes do cliente
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [faturasSelecionadas, setFaturasSelecionadas] = useState([]);
  const [faturasAVencer, setFaturasAVencer] = useState([]);
  const [loadingFaturasModal, setLoadingFaturasModal] = useState(false);

  // Estado para o modal de lista de clientes filtrados
  const [modalListaAberto, setModalListaAberto] = useState(false);
  const [tituloModalLista, setTituloModalLista] = useState('');
  const [clientesFiltradosModal, setClientesFiltradosModal] = useState([]);

  // Estado para o modal de histórico
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [historicoSelecionado, setHistoricoSelecionado] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Estado para Representante de cada cliente (valores salvos)
  const [clienteRepresentante, setClienteRepresentante] = useState({}); // { cd_cliente: 'Nome do Representante' }

  // Estados para controle de edição
  const [editandoRepresentante, setEditandoRepresentante] = useState(null); // cd_cliente em edição
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

  // Estado para valores a vencer (agrupados por cliente)
  const [valoresAVencer, setValoresAVencer] = useState({});

  // Estados para modal de solicitação de baixa
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false);
  const [faturaBaixa, setFaturaBaixa] = useState(null);
  const [comprovanteBaixa, setComprovanteBaixa] = useState(null);
  const [previewComprovante, setPreviewComprovante] = useState(null);
  const [observacaoBaixa, setObservacaoBaixa] = useState('');
  const [loadingBaixa, setLoadingBaixa] = useState(false);

  // Estado para alternar entre LISTA, DASHBOARD e CLIENTES INATIVOS
  const [viewMode, setViewMode] = useState('lista');

  // ─── Aba Clientes Inativos ───
  const [clientesRevenda, setClientesRevenda] = useState([]);
  const [inativosCarregados, setInativosCarregados] = useState(false);
  const [inativosLoading, setInativosLoading] = useState(false);
  const [inativosErro, setInativosErro] = useState(null);
  const [buscaInativos, setBuscaInativos] = useState('');
  const [togglandoCliente, setTogglandoCliente] = useState(null);
  // 'inativos' | 'bloqueados' | 'ativos'
  const [filtroStatus, setFiltroStatus] = useState('inativos');

  // ─── Seleção em massa na lista de inadimplentes (para inativar) ───
  const [clientesSelecionados, setClientesSelecionados] = useState(new Set());
  const [inativandoMassa, setInativandoMassa] = useState(false);
  const [progressoInativacao, setProgressoInativacao] = useState('');

  // Títulos já enviados para a Esteira de Protesto
  const [protestos, setProtestos] = useState([]);
  const [modalProtestosAberto, setModalProtestosAberto] = useState(false);
  const [clienteProtestos, setClienteProtestos] = useState(null);

  // Estados para timeline (evolução)
  const [timeline, setTimeline] = useState([]);
  const [timelineRep, setTimelineRep] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Helper para parsear datas sem fuso
  const parseDateNoTZ = (isoDate) => {
    if (!isoDate) return null;
    try {
      const str = String(isoDate).substring(0, 10);
      const [y, m, d] = str.split('-').map(Number);
      return new Date(y, m - 1, d);
    } catch {
      return null;
    }
  };

  const formatCurrency = (value) =>
    (value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  // Normalizar nomes de representantes (agrupar por primeiro nome)
  const normalizeRepName = (name) => {
    if (!name) return 'SEM REPRESENTANTE';
    const firstName = name.trim().split(/\s+/)[0].toUpperCase();
    return firstName;
  };

  // Saneamento de série temporal: em alguns dias o job noturno gravou dados
  // incompletos, gerando quedas bruscas irreais no gráfico. Percorrendo a série
  // em ordem cronológica, sempre que o valor cair mais de 20% em relação ao
  // último valor válido, herdamos o valor anterior (mantém a linha coerente).
  const LIMIAR_QUEDA = 0.8; // valor do dia < 80% do anterior => dado incompleto
  const sanitizarValores = (valoresBrutos) => {
    const resultado = [];
    let anteriorValido = null;
    for (let i = 0; i < valoresBrutos.length; i++) {
      let val = Number(valoresBrutos[i]) || 0;
      if (
        anteriorValido != null &&
        anteriorValido > 0 &&
        val < anteriorValido * LIMIAR_QUEDA
      ) {
        val = anteriorValido; // herda o valor do dia anterior (inclui zeros)
      }
      resultado.push(val);
      if (val > 0) anteriorValido = val;
    }
    return resultado;
  };

  // Igual ao sanitizarValores, mas também corrige PICOS PARA CIMA (subida acima
  // de ~25%). Usado na série "SEM REPRESENTANTE": nos dias de carga incompleta os
  // clientes perdem a classificação e caem nesse balde, inflando o valor. Como
  // 0.8 e 1/0.8 (=1.25) são recíprocos, o limiar fica simétrico (−20% / +25%).
  const sanitizarValoresBidirecional = (valoresBrutos) => {
    const resultado = [];
    let anteriorValido = null;
    for (let i = 0; i < valoresBrutos.length; i++) {
      let val = Number(valoresBrutos[i]) || 0;
      if (anteriorValido != null && anteriorValido > 0) {
        if (
          val < anteriorValido * LIMIAR_QUEDA ||
          val > anteriorValido / LIMIAR_QUEDA
        ) {
          val = anteriorValido; // herda o valor do dia anterior
        }
      }
      resultado.push(val);
      if (val > 0) anteriorValido = val;
    }
    return resultado;
  };

  // "SEM REPRESENTANTE" pode aparecer como 'SEM REPRESENTANTE' (bruto) ou 'SEM'
  // (após normalizeRepName pegar só o 1º nome). Cobre os dois casos.
  const ehSemRepresentante = (nome) =>
    nome === 'SEM' || nome === 'SEM REPRESENTANTE';

  // ======================== TIMELINE SUPABASE ========================
  const carregarTimeline = useCallback(async () => {
    setLoadingTimeline(true);
    try {
      const [resPrincipal, resRep] = await Promise.all([
        supabase
          .from('inadimplencia_revenda_timeline')
          .select(
            'data, valor_total, qtd_clientes, qtd_titulos, valor_atrasados, valor_inadimplentes',
          )
          .order('data', { ascending: true }),
        supabase
          .from('inadimplencia_revenda_representantes_timeline')
          .select('data, representante, valor_total, qtd_clientes')
          .order('data', { ascending: true }),
      ]);
      if (resPrincipal.error) throw resPrincipal.error;
      if (resRep.error) throw resRep.error;
      setTimeline(resPrincipal.data || []);
      setTimelineRep(resRep.data || []);
    } catch (err) {
      console.error('Erro ao carregar timeline Revenda:', err);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  const salvarTimelineHoje = useCallback(
    async (
      valorTotal,
      qtdClientes,
      qtdTitulos,
      representantes = [],
      valorAtrasados = 0,
      valorInadimplentes = 0,
    ) => {
      try {
        const hoje = new Date().toISOString().split('T')[0];

        // Salvar snapshot principal
        const { error: errPrincipal } = await supabase
          .from('inadimplencia_revenda_timeline')
          .upsert(
            {
              data: hoje,
              valor_total: valorTotal,
              qtd_clientes: qtdClientes,
              qtd_titulos: qtdTitulos,
              valor_atrasados: valorAtrasados,
              valor_inadimplentes: valorInadimplentes,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'data' },
          );
        if (errPrincipal) throw errPrincipal;

        // Salvar snapshot por representante
        if (representantes.length > 0) {
          const registros = representantes.map((rep) => ({
            data: hoje,
            representante: rep.representante,
            valor_total: rep.valorTotal,
            qtd_clientes: rep.qtdClientes,
            updated_at: new Date().toISOString(),
          }));
          const { error: errRep } = await supabase
            .from('inadimplencia_revenda_representantes_timeline')
            .upsert(registros, { onConflict: 'data,representante' });
          if (errRep) throw errRep;
        }

        console.log('✅ Timeline Revenda salva para', hoje);
        await carregarTimeline();
      } catch (err) {
        console.error('Erro ao salvar timeline Revenda:', err);
      }
    },
    [carregarTimeline],
  );

  // Carregar timeline ao montar
  useEffect(() => {
    carregarTimeline();
  }, [carregarTimeline]);

  // ======================== SANEAMENTO PERSISTENTE ========================
  // Corrige de forma definitiva no banco os dias com dados incompletos
  // (quedas > 20% em relação ao dia anterior), gravando o valor herdado.
  // Roda uma vez por sessão; o dia de HOJE é ignorado para não conflitar com
  // o snapshot noturno que grava o valor real do dia.
  const timelineSaneadoRef = useRef(false);
  const repsSaneadoRef = useRef(false);

  // Timeline principal
  useEffect(() => {
    if (timelineSaneadoRef.current) return;
    if (!timeline.length) return;

    const campos = [
      'valor_total',
      'qtd_clientes',
      'qtd_titulos',
      'valor_atrasados',
      'valor_inadimplentes',
    ];
    const camposInteiros = ['qtd_clientes', 'qtd_titulos'];

    const corrigidos = {};
    campos.forEach((campo) => {
      corrigidos[campo] = sanitizarValores(
        timeline.map((t) => parseFloat(t[campo]) || 0),
      );
    });

    const linhas = [];
    timeline.forEach((t, i) => {
      if (t.data === hojeStr) return; // não mexe no dia de hoje
      const novo = {};
      let mudou = false;
      campos.forEach((campo) => {
        const orig = parseFloat(t[campo]) || 0;
        let corr = corrigidos[campo][i];
        if (camposInteiros.includes(campo)) corr = Math.round(corr);
        if (Math.abs(orig - corr) > 0.01) mudou = true;
        novo[campo] = corr;
      });
      if (mudou) {
        linhas.push({
          data: t.data,
          ...novo,
          updated_at: new Date().toISOString(),
        });
      }
    });

    timelineSaneadoRef.current = true;
    if (linhas.length > 0) {
      supabase
        .from('inadimplencia_revenda_timeline')
        .upsert(linhas, { onConflict: 'data' })
        .then(({ error }) => {
          if (error) {
            console.error('Erro ao sanear timeline Revenda:', error);
          } else {
            console.log(
              `🩹 ${linhas.length} dia(s) corrigido(s) na timeline Revenda`,
            );
            carregarTimeline();
          }
        });
    }
  }, [timeline, hojeStr, carregarTimeline]);

  // Timeline por representante (corrige cada representante bruto separadamente)
  useEffect(() => {
    if (repsSaneadoRef.current) return;
    if (!timelineRep.length) return;

    const porRep = {};
    timelineRep.forEach((t) => {
      if (!porRep[t.representante]) porRep[t.representante] = [];
      porRep[t.representante].push(t);
    });

    const linhas = [];
    Object.values(porRep).forEach((rows) => {
      const ordenado = [...rows].sort((a, b) => (a.data < b.data ? -1 : 1));
      // "SEM REPRESENTANTE" incha nos dias ruins => corrige também picos p/ cima
      const fn = ehSemRepresentante(ordenado[0]?.representante)
        ? sanitizarValoresBidirecional
        : sanitizarValores;
      const vt = fn(ordenado.map((r) => parseFloat(r.valor_total) || 0));
      const qc = fn(ordenado.map((r) => parseInt(r.qtd_clientes) || 0));
      ordenado.forEach((r, i) => {
        if (r.data === hojeStr) return; // não mexe no dia de hoje
        const origVt = parseFloat(r.valor_total) || 0;
        const origQc = parseInt(r.qtd_clientes) || 0;
        const corrQc = Math.round(qc[i]);
        if (Math.abs(origVt - vt[i]) > 0.01 || origQc !== corrQc) {
          linhas.push({
            data: r.data,
            representante: r.representante,
            valor_total: vt[i],
            qtd_clientes: corrQc,
            updated_at: new Date().toISOString(),
          });
        }
      });
    });

    repsSaneadoRef.current = true;
    if (linhas.length > 0) {
      supabase
        .from('inadimplencia_revenda_representantes_timeline')
        .upsert(linhas, { onConflict: 'data,representante' })
        .then(({ error }) => {
          if (error) {
            console.error('Erro ao sanear timeline Revenda por representante:', error);
          } else {
            console.log(
              `🩹 ${linhas.length} registro(s) corrigido(s) por representante`,
            );
            carregarTimeline();
          }
        });
    }
  }, [timelineRep, hojeStr, carregarTimeline]);

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

  // Handlers para cancelar
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
        ds_siglaest: cliente.ds_uf?.trim() || null,
        situacao: cliente.situacao,
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
      // Adicionar nova observação no final da lista (ordem de envio)
      setObservacoesList((prev) => [...prev, data[0]]);
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

  // Handler para excluir observação
  const excluirObservacao = async (idObservacao) => {
    if (!confirm('Tem certeza que deseja excluir esta observação?')) return;

    setLoadingObservacoes(true);

    try {
      const { success } = await deletarObservacao(idObservacao);

      if (success) {
        // Remover a observação da lista
        setObservacoesList((prev) =>
          prev.filter((obs) => obs.id !== idObservacao),
        );
        setNotification({
          type: 'success',
          message: 'Observação excluída com sucesso!',
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({
          type: 'error',
          message: 'Erro ao excluir observação',
        });
      }
    } catch (error) {
      console.error('Erro ao excluir observação:', error);
      setNotification({
        type: 'error',
        message: 'Erro ao excluir observação',
      });
    } finally {
      setLoadingObservacoes(false);
    }
  };

  // Verificar se o usuário pode excluir a observação (120 segundos)
  const podeExcluirObservacao = (observacao) => {
    if (!user) return false;
    if (observacao.usuario !== user.email && observacao.usuario !== user.id)
      return false;

    const dataObservacao = new Date(observacao.data_criacao);
    const agora = new Date();
    const diferencaSegundos = (agora - dataObservacao) / 1000;

    return diferencaSegundos <= 120; // 120 segundos = 2 minutos
  };

  // Handler para abrir WhatsApp do cliente (usa nr_telefone já enriquecido via TOTVS)
  const abrirWhatsApp = (cliente, e) => {
    e.stopPropagation();

    const telefone = cliente.nr_telefone || '';

    if (!telefone) {
      setNotification({
        type: 'error',
        message: 'Telefone não encontrado para este cliente',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    // Limpar telefone (remover caracteres especiais)
    const telefoneClean = telefone.replace(/\D/g, '');

    // Construir lista de faturas
    const listaFaturas = (cliente.faturas || [])
      .map((fatura) => {
        const numeroFatura = fatura.nr_fat || fatura.nr_fatura || 'N/A';
        const vencimento = fatura.dt_vencimento
          ? new Date(fatura.dt_vencimento).toLocaleDateString('pt-BR')
          : 'N/A';
        const valor = formatarMoeda(fatura.vl_fatura || 0);

        return `*Fatura:* ${numeroFatura}\n*Vencimento:* ${vencimento}\n*Valor:* ${valor}`;
      })
      .join('\n\n');

    // Mensagem padrão pré-definida
    const mensagemPadrao = `Olá, tudo bem? *${cliente.nm_cliente}*
Somos da área de Recuperação de Créditos da Crosby.
Consta em nosso sistema a existência de pendências financeiras em aberto em seu cadastro.
Entramos em contato para alinhar e verificar a melhor forma de regularização.

Segue a lista dos títulos em aberto:

${listaFaturas}

*Observação:* Caso os pagamentos já tenham sido realizados, pedimos gentilmente que desconsidere esta mensagem e nos envie o comprovante para atualização em nosso sistema.

Atenciosamente,
Crosby`;

    // Codificar a mensagem para URL
    const mensagemCodificada = encodeURIComponent(mensagemPadrao);

    // Abrir WhatsApp com mensagem pré-definida
    const whatsappUrl = `https://wa.me/55${telefoneClean}?text=${mensagemCodificada}`;
    window.open(whatsappUrl, '_blank');
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
    const clientes = clientesAgrupados.filter((c) => c.situacao === 'VENCIDO');
    abrirModalLista('Clientes Vencidos (até 60 dias)', clientes);
  };

  const abrirModalInadimplentes = () => {
    const clientes = clientesAgrupados.filter(
      (c) => c.situacao === 'INADIMPLENTE',
    );
    abrirModalLista('Clientes Inadimplentes (acima de 60 dias)', clientes);
  };

  // Buscar dados da API via TOTVS
  const fetchDados = async () => {
    try {
      setLoading(true);

      const dataIni = filtroDataInicial || '2024-01-01';
      const dataFim = filtroDataFinal || hojeStr;

      // Calcular data de amanhã para buscar "a vencer"
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      const amanhaStr = amanha.toISOString().split('T')[0];
      // 1 ano a frente para faturas a vencer
      const umAnoFrente = new Date();
      umAnoFrente.setFullYear(umAnoFrente.getFullYear() + 1);
      const umAnoFrenteStr = umAnoFrente.toISOString().split('T')[0];

      // ============================================================
      // PASSO 1: Faturas das empresas FILIAL (franquias ficam de fora)
      // ============================================================
      // Buscar as faturas primeiro e classificar depois e MUITO mais rapido do
      // que listar os ~25 mil clientes de revenda e consultar em lotes: o TOTVS
      // derrubava a conexao naquele volume.
      const codigosFiliais = await buscarCodigosFiliais();
      console.log(`🏢 Restringindo a ${codigosFiliais.length} empresas FILIAL`);

      const buscarFaturas = async (dtInicio, dtFim, status) => {
        const params = new URLSearchParams({
          dt_inicio: dtInicio,
          dt_fim: dtFim,
          modo: 'vencimento',
          situacao: '1',
          status,
          branches: codigosFiliais.join(','),
        });
        const resp = await fetch(
          `${TotvsURL}accounts-receivable/filter?${params.toString()}`,
        );
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.message || `Erro HTTP ${resp.status}`);
        }
        const result = await resp.json();
        return result.data?.items || [];
      };

      console.log('🔍 Buscando faturas das filiais via TOTVS...');
      const [todasVencidas, todasAVencer] = await Promise.all([
        buscarFaturas(dataIni, dataFim, 'Vencido'),
        buscarFaturas(amanhaStr, umAnoFrenteStr, 'Em Aberto').catch((err) => {
          console.warn('⚠️ Falha ao buscar faturas a vencer:', err.message);
          return [];
        }),
      ]);

      // ============================================================
      // PASSO 2: Classificar so os clientes que tem fatura
      // ============================================================
      const codigosComFatura = [
        ...new Set(
          [...todasVencidas, ...todasAVencer]
            .map((i) => parseInt(i.cd_cliente, 10))
            .filter((c) => !isNaN(c)),
        ),
      ];

      const respClassif = await fetch(`${TotvsURL}clients-classifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personCodes: codigosComFatura }),
      });
      if (!respClassif.ok) {
        const errData = await respClassif.json().catch(() => ({}));
        throw new Error(
          errData.message || `Erro ao classificar clientes: HTTP ${respClassif.status}`,
        );
      }
      const classificados = (await respClassif.json()).data || [];

      // REVENDA = tipo 7/code 1 (REVENDEDOR SIM) ou tipo 20/code 3 (TIPO DE
      // CLIENTE = REVENDEDOR), a mesma uniao usada nos multimarcas
      const ehRevenda = (c) =>
        (c.classifications || []).some(
          (cl) =>
            (cl.typeCode === 7 && String(cl.code) === '1') ||
            (cl.typeCode === 20 && String(cl.code) === '3'),
        );

      const revenda = classificados.filter(ehRevenda);
      const revendaMap = {};
      revenda.forEach((m) => {
        revendaMap[String(m.code)] = m;
      });
      setClientesRevenda(revenda);
      setInativosCarregados(true);

      console.log(
        `📋 ${codigosComFatura.length} clientes com fatura → ${revenda.length} sao de revenda`,
      );

      if (revenda.length === 0) {
        console.warn('⚠️ Nenhum cliente revenda com faturas no periodo.');
        setDados([]);
        setValoresAVencer({});
        return;
      }

      const faturasVencidas = todasVencidas.filter(
        (i) => revendaMap[String(i.cd_cliente)],
      );
      const faturasAVencerTodas = todasAVencer.filter(
        (i) => revendaMap[String(i.cd_cliente)],
      );

      console.log(
        `📊 Faturas revenda — vencidas: ${faturasVencidas.length}, A vencer: ${faturasAVencerTodas.length}`,
      );

      // Filtrar apenas tipo documento FATURA (tp_documento = 1)
      const vencidasFiltradas = faturasVencidas.filter(
        (item) => item.tp_documento === 1 || item.tp_documento === '1',
      );

      const aVencerFiltradas = faturasAVencerTodas.filter(
        (item) => item.tp_documento === 1 || item.tp_documento === '1',
      );

      console.log(
        `📊 Após filtro FATURA: vencidas=${vencidasFiltradas.length}, a vencer=${aVencerFiltradas.length}`,
      );

      // ============================================================
      // PASSO 3: Enriquecer com dados de pessoa (telefone, UF)
      // ============================================================
      const todosCodigosClientes = [
        ...new Set(
          [
            ...vencidasFiltradas.map((item) => item.cd_cliente),
            ...aVencerFiltradas.map((item) => item.cd_cliente),
          ].filter(Boolean),
        ),
      ];

      let pessoasMap = {};
      if (todosCodigosClientes.length > 0) {
        try {
          const respPessoas = await fetch(`${TotvsURL}persons/batch-lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personCodes: todosCodigosClientes }),
          });
          if (respPessoas.ok) {
            const dataPessoas = await respPessoas.json();
            pessoasMap = dataPessoas?.data || {};
            console.log(
              `👤 ${Object.keys(pessoasMap).length} clientes encontrados via batch-lookup`,
            );
          }
        } catch (err) {
          console.warn('⚠️ Erro ao buscar dados de pessoas:', err.message);
        }
      }

      // Enriquecer faturas vencidas com dados de pessoa + dados do cache de revenda
      const dadosEnriquecidos = vencidasFiltradas.map((item) => {
        const pessoa = pessoasMap[String(item.cd_cliente)] || {};
        const revendaCliente = revendaMap[String(item.cd_cliente)] || {};
        return {
          ...item,
          nm_cliente:
            pessoa.name ||
            revendaCliente.name ||
            item.nm_cliente ||
            item.nr_cpfcnpj ||
            `Cliente ${item.cd_cliente}`,
          nm_fantasia:
            pessoa.fantasyName ||
            revendaCliente.fantasyName ||
            item.nm_fantasia ||
            '',
          nr_telefone: pessoa.phone || '',
          ds_uf: pessoa.uf || item.ds_uf || '',
        };
      });

      // Processar valores a vencer por cd_cliente
      const aVencerMap = {};
      aVencerFiltradas.forEach((item) => {
        const cd = String(item.cd_cliente);
        aVencerMap[cd] =
          (aVencerMap[cd] || 0) + (parseFloat(item.vl_fatura) || 0);
      });
      setValoresAVencer(aVencerMap);

      console.log(
        '📊 Dados inadimplentes revenda via TOTVS:',
        dadosEnriquecidos.length,
      );
      setDados(dadosEnriquecidos);

      // CARREGAR CLASSIFICAÇÕES DO SUPABASE
      if (dadosEnriquecidos.length > 0) {
        const { success, data: classificacoesSalvas } =
          await buscarClassificacoes();

        if (success && classificacoesSalvas) {
          const representanteMap = {};

          classificacoesSalvas.forEach((c) => {
            if (c.representante) {
              representanteMap[c.cd_cliente] = c.representante;
            }
          });

          setClienteRepresentante(representanteMap);
          console.log('✅ Classificações carregadas do Supabase:', {
            representante: Object.keys(representanteMap).length,
          });
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dados de inadimplentes:', error);
      setDados([]);
      setNotification({
        type: 'error',
        message: `Erro ao carregar dados: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    fetchDados();
  }, []);

  // Dados filtrados (tipo documento e vencimento já filtrados no backend)
  const dadosFiltrados = useMemo(() => {
    return dados.filter((item) => {
      const matchCliente =
        filtroClientes.length === 0 ||
        filtroClientes.includes(String(item.cd_cliente));
      const uf = item.ds_uf?.trim() || '';
      const matchEstado =
        filtroEstados.length === 0 || filtroEstados.includes(uf);
      const rep = clienteRepresentante[item.cd_cliente] || '';
      const matchRepresentante =
        filtroRepresentantes.length === 0 || filtroRepresentantes.includes(rep);
      return matchCliente && matchEstado && matchRepresentante;
    });
  }, [
    dados,
    filtroClientes,
    filtroEstados,
    filtroRepresentantes,
    clienteRepresentante,
  ]);

  // Lista de estados disponíveis para o select
  const estadosDisponiveis = useMemo(() => {
    const setEstados = new Set();
    dados.forEach((d) => {
      if (d.ds_uf) setEstados.add(d.ds_uf.trim());
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

  // Lista de representantes disponíveis (únicos)
  const representantesDisponiveis = useMemo(() => {
    const set = new Set();
    Object.values(clienteRepresentante).forEach((rep) => {
      if (rep) set.add(rep);
    });
    return Array.from(set).sort();
  }, [clienteRepresentante]);

  // (filtros de cliente/estado foram externalizados para componentes)

  // Agrupar clientes por cd_cliente
  const clientesAgrupados = useMemo(() => {
    const agrupado = dadosFiltrados.reduce((acc, item) => {
      const cdCliente = item.cd_cliente;
      if (!acc[cdCliente]) {
        acc[cdCliente] = {
          cd_cliente: cdCliente,
          nm_cliente: item.nm_cliente,
          nm_fantasia: item.nm_fantasia || '',
          nr_telefone: item.nr_telefone || '',
          ds_uf: item.ds_uf || '',
          nr_cpfcnpj: item.nr_cpfcnpj || '',
          valor_total: 0,
          faturas: [],
        };
      }
      if (!acc[cdCliente].nr_cpfcnpj && item.nr_cpfcnpj) {
        acc[cdCliente].nr_cpfcnpj = item.nr_cpfcnpj;
      }
      acc[cdCliente].valor_total += parseFloat(item.vl_fatura) || 0;
      acc[cdCliente].faturas.push(item);
      return acc;
    }, {});

    // Calcular situação de cada cliente (INADIMPLENTE se atraso > 60 dias)
    const resultado = Object.values(agrupado).map((cliente) => {
      const diasAtrasoMax = (cliente.faturas || []).reduce((max, fatura) => {
        if (!fatura.dt_vencimento) return max;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const [datePart] = String(fatura.dt_vencimento).split('T');
        const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
        const venc = new Date(y, m - 1, d);
        venc.setHours(0, 0, 0, 0);
        const diff = Math.floor((hoje - venc) / (1000 * 60 * 60 * 24));
        return Math.max(max, diff);
      }, 0);

      const situacao = diasAtrasoMax > 60 ? 'INADIMPLENTE' : 'VENCIDO';

      return {
        ...cliente,
        diasAtrasoMax,
        situacao,
        representante: clienteRepresentante[cliente.cd_cliente] || null,
        valor_a_vencer: valoresAVencer[cliente.cd_cliente] || 0,
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
          case 'nr_cpfcnpj':
            valorA = String(a.nr_cpfcnpj || '');
            valorB = String(b.nr_cpfcnpj || '');
            break;
          case 'ds_uf':
            valorA = (a.ds_uf || '').trim().toLowerCase();
            valorB = (b.ds_uf || '').trim().toLowerCase();
            break;
          case 'valor_total':
            valorA = parseFloat(a.valor_total) || 0;
            valorB = parseFloat(b.valor_total) || 0;
            break;
          case 'situacao':
            valorA = (a.situacao || '').toLowerCase();
            valorB = (b.situacao || '').toLowerCase();
            break;
          case 'representante':
            valorA = (a.representante || '').toLowerCase();
            valorB = (b.representante || '').toLowerCase();
            break;
          case 'valor_a_vencer':
            valorA = parseFloat(a.valor_a_vencer) || 0;
            valorB = parseFloat(b.valor_a_vencer) || 0;
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
    clienteRepresentante,
    valoresAVencer,
    ordenarPor,
    direcaoOrdenacao,
  ]);

  // Resumo de dívida por representante
  const resumoPorRepresentante = useMemo(() => {
    const mapa = {};
    clientesAgrupados.forEach((cliente) => {
      const rep = normalizeRepName(cliente.representante);
      if (!mapa[rep]) {
        mapa[rep] = {
          representante: rep,
          qtdClientes: 0,
          valorTotal: 0,
          valorAVencer: 0,
        };
      }
      mapa[rep].qtdClientes += 1;
      mapa[rep].valorTotal += cliente.valor_total || 0;
      mapa[rep].valorAVencer += cliente.valor_a_vencer || 0;
    });
    return Object.values(mapa).sort((a, b) => b.valorTotal - a.valorTotal);
  }, [clientesAgrupados]);

  // Auto-salvar timeline quando dados carregam (apenas se há dados e não há filtros aplicados)
  useEffect(() => {
    if (
      clientesAgrupados.length > 0 &&
      filtroClientes.length === 0 &&
      filtroEstados.length === 0 &&
      filtroRepresentantes.length === 0 &&
      resumoPorRepresentante.length > 0
    ) {
      const valorTotal = clientesAgrupados.reduce(
        (acc, c) => acc + c.valor_total,
        0,
      );
      const qtdClientes = clientesAgrupados.length;
      const qtdTitulos = clientesAgrupados.reduce(
        (acc, c) => acc + (c.faturas?.length || 0),
        0,
      );
      const atrasados = clientesAgrupados.filter(
        (c) => c.situacao === 'VENCIDO',
      );
      const inadimplentes = clientesAgrupados.filter(
        (c) => c.situacao === 'INADIMPLENTE',
      );
      const valorAtrasados = atrasados.reduce(
        (acc, c) => acc + c.valor_total,
        0,
      );
      const valorInadimplentes = inadimplentes.reduce(
        (acc, c) => acc + c.valor_total,
        0,
      );
      salvarTimelineHoje(
        valorTotal,
        qtdClientes,
        qtdTitulos,
        resumoPorRepresentante,
        valorAtrasados,
        valorInadimplentes,
      );
    }
  }, [
    clientesAgrupados,
    resumoPorRepresentante,
    filtroClientes,
    filtroEstados,
    filtroRepresentantes,
    salvarTimelineHoje,
  ]);

  // ======================== CHART DATA MEMOS ========================

  // Gráfico: Evolução do Valor Total da Inadimplência
  const chartTimelineValor = useMemo(() => {
    if (!timeline.length) return null;
    return {
      labels: timeline.map((t) => {
        const d = parseDateNoTZ(t.data);
        return d
          ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : t.data;
      }),
      datasets: [
        {
          label: 'Valor Total Inadimplência',
          data: sanitizarValores(
            timeline.map((t) => parseFloat(t.valor_total) || 0),
          ),
          borderColor: '#fe0000',
          backgroundColor: 'rgba(254, 0, 0, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#fe0000',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [timeline]);

  // Gráfico: Evolução da Quantidade de Clientes
  const chartTimelineClientes = useMemo(() => {
    if (!timeline.length) return null;
    return {
      labels: timeline.map((t) => {
        const d = parseDateNoTZ(t.data);
        return d
          ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : t.data;
      }),
      datasets: [
        {
          label: 'Qtd Clientes Inadimplentes',
          data: sanitizarValores(
            timeline.map((t) => parseInt(t.qtd_clientes) || 0),
          ),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [timeline]);

  // Gráfico: Evolução Atrasados vs Inadimplentes
  const chartTimelineAtrasadosInadimplentes = useMemo(() => {
    if (!timeline.length) return null;
    // Filtrar apenas entradas que têm dados de atrasados/inadimplentes
    const dados = timeline.filter(
      (t) =>
        (parseFloat(t.valor_atrasados) || 0) > 0 ||
        (parseFloat(t.valor_inadimplentes) || 0) > 0,
    );
    if (!dados.length) return null;
    return {
      labels: dados.map((t) => {
        const d = parseDateNoTZ(t.data);
        return d
          ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : t.data;
      }),
      datasets: [
        {
          label: 'Vencidos (≤ 60 dias)',
          data: sanitizarValores(
            dados.map((t) => parseFloat(t.valor_atrasados) || 0),
          ),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
        {
          label: 'Inadimplentes (> 60 dias)',
          data: sanitizarValores(
            dados.map((t) => parseFloat(t.valor_inadimplentes) || 0),
          ),
          borderColor: '#fe0000',
          backgroundColor: 'rgba(254, 0, 0, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#fe0000',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [timeline]);

  // Gráfico: Evolução por Representante (top 5 por último valor)
  // Agregar dados de timelineRep por nome normalizado
  const normalizedTimelineRep = useMemo(() => {
    if (!timelineRep.length) return [];
    const grouped = {};
    timelineRep.forEach((t) => {
      const normName = normalizeRepName(t.representante);
      const key = `${t.data}||${normName}`;
      if (!grouped[key]) {
        grouped[key] = {
          data: t.data,
          representante: normName,
          valor_total: 0,
          qtd_clientes: 0,
        };
      }
      grouped[key].valor_total += parseFloat(t.valor_total) || 0;
      grouped[key].qtd_clientes += parseInt(t.qtd_clientes) || 0;
    });
    return Object.values(grouped);
  }, [timelineRep]);

  const CORES_REPRESENTANTES = [
    '#000638',
    '#fe0000',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#6366f1',
    '#14b8a6',
  ];

  const chartTimelineRepresentantes = useMemo(() => {
    if (!normalizedTimelineRep.length) return null;

    // Pegar datas únicas ordenadas
    const datasUnicas = [...new Set(normalizedTimelineRep.map((t) => t.data))].sort();
    const labels = datasUnicas.map((d) => {
      const dt = parseDateNoTZ(d);
      return dt
        ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : d;
    });

    // Pegar nomes únicos de representantes e ordenar pelo valor na última data
    const ultimaData = datasUnicas[datasUnicas.length - 1];
    const dadosUltimaData = normalizedTimelineRep.filter((t) => t.data === ultimaData);
    const repsOrdenados = dadosUltimaData
      .sort(
        (a, b) =>
          (parseFloat(b.valor_total) || 0) - (parseFloat(a.valor_total) || 0),
      )
      .map((t) => t.representante);

    // Montar datasets
    const datasets = repsOrdenados.map((rep, idx) => {
      const cor = CORES_REPRESENTANTES[idx % CORES_REPRESENTANTES.length];
      return {
        label: rep,
        data: (ehSemRepresentante(rep)
          ? sanitizarValoresBidirecional
          : sanitizarValores)(
          datasUnicas.map((data) => {
            const entry = normalizedTimelineRep.find(
              (t) => t.data === data && t.representante === rep,
            );
            return entry ? parseFloat(entry.valor_total) || 0 : 0;
          }),
        ),
        borderColor: cor,
        backgroundColor: cor + '1A',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: cor,
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointHoverRadius: 6,
      };
    });

    return { labels, datasets };
  }, [normalizedTimelineRep]);

  // Chart: Evolução qtd clientes por representante
  const chartTimelineRepClientes = useMemo(() => {
    if (!normalizedTimelineRep.length) return null;

    const datasUnicas = [...new Set(normalizedTimelineRep.map((t) => t.data))].sort();
    const labels = datasUnicas.map((d) => {
      const dt = parseDateNoTZ(d);
      return dt
        ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : d;
    });

    const ultimaData = datasUnicas[datasUnicas.length - 1];
    const dadosUltimaData = normalizedTimelineRep.filter((t) => t.data === ultimaData);
    const repsOrdenados = dadosUltimaData
      .sort(
        (a, b) =>
          (parseInt(b.qtd_clientes) || 0) - (parseInt(a.qtd_clientes) || 0),
      )
      .map((t) => t.representante);

    const datasets = repsOrdenados.map((rep, idx) => {
      const cor = CORES_REPRESENTANTES[idx % CORES_REPRESENTANTES.length];
      return {
        label: rep,
        data: (ehSemRepresentante(rep)
          ? sanitizarValoresBidirecional
          : sanitizarValores)(
          datasUnicas.map((data) => {
            const entry = normalizedTimelineRep.find(
              (t) => t.data === data && t.representante === rep,
            );
            return entry ? parseInt(entry.qtd_clientes) || 0 : 0;
          }),
        ),
        borderColor: cor,
        backgroundColor: cor + '1A',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: cor,
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointHoverRadius: 6,
      };
    });

    return { labels, datasets };
  }, [normalizedTimelineRep]);

  // Opções dos gráficos de linha
  const lineOptionsValor = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        display: true,
        color: '#000638',
        font: { weight: 'bold', size: 9 },
        formatter: (v) => formatCurrency(v),
        anchor: 'end',
        align: 'top',
        offset: 4,
      },
      tooltip: {
        callbacks: { label: (ctx) => formatCurrency(ctx.raw) },
      },
    },
    scales: {
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: { font: { size: 10 }, callback: (v) => formatCurrency(v) },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  const lineOptionsClientes = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        display: true,
        color: '#000638',
        font: { weight: 'bold', size: 10 },
        formatter: (v) => v,
        anchor: 'end',
        align: 'top',
        offset: 4,
      },
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.raw} clientes` },
      },
    },
    scales: {
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: { font: { size: 10 }, stepSize: 1 },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  const lineOptionsRepresentantes = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { font: { size: 10 }, boxWidth: 12, padding: 8 },
      },
      datalabels: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: { font: { size: 10 }, callback: (v) => formatCurrency(v) },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  const lineOptionsRepClientes = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { font: { size: 10 }, boxWidth: 12, padding: 8 },
      },
      datalabels: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} clientes`,
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: { font: { size: 10 }, stepSize: 1 },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  const lineOptionsAtrasadosInadimplentes = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { font: { size: 11 }, boxWidth: 14, padding: 12 },
      },
      datalabels: {
        display: true,
        color: (ctx) => (ctx.datasetIndex === 0 ? '#f59e0b' : '#fe0000'),
        font: { weight: 'bold', size: 9 },
        formatter: (v) => formatCurrency(v),
        anchor: 'end',
        align: 'top',
        offset: 4,
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: { font: { size: 10 }, callback: (v) => formatCurrency(v) },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  // Calcular variações percentuais em relação ao primeiro dia da timeline
  const variacoes = useMemo(() => {
    const calcVar = (primeiro, ultimo) => {
      if (!primeiro || primeiro === 0) return null;
      return ((ultimo - primeiro) / Math.abs(primeiro)) * 100;
    };

    if (timeline.length < 2) {
      return {
        valor: null,
        clientes: null,
        atrasados: null,
        inadimplentes: null,
      };
    }

    // Usar séries saneadas (mesma correção dos gráficos) para o cálculo
    const valorSane = sanitizarValores(
      timeline.map((t) => parseFloat(t.valor_total) || 0),
    );
    const clientesSane = sanitizarValores(
      timeline.map((t) => parseInt(t.qtd_clientes) || 0),
    );
    const atrasadosSane = sanitizarValores(
      timeline.map((t) => parseFloat(t.valor_atrasados) || 0),
    );
    const inadimplentesSane = sanitizarValores(
      timeline.map((t) => parseFloat(t.valor_inadimplentes) || 0),
    );
    const ultimoIdx = timeline.length - 1;

    return {
      valor: calcVar(valorSane[0], valorSane[ultimoIdx]),
      clientes: calcVar(clientesSane[0], clientesSane[ultimoIdx]),
      atrasados: calcVar(atrasadosSane[0], atrasadosSane[ultimoIdx]),
      inadimplentes: calcVar(
        inadimplentesSane[0],
        inadimplentesSane[ultimoIdx],
      ),
      primeiraData: timeline[0].data,
    };
  }, [timeline]);

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
      (c) => c.situacao === 'VENCIDO',
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
    };
  }, [clientesAgrupados, dadosFiltrados]);

  // Mapear tipo de cobrança TOTVS
  const getTipoCobranca = (tipo) => {
    const mapa = {
      0: { label: 'SIMPLES', color: 'bg-gray-100 text-gray-800' },
      1: { label: 'DESCONTADA', color: 'bg-purple-100 text-purple-800' },
      2: { label: 'VINCULADA', color: 'bg-cyan-100 text-cyan-800' },
      3: { label: 'CAUCIONADA', color: 'bg-yellow-100 text-yellow-800' },
      4: { label: 'PROTESTO', color: 'bg-red-100 text-red-800' },
    };
    return (
      mapa[tipo] || {
        label: tipo != null ? `TIPO ${tipo}` : '--',
        color: 'bg-gray-100 text-gray-600',
      }
    );
  };

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  };

  // Exporta a tabela principal de clientes inadimplentes para Excel
  const baixarExcel = useCallback(() => {
    const rows = clientesAgrupados.map((cliente) => ({
      'Código Cliente': cliente.cd_cliente || '',
      'Nome Cliente': cliente.nm_cliente || '',
      'CPF/CNPJ': formatarCpfCnpj(cliente.nr_cpfcnpj) || '',
      Estado: cliente.ds_uf?.trim() || '',
      'Valor Vencido': parseFloat(cliente.valor_total) || 0,
      'A Vencer': parseFloat(cliente.valor_a_vencer) || 0,
      Situação: cliente.situacao || '',
      Representante: cliente.representante || '',
      'Dias Atraso (máx)': cliente.diasAtrasoMax || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 40 },
      { wch: 20 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inadimplentes Revenda');
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `inadimplentes-revenda-${date}.xlsx`);
  }, [clientesAgrupados]);

  const formatarCpfCnpj = (valor) => {
    const d = String(valor || '').replace(/\D/g, '');
    if (d.length === 14)
      return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (d.length === 11)
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return valor || '';
  };

  // Situação do cliente no TOTVS — o customerStatus da busca é a fonte
  // confiável (a API não preenche isInactive na consulta)
  const estaInativo = (c) =>
    c.isInactive === true || /inativo/i.test(c.customerStatus || '');
  const estaBloqueado = (c) => /bloque/i.test(c.customerStatus || '');

  // ─── Aba Situacao dos Clientes ────────────────────────────────────────────
  // A lista vem do proprio fetchDados: sao os clientes de revenda que tem
  // fatura no periodo. Nao ha carga separada — listar os ~25 mil classificados
  // era lento demais e derrubava a conexao com o TOTVS.
  const carregarStatusRevenda = useCallback(async () => {
    setInativosErro(null);
    if (clientesRevenda.length === 0) {
      setInativosErro(
        'Use o filtro acima para carregar os dados — a situacao mostra os clientes de revenda com faturas no periodo.',
      );
    }
  }, [clientesRevenda]);

  // Valor vencido por cliente (a partir das faturas vencidas já carregadas)
  const valoresVencidosPorCliente = useMemo(() => {
    const mapa = {};
    dados.forEach((i) => {
      const cd = String(i.cd_cliente);
      mapa[cd] = (mapa[cd] || 0) + (parseFloat(i.vl_fatura) || 0);
    });
    return mapa;
  }, [dados]);

  // Clientes do status escolhido, separados por situação de faturas.
  // A situação vem do customerStatus do TOTVS (Ativo/Inativo/Bloqueado/
  // Restrito) — o isInactive da busca não é preenchido pela API.
  const clientesInativosView = useMemo(() => {
    const termo = buscaInativos.trim().toLowerCase();
    const termoDigitos = termo.replace(/\D/g, '');

    const filtrarBusca = (c) => {
      if (!termo) return true;
      return (
        (c.name || '').toLowerCase().includes(termo) ||
        (c.fantasyName || '').toLowerCase().includes(termo) ||
        String(c.code).includes(termo) ||
        (termoDigitos.length > 0 &&
          String(c.cpfCnpj || c.cnpj || '').includes(termoDigitos))
      );
    };

    const enriquecer = (c) => ({
      ...c,
      valorVencido: valoresVencidosPorCliente[String(c.code)] || 0,
      valorAVencer: valoresAVencer[String(c.code)] || 0,
    });

    const contagem = {
      inativos: clientesRevenda.filter(estaInativo).length,
      bloqueados: clientesRevenda.filter(estaBloqueado).length,
      ativos: clientesRevenda.filter(
        (c) => !estaInativo(c) && !estaBloqueado(c),
      ).length,
    };

    const porStatus = {
      inativos: estaInativo,
      bloqueados: estaBloqueado,
      ativos: (c) => !estaInativo(c) && !estaBloqueado(c),
    }[filtroStatus];

    const lista = clientesRevenda
      .filter(porStatus)
      .filter(filtrarBusca)
      .map(enriquecer);

    return {
      contagem,
      total: lista.length,
      comAVencer: lista
        .filter((c) => c.valorAVencer > 0)
        .sort((a, b) => b.valorAVencer - a.valorAVencer),
      comVencidas: lista
        .filter((c) => c.valorAVencer <= 0 && c.valorVencido > 0)
        .sort((a, b) => b.valorVencido - a.valorVencido),
      semFaturas: lista
        .filter((c) => c.valorAVencer <= 0 && c.valorVencido <= 0)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    };
  }, [
    clientesRevenda,
    buscaInativos,
    filtroStatus,
    valoresVencidosPorCliente,
    valoresAVencer,
  ]);

  // ─── Seleção em massa na lista de inadimplentes ────────────────────────────
  const toggleSelecionado = (cdCliente) => {
    setClientesSelecionados((prev) => {
      const n = new Set(prev);
      const key = String(cdCliente);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const toggleSelecionarTodos = () => {
    setClientesSelecionados((prev) => {
      const todos = clientesAgrupados.map((c) => String(c.cd_cliente));
      const todosSelecionados =
        todos.length > 0 && todos.every((cd) => prev.has(cd));
      return todosSelecionados ? new Set() : new Set(todos);
    });
  };

  // Inativa no TOTVS todos os clientes selecionados na lista (sequencial)
  const inativarSelecionados = async () => {
    const clientes = clientesAgrupados.filter((c) =>
      clientesSelecionados.has(String(c.cd_cliente)),
    );
    if (clientes.length === 0) return;
    if (
      !window.confirm(
        `INATIVAR ${clientes.length} cliente(s) no TOTVS?\n\nO campo Ativo/Inativo do cadastro de cada cliente será alterado.`,
      )
    )
      return;

    setInativandoMassa(true);
    const falhas = [];
    let ok = 0;

    for (let i = 0; i < clientes.length; i++) {
      const cliente = clientes[i];
      setProgressoInativacao(`${i + 1}/${clientes.length}`);
      const doc = String(cliente.nr_cpfcnpj || '').replace(/\D/g, '');
      if (doc.length !== 11 && doc.length !== 14) {
        falhas.push(`${cliente.nm_cliente}: sem CPF/CNPJ válido`);
        continue;
      }
      const isPJ = doc.length === 14;
      try {
        const resp = await fetch(`${TotvsURL}cliente/toggle-inactive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personType: isPJ ? 'PJ' : 'PF',
            [isPJ ? 'cnpj' : 'cpf']: doc,
            isInactive: true,
          }),
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok || result.success === false) {
          throw new Error(result.message || `Erro HTTP ${resp.status}`);
        }
        ok++;
        // Reflete na aba Clientes Inativos, se já carregada
        setClientesRevenda((prev) =>
          prev.map((c) =>
            String(c.code) === String(cliente.cd_cliente)
              ? { ...c, isInactive: true, customerStatus: 'Inativo' }
              : c,
          ),
        );
      } catch (err) {
        falhas.push(`${cliente.nm_cliente}: ${err.message}`);
      }
    }

    setInativandoMassa(false);
    setProgressoInativacao('');
    setClientesSelecionados(new Set());

    if (falhas.length > 0) {
      alert(
        `Inativação concluída: ${ok} com sucesso, ${falhas.length} com erro.\n\nErros:\n${falhas.join('\n')}`,
      );
    }
    setNotification({
      type: falhas.length === 0 ? 'success' : 'error',
      message:
        falhas.length === 0
          ? `${ok} cliente(s) inativado(s) no TOTVS com sucesso!`
          : `${ok} inativado(s), ${falhas.length} com erro.`,
    });
    setTimeout(() => setNotification(null), 5000);
  };

  // Ativa/inativa o cliente no TOTVS
  const alternarInativo = async (cliente, novoInativo) => {
    const acao = novoInativo ? 'INATIVAR' : 'ATIVAR';
    if (
      !window.confirm(
        `${acao} o cliente ${cliente.name} (cód. ${cliente.code}) no TOTVS?`,
      )
    )
      return;
    setTogglandoCliente(cliente.code);
    try {
      const resp = await fetch(`${TotvsURL}cliente/toggle-inactive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personType: cliente.personType === 'PF' ? 'PF' : 'PJ',
          ...(cliente.personType === 'PF'
            ? { cpf: cliente.cpf || cliente.cpfCnpj }
            : { cnpj: cliente.cnpj || cliente.cpfCnpj }),
          isInactive: novoInativo,
        }),
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok || result.success === false) {
        throw new Error(result.message || `Erro HTTP ${resp.status}`);
      }
      setClientesRevenda((prev) =>
        prev.map((c) =>
          c.code === cliente.code
            ? {
                ...c,
                isInactive: novoInativo,
                customerStatus: novoInativo ? 'Inativo' : 'Ativo',
              }
            : c,
        ),
      );
      setNotification({
        type: 'success',
        message: `Cliente ${cliente.name} ${novoInativo ? 'inativado' : 'ativado'} no TOTVS com sucesso!`,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Erro ao ${acao.toLowerCase()} cliente: ${err.message}`,
      });
    } finally {
      setTogglandoCliente(null);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const formatarData = (data) => {
    if (!data) return 'N/A';
    const [datePart] = String(data).split('T');
    const [y, m, d] = datePart.split('-');
    if (!y || !m || !d) return 'N/A';
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
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
  const abrirModal = async (cliente) => {
    setClienteSelecionado(cliente);
    setFaturasSelecionadas(cliente.faturas);
    setFaturasAVencer([]);
    setModalAberto(true);
    setLoadingFaturasModal(true);

    // Buscar faturas a vencer do cliente via TOTVS
    try {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      const amanhaStr = amanha.toISOString().split('T')[0];
      const umAnoFrente = new Date();
      umAnoFrente.setFullYear(umAnoFrente.getFullYear() + 1);
      const umAnoFrenteStr = umAnoFrente.toISOString().split('T')[0];

      const params = new URLSearchParams({
        dt_inicio: amanhaStr,
        dt_fim: umAnoFrenteStr,
        modo: 'vencimento',
        situacao: '1',
        status: 'Em Aberto',
        cd_cliente: String(cliente.cd_cliente),
      });

      const response = await fetch(
        `${TotvsURL}accounts-receivable/filter?${params.toString()}`,
      );
      if (response.ok) {
        const result = await response.json();
        const items = result.data?.items || [];
        // Filtrar apenas faturas (tp_documento = 1)
        const faturas = items.filter(
          (item) => item.tp_documento === 1 || item.tp_documento === '1',
        );
        setFaturasAVencer(faturas);
      }
    } catch (error) {
      console.error('Erro ao buscar faturas a vencer:', error);
    } finally {
      setLoadingFaturasModal(false);
    }
  };

  const fecharModal = () => {
    setModalAberto(false);
    setClienteSelecionado(null);
    setFaturasSelecionadas([]);
    setFaturasAVencer([]);
  };

  // === Funções de Solicitação de Baixa ===
  const [dataPagamentoBaixa, setDataPagamentoBaixa] = useState('');
  const [formaPagamentoBaixa, setFormaPagamentoBaixa] = useState('');
  const [dadosCartaoBaixa, setDadosCartaoBaixa] = useState({
    bandeira: '',
    autorizacao: '',
    nsu: '',
  });

  const FORMAS_PAGAMENTO = [
    { id: 'confianca', label: 'Confiança', paidType: 4 },
    { id: 'sicredi', label: 'Sicredi', paidType: 4 },
    { id: 'adiantamento', label: 'Adiantamento (PIX TOTVS)', paidType: 3 },
    { id: 'cartao_credito', label: 'Cartão de Crédito', paidType: 1 },
    { id: 'cartao_debito', label: 'Cartão de Débito', paidType: 2 },
    { id: 'credev', label: 'CREDEV', paidType: 5 },
  ];

  const abrirModalBaixa = (fatura) => {
    setFaturaBaixa(fatura);
    setComprovanteBaixa(null);
    setPreviewComprovante(null);
    setObservacaoBaixa('');
    setDataPagamentoBaixa('');
    setFormaPagamentoBaixa('');
    setDadosCartaoBaixa({ bandeira: '', autorizacao: '', nsu: '' });
    setModalBaixaAberto(true);
  };

  const fecharModalBaixa = () => {
    setModalBaixaAberto(false);
    setFaturaBaixa(null);
    setComprovanteBaixa(null);
    setPreviewComprovante(null);
    setObservacaoBaixa('');
    setDataPagamentoBaixa('');
    setFormaPagamentoBaixa('');
    setDadosCartaoBaixa({ bandeira: '', autorizacao: '', nsu: '' });
  };

  // === Esteira de Protesto ===
  // Envia a fatura para a página /esteira-protesto (tabela esteira_protesto).
  // A unique (cd_empresa, nr_fat, nr_parcela) barra envio duplicado.
  const [enviandoProtesto, setEnviandoProtesto] = useState(null);

  // Chave única do título. Normaliza para número porque o TOTVS devolve
  // nr_fat como number e o Supabase pode devolver o NUMERIC como string.
  const chaveProtesto = (cdEmpresa, nrFat, nrParcela) =>
    `${Number(cdEmpresa)}-${Number(nrFat)}-${Number(nrParcela || 1)}`;

  const chaveFatura = (fatura) =>
    chaveProtesto(
      fatura.cd_empresa,
      fatura.nr_fat || fatura.nr_fatura,
      fatura.nr_parcela,
    );

  // Títulos já enviados para a esteira, para travar o botão e marcar
  // os clientes que têm protesto na tabela principal.
  const carregarProtestos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('esteira_protesto')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProtestos(data || []);
    } catch (err) {
      console.error('Erro ao carregar protestos:', err);
    }
  }, []);

  useEffect(() => {
    carregarProtestos();
  }, [carregarProtestos]);

  const faturasProtestadas = useMemo(
    () =>
      new Set(
        protestos.map((p) =>
          chaveProtesto(p.cd_empresa, p.nr_fat, p.nr_parcela),
        ),
      ),
    [protestos],
  );

  const protestosPorCliente = useMemo(() => {
    const mapa = {};
    protestos.forEach((p) => {
      const key = String(p.cd_cliente);
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(p);
    });
    return mapa;
  }, [protestos]);

  // Regras de protesto: só título do portador SICREDI (748) e vencido
  // há mais de 29 dias (ou seja, a partir de 30 dias de atraso).
  const PORTADOR_PROTESTO = 748;
  const DIAS_MIN_PROTESTO = 29;

  const diasAtrasoFatura = (dtVencimento) => {
    if (!dtVencimento) return 0;
    const [datePart] = String(dtVencimento).split('T');
    const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return 0;
    const venc = new Date(y, m - 1, d);
    venc.setHours(0, 0, 0, 0);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.floor((hoje - venc) / (1000 * 60 * 60 * 24));
  };

  const elegibilidadeProtesto = (fatura) => {
    if (faturasProtestadas.has(chaveFatura(fatura))) {
      return { protestado: true, ok: false, motivo: 'Título já protestado' };
    }
    if (Number(fatura.cd_portador) !== PORTADOR_PROTESTO) {
      return {
        protestado: false,
        ok: false,
        motivo: `Só é possível protestar títulos do portador SICREDI (${PORTADOR_PROTESTO}). Este está em ${fatura.nm_portador || fatura.cd_portador || 'portador não informado'}.`,
      };
    }
    const atraso = diasAtrasoFatura(fatura.dt_vencimento);
    if (atraso <= DIAS_MIN_PROTESTO) {
      return {
        protestado: false,
        ok: false,
        motivo:
          atraso > 0
            ? `Vencido há ${atraso} dia(s) — o protesto exige mais de ${DIAS_MIN_PROTESTO} dias de atraso.`
            : `Título ainda não vencido — o protesto exige mais de ${DIAS_MIN_PROTESTO} dias de atraso.`,
      };
    }
    return { protestado: false, ok: true, motivo: '' };
  };

  const abrirModalProtestos = (cliente, e) => {
    e.stopPropagation();
    setClienteProtestos(cliente);
    setModalProtestosAberto(true);
  };

  const fecharModalProtestos = () => {
    setModalProtestosAberto(false);
    setClienteProtestos(null);
  };

  const enviarParaProtesto = async (fatura) => {
    const chave = chaveFatura(fatura);
    setEnviandoProtesto(chave);
    try {
      const { error } = await supabaseAdmin.from('esteira_protesto').insert({
        cd_empresa: fatura.cd_empresa,
        cd_cliente: String(fatura.cd_cliente),
        nm_cliente:
          clienteSelecionado?.nm_cliente || fatura.nm_cliente || '',
        // Documento vem do próprio título (customerCpfCnpj do TOTVS);
        // é o que o operador usa para protestar no banco.
        nr_cpfcnpj: fatura.nr_cpfcnpj || null,
        nr_fat: fatura.nr_fat || fatura.nr_fatura,
        nr_parcela: fatura.nr_parcela || 1,
        vl_fatura: parseFloat(fatura.vl_fatura) || 0,
        vl_juros: parseFloat(fatura.vl_juros) || 0,
        dt_vencimento: fatura.dt_vencimento
          ? String(fatura.dt_vencimento).split('T')[0]
          : null,
        dt_emissao: fatura.dt_emissao
          ? String(fatura.dt_emissao).split('T')[0]
          : null,
        cd_portador: fatura.cd_portador || null,
        nm_portador: fatura.nm_portador || null,
        // Identificador do título no banco — vai no aviso ao cliente
        nosso_numero: fatura.nosso_numero || null,
        status: 'pendente',
        user_id: user?.id || null,
        user_nome: user?.name || 'Usuário',
        user_email: user?.email || '',
      });

      if (error) {
        // 23505 = violação da unique — a fatura já está na esteira
        if (error.code === '23505') {
          setNotification({
            type: 'error',
            message: 'Esta fatura já está na Esteira de Protesto.',
          });
        } else {
          throw new Error(error.message);
        }
      } else {
        setNotification({
          type: 'success',
          message: 'Fatura enviada para a Esteira de Protesto!',
        });
      }
      // Recarrega para travar o botão e marcar o cliente com "P"
      await carregarProtestos();
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      console.error('Erro ao enviar para protesto:', error);
      setNotification({
        type: 'error',
        message: `Erro ao enviar para protesto: ${error.message}`,
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setEnviandoProtesto(null);
    }
  };

  const handleComprovanteChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setComprovanteBaixa(file);
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewComprovante(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewComprovante(null);
    }
  };

  const handleEnviarBaixa = async () => {
    if (!faturaBaixa || !comprovanteBaixa) {
      setNotification({
        type: 'error',
        message: 'Selecione o comprovante de pagamento.',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!dataPagamentoBaixa) {
      setNotification({
        type: 'error',
        message: 'Informe a data de pagamento.',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!formaPagamentoBaixa) {
      setNotification({
        type: 'error',
        message: 'Selecione a forma de pagamento.',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (
      (formaPagamentoBaixa === 'cartao_credito' ||
        formaPagamentoBaixa === 'cartao_debito') &&
      (!dadosCartaoBaixa.bandeira ||
        !dadosCartaoBaixa.autorizacao ||
        !dadosCartaoBaixa.nsu)
    ) {
      setNotification({
        type: 'error',
        message:
          'Preencha todos os dados do cartão (bandeira, autorização e NSU).',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setLoadingBaixa(true);
    try {
      // 1. Upload do comprovante no Supabase Storage
      const fileExt = comprovanteBaixa.name.split('.').pop();
      const fileName = `${faturaBaixa.cd_empresa}_${faturaBaixa.cd_cliente}_${faturaBaixa.nr_fat || faturaBaixa.nr_fatura}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('comprovantes_baixa')
        .upload(filePath, comprovanteBaixa, { upsert: false });

      if (uploadError)
        throw new Error(`Erro no upload: ${uploadError.message}`);

      // 2. Obter URL pública
      const { data: urlData } = supabaseAdmin.storage
        .from('comprovantes_baixa')
        .getPublicUrl(filePath);

      const comprovanteUrl = urlData?.publicUrl;

      // 3. Salvar solicitação no banco
      const { error: insertError } = await supabaseAdmin
        .from('solicitacoes_baixa')
        .insert({
          cd_empresa: faturaBaixa.cd_empresa,
          cd_cliente: faturaBaixa.cd_cliente,
          nm_cliente:
            clienteSelecionado?.nm_cliente || faturaBaixa.nm_cliente || '',
          nr_fat: faturaBaixa.nr_fat || faturaBaixa.nr_fatura,
          nr_parcela: faturaBaixa.nr_parcela || 1,
          vl_fatura: parseFloat(faturaBaixa.vl_fatura) || 0,
          vl_juros: parseFloat(faturaBaixa.vl_juros) || 0,
          dt_vencimento: faturaBaixa.dt_vencimento
            ? faturaBaixa.dt_vencimento.split('T')[0]
            : null,
          dt_emissao: faturaBaixa.dt_emissao
            ? faturaBaixa.dt_emissao.split('T')[0]
            : null,
          cd_portador: faturaBaixa.cd_portador || null,
          nm_portador: faturaBaixa.nm_portador || null,
          comprovante_url: comprovanteUrl,
          comprovante_path: filePath,
          status: 'pendente',
          user_id: user?.id || null,
          user_nome: user?.name || 'Usuário',
          user_email: user?.email || '',
          observacao: observacaoBaixa || null,
          dt_pagamento: dataPagamentoBaixa || null,
          forma_pagamento: formaPagamentoBaixa || null,
          dados_cartao:
            formaPagamentoBaixa === 'cartao_credito' ||
            formaPagamentoBaixa === 'cartao_debito'
              ? dadosCartaoBaixa
              : null,
        });

      if (insertError)
        throw new Error(`Erro ao salvar: ${insertError.message}`);

      setNotification({
        type: 'success',
        message: 'Solicitação de baixa enviada com sucesso!',
      });
      setTimeout(() => setNotification(null), 4000);
      fecharModalBaixa();
    } catch (error) {
      console.error('Erro ao enviar solicitação de baixa:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Erro ao enviar solicitação.',
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setLoadingBaixa(false);
    }
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
        title="Inadimplencia Revenda"
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
            Configurações para análise de Inadimplência Revenda
          </div>
          <span className="text-xs text-gray-500 mt-1">
            Filtros para consulta de clientes inadimplentes
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3 mt-4">
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
            <div className="col-span-1">
              <FiltroRepresentantes
                representantes={representantesDisponiveis}
                selected={filtroRepresentantes}
                onChange={setFiltroRepresentantes}
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

      {/* Toggle LISTA / DASHBOARD */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('lista')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-colors shadow-md ${
            viewMode === 'lista'
              ? 'bg-[#000638] text-white'
              : 'bg-white text-[#000638] border border-[#000638]/30 hover:bg-gray-50'
          }`}
        >
          <ListBullets size={16} weight="bold" />
          Lista
        </button>
        <button
          onClick={() => setViewMode('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-colors shadow-md ${
            viewMode === 'dashboard'
              ? 'bg-[#000638] text-white'
              : 'bg-white text-[#000638] border border-[#000638]/30 hover:bg-gray-50'
          }`}
        >
          <ChartLineUp size={16} weight="bold" />
          Dashboard
        </button>
        <button
          onClick={() => setViewMode('inativos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-colors shadow-md ${
            viewMode === 'inativos'
              ? 'bg-[#000638] text-white'
              : 'bg-white text-[#000638] border border-[#000638]/30 hover:bg-gray-50'
          }`}
        >
          <Users size={16} weight="bold" />
          Situação dos Clientes
        </button>
      </div>

      {/* ======================== VIEW: DASHBOARD ======================== */}
      {viewMode === 'dashboard' && (
        <div className="space-y-6">
          {loadingTimeline ? (
            <div className="flex items-center justify-center py-12">
              <CircleNotch size={32} className="animate-spin text-[#000638]" />
              <span className="ml-2 text-sm text-gray-500">
                Carregando evolução...
              </span>
            </div>
          ) : (
            <>
              {/* Gráfico: Evolução do Valor Total */}
              <Card className="shadow-lg rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <ChartLineUp size={18} className="text-red-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Evolução do Valor Total da Inadimplência Revenda
                    </CardTitle>
                    {variacoes.valor !== null && (
                      <span
                        className={`ml-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${variacoes.valor > 0 ? 'bg-red-100 text-red-700' : variacoes.valor < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {variacoes.valor > 0 ? (
                          <ArrowUp size={14} weight="bold" />
                        ) : variacoes.valor < 0 ? (
                          <ArrowDown size={14} weight="bold" />
                        ) : null}
                        {variacoes.valor > 0 ? '+' : ''}
                        {variacoes.valor.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Acompanhe se o valor total está subindo ou caindo ao longo
                    dos dias{' '}
                    {variacoes.primeiraData
                      ? `(ref. ${variacoes.primeiraData})`
                      : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div style={{ height: 350 }}>
                    {chartTimelineValor ? (
                      <Line
                        data={chartTimelineValor}
                        options={lineOptionsValor}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Sem dados de evolução ainda. Os snapshots são salvos
                        automaticamente.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico: Evolução da Quantidade de Clientes */}
              <Card className="shadow-lg rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-blue-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Evolução da Quantidade de Clientes Inadimplentes
                    </CardTitle>
                    {variacoes.clientes !== null && (
                      <span
                        className={`ml-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${variacoes.clientes > 0 ? 'bg-red-100 text-red-700' : variacoes.clientes < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {variacoes.clientes > 0 ? (
                          <ArrowUp size={14} weight="bold" />
                        ) : variacoes.clientes < 0 ? (
                          <ArrowDown size={14} weight="bold" />
                        ) : null}
                        {variacoes.clientes > 0 ? '+' : ''}
                        {variacoes.clientes.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Acompanhe se a quantidade de clientes está subindo ou caindo{' '}
                    {variacoes.primeiraData
                      ? `(ref. ${variacoes.primeiraData})`
                      : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div style={{ height: 350 }}>
                    {chartTimelineClientes ? (
                      <Line
                        data={chartTimelineClientes}
                        options={lineOptionsClientes}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Sem dados de evolução ainda.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico: Evolução por Representante - Valor */}
              <Card className="shadow-lg rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendUp size={18} className="text-purple-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Evolução da Inadimplência por Representante (Valor)
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Valor inadimplente de cada representante ao longo do tempo
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div style={{ height: 400 }}>
                    {chartTimelineRepresentantes ? (
                      <Line
                        data={chartTimelineRepresentantes}
                        options={lineOptionsRepresentantes}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Sem dados de evolução por representante ainda.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico: Evolução Vencidos vs Inadimplentes */}
              <Card className="shadow-lg rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Warning size={18} className="text-yellow-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Evolução Vencidos vs Inadimplentes
                    </CardTitle>
                    <div className="ml-auto flex items-center gap-2">
                      {variacoes.atrasados !== null && (
                        <span
                          className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${variacoes.atrasados > 0 ? 'bg-orange-100 text-orange-700' : variacoes.atrasados < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {variacoes.atrasados > 0 ? (
                            <ArrowUp size={14} weight="bold" />
                          ) : variacoes.atrasados < 0 ? (
                            <ArrowDown size={14} weight="bold" />
                          ) : null}
                          Venc. {variacoes.atrasados > 0 ? '+' : ''}
                          {variacoes.atrasados.toFixed(1)}%
                        </span>
                      )}
                      {variacoes.inadimplentes !== null && (
                        <span
                          className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${variacoes.inadimplentes > 0 ? 'bg-red-100 text-red-700' : variacoes.inadimplentes < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {variacoes.inadimplentes > 0 ? (
                            <ArrowUp size={14} weight="bold" />
                          ) : variacoes.inadimplentes < 0 ? (
                            <ArrowDown size={14} weight="bold" />
                          ) : null}
                          Inad. {variacoes.inadimplentes > 0 ? '+' : ''}
                          {variacoes.inadimplentes.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Vencidos (≤ 60 dias) vs Inadimplentes ({'>'} 60 dias) —
                    acompanhe a gravidade da carteira{' '}
                    {variacoes.primeiraData
                      ? `(ref. ${variacoes.primeiraData})`
                      : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div style={{ height: 350 }}>
                    {chartTimelineAtrasadosInadimplentes ? (
                      <Line
                        data={chartTimelineAtrasadosInadimplentes}
                        options={lineOptionsAtrasadosInadimplentes}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Sem dados de evolução atrasados/inadimplentes ainda. Os
                        dados começarão a ser coletados a partir de hoje.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico: Evolução por Representante - Quantidade de Clientes */}
              <Card className="shadow-lg rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-green-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Evolução Clientes por Representante
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Quantidade de clientes inadimplentes de cada representante
                    ao longo do tempo
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div style={{ height: 400 }}>
                    {chartTimelineRepClientes ? (
                      <Line
                        data={chartTimelineRepClientes}
                        options={lineOptionsRepClientes}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Sem dados de evolução por representante ainda.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ======================== VIEW: LISTA (conteúdo original) ======================== */}
      {viewMode === 'lista' && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-700">
                    Total de Clientes
                  </CardTitle>
                  {variacoes.clientes !== null && (
                    <span
                      className={`ml-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${variacoes.clientes > 0 ? 'bg-red-100 text-red-700' : variacoes.clientes < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {variacoes.clientes > 0 ? (
                        <ArrowUp size={14} weight="bold" />
                      ) : variacoes.clientes < 0 ? (
                        <ArrowDown size={14} weight="bold" />
                      ) : null}
                      {variacoes.clientes > 0 ? '+' : ''}
                      {variacoes.clientes.toFixed(1)}%
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-base font-extrabold text-blue-600 mb-0.5">
                  {metricas.totalClientes}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Clientes inadimplentes{' '}
                  {variacoes.primeiraData
                    ? `(ref. ${variacoes.primeiraData})`
                    : ''}
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
                  {variacoes.valor !== null && (
                    <span
                      className={`ml-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${variacoes.valor > 0 ? 'bg-red-100 text-red-700' : variacoes.valor < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {variacoes.valor > 0 ? (
                        <ArrowUp size={14} weight="bold" />
                      ) : variacoes.valor < 0 ? (
                        <ArrowDown size={14} weight="bold" />
                      ) : null}
                      {variacoes.valor > 0 ? '+' : ''}
                      {variacoes.valor.toFixed(1)}%
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-base font-extrabold text-green-600 mb-0.5">
                  {formatarMoeda(metricas.valorTotal)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Valor em aberto{' '}
                  {variacoes.primeiraData
                    ? `(ref. ${variacoes.primeiraData})`
                    : ''}
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
                      Vencidos
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
                    Até 60 dias de atraso
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
                    Acima de 60 dias de atraso
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>


          {/* Resumo por Representante */}
          {resumoPorRepresentante.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[#000638] mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-[#000638] rounded"></span>
                Dívida por Representante
              </h3>
              <Card className="shadow-lg rounded-xl bg-white">
                <CardContent className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="px-4 py-3 text-left font-bold text-[#000638]">
                            Representante
                          </th>
                          <th className="px-4 py-3 text-center font-bold text-[#000638]">
                            Clientes
                          </th>
                          <th className="px-4 py-3 text-right font-bold text-red-700">
                            Valor Vencido
                          </th>
                          <th className="px-4 py-3 text-right font-bold text-yellow-700">
                            Valor a Vencer
                          </th>
                          <th className="px-4 py-3 text-right font-bold text-[#000638]">
                            Total Geral
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumoPorRepresentante.map((item) => (
                          <tr
                            key={item.representante}
                            className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => {
                              if (item.representante !== 'SEM REPRESENTANTE') {
                                setFiltroRepresentantes([item.representante]);
                              }
                            }}
                          >
                            <td className="px-4 py-3 font-semibold text-[#000638]">
                              <div className="flex items-center gap-2">
                                <Users size={14} className="text-indigo-500" />
                                {item.representante}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-blue-600">
                              {item.qtdClientes}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-red-600">
                              {formatarMoeda(item.valorTotal)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-yellow-600">
                              {formatarMoeda(item.valorAVencer)}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-[#000638]">
                              {formatarMoeda(
                                item.valorTotal + item.valorAVencer,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-400 bg-gray-50">
                          <td className="px-4 py-3 font-extrabold text-[#000638]">
                            TOTAL
                          </td>
                          <td className="px-4 py-3 text-center font-extrabold text-blue-700">
                            {resumoPorRepresentante.reduce(
                              (s, i) => s + i.qtdClientes,
                              0,
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-red-700">
                            {formatarMoeda(
                              resumoPorRepresentante.reduce(
                                (s, i) => s + i.valorTotal,
                                0,
                              ),
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-yellow-700">
                            {formatarMoeda(
                              resumoPorRepresentante.reduce(
                                (s, i) => s + i.valorAVencer,
                                0,
                              ),
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-[#000638]">
                            {formatarMoeda(
                              resumoPorRepresentante.reduce(
                                (s, i) => s + i.valorTotal + i.valorAVencer,
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 italic">
                    💡 Clique em um representante para filtrar a tabela
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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
                <div className="flex items-center gap-2">
                  {clientesSelecionados.size > 0 && (
                    <button
                      onClick={inativarSelecionados}
                      disabled={inativandoMassa}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-60"
                      title="Inativar no TOTVS todos os clientes selecionados"
                    >
                      {inativandoMassa ? (
                        <>
                          <Spinner size={14} className="animate-spin" />
                          Inativando {progressoInativacao}...
                        </>
                      ) : (
                        <>
                          <X size={14} weight="bold" />
                          Inativar Selecionados ({clientesSelecionados.size})
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={baixarExcel}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
                    title="Baixar a tabela em Excel"
                  >
                    <FileXls size={16} weight="bold" />
                    Baixar Excel
                  </button>
                  <button
                    onClick={() => abrirModalHistorico(null)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#000638] text-white text-xs font-medium rounded hover:bg-[#fe0000] transition-colors"
                    title="Ver histórico completo de alterações"
                  >
                    <ClockClockwise size={16} weight="bold" />
                    Log
                  </button>
                </div>
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
                        <th className="px-3 py-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              clientesAgrupados.length > 0 &&
                              clientesAgrupados.every((c) =>
                                clientesSelecionados.has(String(c.cd_cliente)),
                              )
                            }
                            onChange={toggleSelecionarTodos}
                            className="w-4 h-4 accent-[#000638] cursor-pointer"
                            title="Selecionar todos"
                          />
                        </th>
                        <th
                          className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => ordenarColuna('cd_cliente')}
                          title="Clique para ordenar"
                        >
                          <div className="flex items-center gap-1">
                            Código Cliente
                            {ordenarPor === 'cd_cliente' && (
                              <span>
                                {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                              </span>
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
                              <span>
                                {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => ordenarColuna('nr_cpfcnpj')}
                          title="Clique para ordenar"
                        >
                          <div className="flex items-center gap-1">
                            CPF/CNPJ
                            {ordenarPor === 'nr_cpfcnpj' && (
                              <span>
                                {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => ordenarColuna('ds_uf')}
                          title="Clique para ordenar"
                        >
                          <div className="flex items-center gap-1">
                            Estado
                            {ordenarPor === 'ds_uf' && (
                              <span>
                                {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => ordenarColuna('valor_total')}
                          title="Clique para ordenar"
                        >
                          <div className="flex items-center gap-1">
                            Valor Vencido
                            {ordenarPor === 'valor_total' && (
                              <span>
                                {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => ordenarColuna('valor_a_vencer')}
                          title="Clique para ordenar"
                        >
                          <div className="flex items-center gap-1">
                            A Vencer
                            {ordenarPor === 'valor_a_vencer' && (
                              <span>
                                {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                              </span>
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
                              <span>
                                {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                              </span>
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
                              <span>
                                {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3">Protesto</th>
                        <th className="px-4 py-3">Contato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesAgrupados.length === 0 ? (
                        <tr>
                          <td
                            colSpan={11}
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
                            <td
                              className="px-3 py-3 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={clientesSelecionados.has(
                                  String(cliente.cd_cliente),
                                )}
                                onChange={() =>
                                  toggleSelecionado(cliente.cd_cliente)
                                }
                                className="w-4 h-4 accent-[#000638] cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {cliente.cd_cliente || 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {cliente.nm_cliente || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {formatarCpfCnpj(cliente.nr_cpfcnpj) || 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                                {cliente.ds_uf?.trim() || 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-red-600">
                              {formatarMoeda(cliente.valor_total)}
                            </td>
                            <td className="px-4 py-3 font-medium text-orange-600">
                              {formatarMoeda(cliente.valor_a_vencer)}
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
                            {/* Coluna Protesto: só aparece para quem tem
                                título na Esteira de Protesto */}
                            <td
                              className="px-4 py-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(protestosPorCliente[
                                String(cliente.cd_cliente)
                              ]?.length || 0) > 0 ? (
                                <button
                                  onClick={(e) =>
                                    abrirModalProtestos(cliente, e)
                                  }
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold w-7 h-7 rounded-full transition-colors"
                                  title={`${protestosPorCliente[String(cliente.cd_cliente)].length} título(s) em protesto — clique para ver`}
                                >
                                  P
                                </button>
                              ) : (
                                <span className="text-xs text-gray-300">
                                  --
                                </span>
                              )}
                            </td>
                            {/* Coluna Contato */}
                            <td
                              className="px-4 py-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => abrirWhatsApp(cliente, e)}
                                className="bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-1 rounded transition-colors flex items-center gap-1"
                                title="Abrir WhatsApp"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="w-4 h-4"
                                >
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
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
        </>
      )}

      {/* ======================== VIEW: CLIENTES INATIVOS ======================== */}
      {viewMode === 'inativos' && (
        <div className="space-y-4">
          {/* Barra de busca + refresh */}
          <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-wrap items-center gap-2">
            <MagnifyingGlass size={15} weight="bold" className="text-[#000638]" />
            <input
              type="text"
              value={buscaInativos}
              onChange={(e) => setBuscaInativos(e.target.value)}
              placeholder="Buscar cliente por nome, código ou CNPJ..."
              className="flex-1 min-w-[220px] border border-[#000638]/20 rounded-lg px-3 py-1.5 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
            />
            {buscaInativos && (
              <button
                type="button"
                onClick={() => setBuscaInativos('')}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={() => carregarStatusRevenda(true)}
              disabled={inativosLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#000638] text-white text-xs font-medium rounded hover:opacity-90 transition disabled:opacity-60"
              title="Atualizar status direto do TOTVS"
            >
              <ArrowClockwise size={13} weight="bold" />
              Atualizar
            </button>
          </div>

          {/* Seletor de situação + resumo por grupo */}
          {inativosCarregados && !inativosLoading && (
            <>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    key: 'inativos',
                    label: 'Inativos',
                    qtd: clientesInativosView.contagem.inativos,
                    ativo: 'bg-gray-700 text-white border-gray-700',
                  },
                  {
                    key: 'bloqueados',
                    label: 'Bloqueados',
                    qtd: clientesInativosView.contagem.bloqueados,
                    ativo: 'bg-red-600 text-white border-red-600',
                  },
                  {
                    key: 'ativos',
                    label: 'Ativos',
                    qtd: clientesInativosView.contagem.ativos,
                    ativo: 'bg-green-600 text-white border-green-600',
                  },
                ].map((op) => (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => setFiltroStatus(op.key)}
                    className={`rounded-lg border shadow-sm px-4 py-2 min-w-[140px] text-left transition ${
                      filtroStatus === op.key
                        ? op.ativo
                        : 'bg-white border-gray-200 text-[#000638] hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-[9px] uppercase tracking-wide opacity-70">
                      {op.label} no TOTVS
                    </p>
                    <p className="text-sm font-bold">{op.qtd}</p>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="bg-orange-50 rounded-lg border border-orange-300 shadow-sm px-4 py-2 min-w-[150px]">
                  <p className="text-[9px] text-orange-700 uppercase tracking-wide">
                    Com faturas a vencer
                  </p>
                  <p className="text-sm font-bold text-orange-700">
                    {clientesInativosView.comAVencer.length}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg border border-red-300 shadow-sm px-4 py-2 min-w-[150px]">
                  <p className="text-[9px] text-red-700 uppercase tracking-wide">
                    Com faturas vencidas
                  </p>
                  <p className="text-sm font-bold text-red-700">
                    {clientesInativosView.comVencidas.length}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg border border-green-300 shadow-sm px-4 py-2 min-w-[150px]">
                  <p className="text-[9px] text-green-700 uppercase tracking-wide">
                    Sem nenhuma fatura
                  </p>
                  <p className="text-sm font-bold text-green-700">
                    {clientesInativosView.semFaturas.length}
                  </p>
                </div>
              </div>
            </>
          )}

          {inativosErro && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
              <Warning size={16} weight="bold" />
              {inativosErro}
            </div>
          )}

          {inativosLoading && (
            <div className="flex items-center justify-center py-12">
              <CircleNotch size={32} className="animate-spin text-[#000638]" />
              <span className="ml-2 text-sm text-gray-500">
                Carregando clientes revenda...
              </span>
            </div>
          )}

          {!inativosLoading &&
            inativosCarregados &&
            [
              {
                key: 'comAVencer',
                titulo: `${LABEL_STATUS[filtroStatus]} com faturas a vencer`,
                headerBg: 'bg-orange-500',
                lista: clientesInativosView.comAVencer,
              },
              {
                key: 'comVencidas',
                titulo: `${LABEL_STATUS[filtroStatus]} com faturas vencidas`,
                headerBg: 'bg-red-600',
                lista: clientesInativosView.comVencidas,
              },
              {
                key: 'semFaturas',
                titulo: `${LABEL_STATUS[filtroStatus]} sem nenhuma fatura vencida ou a vencer`,
                headerBg: 'bg-green-600',
                lista: clientesInativosView.semFaturas,
              },
            ].map((secao) => {
              return (
                <Card
                  key={secao.key}
                  className="shadow-lg rounded-xl bg-white overflow-hidden"
                >
                  <div
                    className={`${secao.headerBg} text-white px-4 py-2.5 flex items-center justify-between`}
                  >
                    <span className="font-bold text-xs uppercase tracking-wide">
                      {secao.titulo}
                    </span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                      {secao.lista.length} cliente(s)
                    </span>
                  </div>
                  <CardContent className="p-0">
                    {secao.lista.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-gray-400">
                        Nenhum cliente nesta situação.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                              <th className="px-4 py-2.5">Código</th>
                              <th className="px-4 py-2.5">Nome</th>
                              <th className="px-4 py-2.5">CNPJ</th>
                              <th className="px-4 py-2.5">Status</th>
                              <th className="px-4 py-2.5 text-right">
                                Valor Vencido
                              </th>
                              <th className="px-4 py-2.5 text-right">
                                A Vencer
                              </th>
                              <th className="px-4 py-2.5 text-center">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {secao.lista.map((cliente) => (
                              <tr
                                key={cliente.code}
                                className="bg-white border-b hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-4 py-2.5 font-medium text-gray-900">
                                  {cliente.code}
                                </td>
                                <td className="px-4 py-2.5 text-gray-900">
                                  {cliente.name || 'N/A'}
                                  {cliente.fantasyName && (
                                    <span className="block text-[10px] text-gray-400">
                                      {cliente.fantasyName}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                                  {formatarCpfCnpj(cliente.cpfCnpj || cliente.cnpj) || 'N/A'}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`text-xs font-semibold px-2 py-1 rounded ${
                                      estaInativo(cliente)
                                        ? 'bg-gray-200 text-gray-700'
                                        : estaBloqueado(cliente)
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-green-100 text-green-800'
                                    }`}
                                  >
                                    {cliente.customerStatus || '—'}
                                  </span>
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right font-medium ${
                                    cliente.valorVencido > 0
                                      ? 'text-red-600'
                                      : 'text-gray-400'
                                  }`}
                                >
                                  {formatarMoeda(cliente.valorVencido)}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right font-medium ${
                                    cliente.valorAVencer > 0
                                      ? 'text-orange-600'
                                      : 'text-gray-400'
                                  }`}
                                >
                                  {formatarMoeda(cliente.valorAVencer)}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <button
                                    onClick={() =>
                                      alternarInativo(
                                        cliente,
                                        !estaInativo(cliente),
                                      )
                                    }
                                    disabled={togglandoCliente === cliente.code}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-white text-xs font-semibold rounded transition-colors disabled:opacity-60 ${
                                      estaInativo(cliente)
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                  >
                                    {togglandoCliente === cliente.code ? (
                                      <Spinner
                                        size={12}
                                        className="animate-spin"
                                      />
                                    ) : estaInativo(cliente) ? (
                                      <CheckCircle size={12} weight="bold" />
                                    ) : (
                                      <X size={12} weight="bold" />
                                    )}
                                    {estaInativo(cliente)
                                      ? 'Ativar'
                                      : 'Inativar'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

          {!inativosLoading && inativosCarregados && (
            <p className="text-xs text-gray-400 italic">
              💡 A situação vem do cadastro do cliente no TOTVS. Os valores
              vencidos e a vencer usam as faturas carregadas na aba Lista. A
              ação Ativar/Inativar grava direto no cadastro (campo
              Ativo/Inativo); o desbloqueio de cliente PJ não é oferecido pela
              API e continua manual no ERP.
            </p>
          )}
        </div>
      )}

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
                            {cliente.ds_uf?.trim() || 'N/A'}
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

      {/* Modal de Títulos em Protesto do cliente */}
      {modalProtestosAberto && clienteProtestos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Gavel size={22} className="text-green-600" weight="bold" />
                <div>
                  <h3 className="text-lg font-bold text-[#000638]">
                    Títulos em Protesto
                  </h3>
                  <p className="text-xs text-gray-500">
                    {clienteProtestos.nm_cliente} · Cód.{' '}
                    {clienteProtestos.cd_cliente}
                  </p>
                </div>
              </div>
              <button
                onClick={fecharModalProtestos}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-white uppercase bg-green-600">
                    <tr>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Fatura</th>
                      <th className="px-4 py-3">Emissão</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Atraso</th>
                      <th className="px-4 py-3">Valor</th>
                      <th className="px-4 py-3">Portador</th>
                      <th className="px-4 py-3">Enviado por</th>
                      <th className="px-4 py-3">Enviado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      protestosPorCliente[
                        String(clienteProtestos.cd_cliente)
                      ] || []
                    ).map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">{p.cd_empresa}</td>
                        <td className="px-4 py-3 font-semibold text-[#000638]">
                          {p.nr_fat}/{p.nr_parcela}
                        </td>
                        <td className="px-4 py-3">
                          {formatarData(p.dt_emissao)}
                        </td>
                        <td className="px-4 py-3">
                          {formatarData(p.dt_vencimento)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded">
                            {diasAtrasoFatura(p.dt_vencimento)} dias
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {formatarMoeda(parseFloat(p.vl_fatura) || 0)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">
                            {p.nm_portador || p.cd_portador || '--'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {p.user_nome || p.user_email || '--'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {p.created_at
                            ? new Date(p.created_at).toLocaleDateString('pt-BR')
                            : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rodapé */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <span className="text-sm font-bold text-[#000638]">
                Total:{' '}
                {formatarMoeda(
                  (
                    protestosPorCliente[String(clienteProtestos.cd_cliente)] ||
                    []
                  ).reduce((a, p) => a + (parseFloat(p.vl_fatura) || 0), 0),
                )}
              </span>
              <button
                onClick={fecharModalProtestos}
                className="px-4 py-2 bg-[#000638] text-white rounded hover:bg-[#fe0000] transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Observações — sem gatilho na tela desde que o botão OBS
          foi trocado pelo "P" de protesto. Mantido para reaproveitamento. */}
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {new Date(obs.data_criacao).toLocaleString(
                              'pt-BR',
                              {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </span>
                          {podeExcluirObservacao(obs) && (
                            <button
                              onClick={() => excluirObservacao(obs.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Excluir observação (disponível por 2 minutos)"
                            >
                              <Trash size={16} weight="bold" />
                            </button>
                          )}
                        </div>
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
              <div className="flex flex-col justbetween mb-4">
                <textarea
                  value={novaObservacao}
                  onChange={(e) => setNovaObservacao(e.target.value)}
                  placeholder="Digite sua observação..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638] resize-none"
                  rows={3}
                />
                <div>
                  <button
                    onClick={adicionarObservacao}
                    disabled={!novaObservacao.trim() || loadingObservacoes}
                    className="bg-[#000638] hover:bg-[#fe0000] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end mt-2"
                  >
                    Enviar
                  </button>
                </div>
              </div>
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
          <div className="bg-white rounded-lg p-6 max-w-6xl max-h-[90vh] overflow-y-auto w-full mx-4">
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

            {/* Tabela de Faturas Vencidas */}
            <div className="mb-6">
              <h4 className="text-md font-semibold text-red-700 mb-3 flex items-center gap-2">
                <Warning size={20} weight="bold" className="text-red-600" />
                Faturas Vencidas ({faturasSelecionadas.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-white uppercase bg-red-600">
                    <tr>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Nº Fatura</th>
                      <th className="px-4 py-3">Emissão</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Valor Fatura</th>
                      <th className="px-4 py-3">Juros</th>
                      <th className="px-4 py-3">Parcela</th>
                      <th className="px-4 py-3">Cobrança</th>
                      <th className="px-4 py-3">Portador</th>
                      <th className="px-4 py-3">Tempo Inadimplência</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faturasSelecionadas.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-4 text-center text-gray-500"
                        >
                          Nenhuma fatura vencida encontrada
                        </td>
                      </tr>
                    ) : (
                      faturasSelecionadas.map((fatura, index) => (
                        <tr
                          key={index}
                          className="bg-red-50 border-b border-red-100"
                        >
                          <td className="px-4 py-3">
                            {fatura.cd_empresa || 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {fatura.nr_fat || fatura.nr_fatura || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            {formatarData(fatura.dt_emissao)}
                          </td>
                          <td className="px-4 py-3">
                            {formatarData(fatura.dt_vencimento)}
                          </td>
                          <td className="px-4 py-3 font-medium text-red-600">
                            {formatarMoeda(fatura.vl_fatura)}
                          </td>
                          <td className="px-4 py-3 font-medium text-red-600">
                            {formatarMoeda(fatura.vl_juros)}
                          </td>
                          <td className="px-4 py-3">
                            {fatura.nr_parcela || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {(() => {
                              const tc = getTipoCobranca(fatura.tp_cobranca);
                              return (
                                <span
                                  className={`${tc.color} px-1.5 py-0.5 rounded font-medium`}
                                >
                                  {tc.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">
                              {fatura.nm_portador || fatura.cd_portador || '--'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded">
                              {calcularTempoInadimplencia(fatura.dt_vencimento)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalBaixa(fatura);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-[#000638] hover:bg-[#fe0000] rounded-lg transition-colors"
                                title="Enviar para solicitação de baixa"
                              >
                                <PaperPlaneRight size={12} weight="bold" />
                                Baixa
                              </button>
                              {(() => {
                                const eleg = elegibilidadeProtesto(fatura);
                                const enviando =
                                  enviandoProtesto === chaveFatura(fatura);

                                if (eleg.protestado) {
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-green-800 bg-green-100 border border-green-300 rounded-lg cursor-default"
                                      title="Título já enviado para a Esteira de Protesto"
                                    >
                                      <CheckCircle size={12} weight="bold" />
                                      PROTESTADO
                                    </span>
                                  );
                                }

                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      enviarParaProtesto(fatura);
                                    }}
                                    disabled={enviando || !eleg.ok}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg transition-colors"
                                    title={
                                      eleg.ok
                                        ? 'Enviar para a Esteira de Protesto'
                                        : eleg.motivo
                                    }
                                  >
                                    {enviando ? (
                                      <CircleNotch
                                        size={12}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Gavel size={12} weight="bold" />
                                    )}
                                    Protestar
                                  </button>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabela de Faturas a Vencer */}
            <div className="mb-4">
              <h4 className="text-md font-semibold text-orange-700 mb-3 flex items-center gap-2">
                <Clock size={20} weight="bold" className="text-orange-600" />
                Faturas a Vencer (
                {loadingFaturasModal ? '...' : faturasAVencer.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-white uppercase bg-orange-500">
                    <tr>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Nº Fatura</th>
                      <th className="px-4 py-3">Emissão</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Valor Fatura</th>
                      <th className="px-4 py-3">Parcela</th>
                      <th className="px-4 py-3">Cobrança</th>
                      <th className="px-4 py-3">Portador</th>
                      <th className="px-4 py-3">Dias para Vencer</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingFaturasModal ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-4 text-center text-gray-500"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <CircleNotch
                              size={18}
                              className="animate-spin text-orange-500"
                            />
                            Carregando faturas a vencer...
                          </div>
                        </td>
                      </tr>
                    ) : faturasAVencer.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-4 text-center text-gray-500"
                        >
                          Nenhuma fatura a vencer encontrada
                        </td>
                      </tr>
                    ) : (
                      faturasAVencer.map((fatura, index) => {
                        const hoje = new Date();
                        hoje.setHours(0, 0, 0, 0);
                        const [datePart] = String(fatura.dt_vencimento).split(
                          'T',
                        );
                        const [y, m, d] = datePart
                          .split('-')
                          .map((n) => parseInt(n, 10));
                        const venc = new Date(y, m - 1, d);
                        venc.setHours(0, 0, 0, 0);
                        const diasParaVencer = Math.ceil(
                          (venc - hoje) / (1000 * 60 * 60 * 24),
                        );
                        return (
                          <tr
                            key={index}
                            className="bg-orange-50 border-b border-orange-100"
                          >
                            <td className="px-4 py-3">
                              {fatura.cd_empresa || 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {fatura.nr_fat || fatura.nr_fatura || 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              {formatarData(fatura.dt_emissao)}
                            </td>
                            <td className="px-4 py-3">
                              {formatarData(fatura.dt_vencimento)}
                            </td>
                            <td className="px-4 py-3 font-medium text-orange-600">
                              {formatarMoeda(fatura.vl_fatura)}
                            </td>
                            <td className="px-4 py-3">
                              {fatura.nr_parcela || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {(() => {
                                const tc = getTipoCobranca(fatura.tp_cobranca);
                                return (
                                  <span
                                    className={`${tc.color} px-1.5 py-0.5 rounded font-medium`}
                                  >
                                    {tc.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">
                                {fatura.nm_portador ||
                                  fatura.cd_portador ||
                                  '--'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded ${
                                  diasParaVencer <= 7
                                    ? 'bg-red-100 text-red-800'
                                    : diasParaVencer <= 30
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {diasParaVencer}{' '}
                                {diasParaVencer === 1 ? 'dia' : 'dias'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {/* Sem "Protestar" aqui: título a vencer nunca
                                  atende a regra de +29 dias de atraso */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalBaixa(fatura);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-[#000638] hover:bg-[#fe0000] rounded-lg transition-colors"
                                title="Enviar para solicitação de baixa"
                              >
                                <PaperPlaneRight size={12} weight="bold" />
                                Baixa
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
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

      {/* Modal de Solicitação de Baixa */}
      {modalBaixaAberto && faturaBaixa && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PaperPlaneRight size={20} weight="bold" />
                Solicitação de Baixa
              </h3>
              <button
                onClick={fecharModalBaixa}
                className="text-white hover:text-red-300 transition-colors"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Dados da fatura */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-semibold">
                    {clienteSelecionado?.nm_cliente ||
                      faturaBaixa.nm_cliente ||
                      'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fatura:</span>
                  <span className="font-semibold">
                    {faturaBaixa.nr_fat || faturaBaixa.nr_fatura}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Parcela:</span>
                  <span className="font-semibold">
                    {faturaBaixa.nr_parcela || 1}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor:</span>
                  <span className="font-bold text-red-600">
                    {formatarMoeda(faturaBaixa.vl_fatura)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vencimento:</span>
                  <span className="font-semibold">
                    {formatarData(faturaBaixa.dt_vencimento)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Portador:</span>
                  <span className="font-semibold">
                    <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">
                      {faturaBaixa.nm_portador ||
                        faturaBaixa.cd_portador ||
                        '--'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Data de Pagamento */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Data de Pagamento *
                </label>
                <input
                  type="date"
                  value={dataPagamentoBaixa}
                  onChange={(e) => setDataPagamentoBaixa(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#000638] focus:border-transparent"
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Data que consta no comprovante de pagamento
                </p>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Forma de Pagamento *
                </label>
                <select
                  value={formaPagamentoBaixa}
                  onChange={(e) => {
                    setFormaPagamentoBaixa(e.target.value);
                    setDadosCartaoBaixa({
                      bandeira: '',
                      autorizacao: '',
                      nsu: '',
                    });
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#000638] focus:border-transparent"
                  required
                >
                  <option value="">Selecione...</option>
                  {FORMAS_PAGAMENTO.map((fp) => (
                    <option key={fp.id} value={fp.id}>
                      {fp.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dados do cartão (se cartão de crédito ou débito) */}
              {(formaPagamentoBaixa === 'cartao_credito' ||
                formaPagamentoBaixa === 'cartao_debito') && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-bold text-yellow-800">
                    Dados do Cartão
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                      Bandeira *
                    </label>
                    <input
                      type="text"
                      value={dadosCartaoBaixa.bandeira}
                      onChange={(e) =>
                        setDadosCartaoBaixa((prev) => ({
                          ...prev,
                          bandeira: e.target.value,
                        }))
                      }
                      placeholder="Ex: Visa, Mastercard, Elo..."
                      className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                        Nº Autorização *
                      </label>
                      <input
                        type="text"
                        value={dadosCartaoBaixa.autorizacao}
                        onChange={(e) =>
                          setDadosCartaoBaixa((prev) => ({
                            ...prev,
                            autorizacao: e.target.value,
                          }))
                        }
                        placeholder="Nº autorização"
                        className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                        NSU *
                      </label>
                      <input
                        type="text"
                        value={dadosCartaoBaixa.nsu}
                        onChange={(e) =>
                          setDadosCartaoBaixa((prev) => ({
                            ...prev,
                            nsu: e.target.value,
                          }))
                        }
                        placeholder="NSU"
                        className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#000638]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Upload do comprovante */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Comprovante de Pagamento *
                </label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#000638] transition-colors"
                  onClick={() =>
                    document.getElementById('comprovante-input').click()
                  }
                >
                  {previewComprovante ? (
                    <div className="space-y-2">
                      {comprovanteBaixa?.type?.startsWith('image/') ? (
                        <img
                          src={previewComprovante}
                          alt="Preview"
                          className="max-h-40 mx-auto rounded-lg"
                        />
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-[#000638]">
                          <FileText size={32} />
                          <span className="font-medium">
                            {comprovanteBaixa?.name}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        Clique para trocar o arquivo
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-gray-400">
                      <UploadSimple size={32} className="mx-auto" />
                      <p className="text-sm">
                        Clique para anexar o comprovante
                      </p>
                      <p className="text-xs">Imagens (JPG, PNG) ou PDF</p>
                    </div>
                  )}
                </div>
                <input
                  id="comprovante-input"
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleComprovanteChange}
                />
              </div>

              {/* Observação */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Observação (opcional)
                </label>
                <textarea
                  value={observacaoBaixa}
                  onChange={(e) => setObservacaoBaixa(e.target.value)}
                  placeholder="Ex: Pagamento via PIX em 20/02..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#000638] focus:border-transparent"
                  rows={3}
                />
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={fecharModalBaixa}
                  className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEnviarBaixa}
                  disabled={
                    loadingBaixa ||
                    !comprovanteBaixa ||
                    !dataPagamentoBaixa ||
                    !formaPagamentoBaixa ||
                    ((formaPagamentoBaixa === 'cartao_credito' ||
                      formaPagamentoBaixa === 'cartao_debito') &&
                      (!dadosCartaoBaixa.bandeira ||
                        !dadosCartaoBaixa.autorizacao ||
                        !dadosCartaoBaixa.nsu))
                  }
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#000638] rounded-lg hover:bg-[#fe0000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingBaixa ? (
                    <>
                      <Spinner size={16} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <PaperPlaneRight size={16} weight="bold" />
                      Enviar Solicitação
                    </>
                  )}
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

export default InadimplentesRevenda;
