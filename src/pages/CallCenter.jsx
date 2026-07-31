import React, { useState, useEffect, useMemo, useCallback } from 'react';
import FiltroClientes from '../components/filters/FiltroClientes';
import { useAuth } from '../components/AuthContext';
import useCallCenter from '../hooks/useCallCenter';
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
  Headset,
  PhoneCall,
  Phone,
  PhoneSlash,
  CalendarBlank,
  CircleNotch,
  Users,
  CurrencyDollar,
  Receipt,
  Warning,
  ClockClockwise,
  CheckCircle,
  Copy,
  PencilSimple,
  Trash,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';

// Resultados possíveis de uma ligação (o "status" do contato)
const STATUS_LIGACAO = [
  { id: 'ATENDEU', label: 'Atendeu', cor: 'bg-blue-100 text-blue-800' },
  {
    id: 'NAO_ATENDEU',
    label: 'Não atendeu',
    cor: 'bg-gray-100 text-gray-700',
  },
  {
    id: 'CAIXA_POSTAL',
    label: 'Caixa postal',
    cor: 'bg-gray-100 text-gray-700',
  },
  {
    id: 'NUMERO_INVALIDO',
    label: 'Número inválido',
    cor: 'bg-orange-100 text-orange-800',
  },
  { id: 'RECADO', label: 'Recado deixado', cor: 'bg-indigo-100 text-indigo-800' },
  {
    id: 'PROMESSA',
    label: 'Promessa de pagamento',
    cor: 'bg-yellow-100 text-yellow-800',
  },
  { id: 'NEGOCIADO', label: 'Negociado', cor: 'bg-purple-100 text-purple-800' },
  { id: 'PAGO', label: 'Pagamento confirmado', cor: 'bg-green-100 text-green-800' },
];

const statusInfo = (id) =>
  STATUS_LIGACAO.find((s) => s.id === id) || {
    id,
    label: id || '---',
    cor: 'bg-gray-100 text-gray-700',
  };

const CallCenter = () => {
  const { user } = useAuth();
  const {
    buscarContatos,
    salvarContato,
    registrarLigacao,
    buscarLigacoes,
    deletarLigacao,
  } = useCallCenter();

  const hojeStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Filtros de consulta (mesma base da Inadimplência MTM)
  const [filtroDataInicial, setFiltroDataInicial] = useState('2024-04-01');
  const [filtroDataFinal, setFiltroDataFinal] = useState(hojeStr);
  const [filtroClientes, setFiltroClientes] = useState([]);

  // Filtros da fila de ligações
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('TODAS');
  const [filtroFila, setFiltroFila] = useState('TODOS');

  // Valores a vencer por cliente
  const [valoresAVencer, setValoresAVencer] = useState({});

  // Dados de call center vindos do Supabase
  const [contatos, setContatos] = useState({}); // { cd_cliente: { telefone, ultima_ligacao, ... } }
  const [loadingContatos, setLoadingContatos] = useState(false);

  // Ordenação
  const [ordenarPor, setOrdenarPor] = useState('valor_total');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState('desc');

  // Edição inline do telefone
  const [editandoTelefone, setEditandoTelefone] = useState(null);
  const [tempTelefone, setTempTelefone] = useState('');

  // Modal de registro de ligação
  const [modalLigacaoAberto, setModalLigacaoAberto] = useState(false);
  const [clienteLigacao, setClienteLigacao] = useState(null);
  const [formLigacao, setFormLigacao] = useState({
    data_ligacao: hojeStr,
    status_ligacao: '',
    proximo_contato: '',
    observacao: '',
  });
  const [salvandoLigacao, setSalvandoLigacao] = useState(false);

  // Modal de histórico de ligações
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [clienteHistorico, setClienteHistorico] = useState(null);
  const [historicoLigacoes, setHistoricoLigacoes] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Modal de detalhes (títulos em aberto do cliente)
  const [modalTitulosAberto, setModalTitulosAberto] = useState(false);
  const [clienteTitulos, setClienteTitulos] = useState(null);

  const formatarMoeda = (valor) =>
    (parseFloat(valor) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  const formatarData = (isoDate) => {
    if (!isoDate) return '---';
    const [y, m, d] = String(isoDate).substring(0, 10).split('-');
    if (!y || !m || !d) return '---';
    return `${d}/${m}/${y}`;
  };

  // Máscara simples de telefone brasileiro para exibição
  const formatarTelefone = (telefone) => {
    const num = String(telefone || '').replace(/\D/g, '');
    if (!num) return '';
    if (num.length === 11)
      return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
    if (num.length === 10)
      return `(${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6)}`;
    return telefone;
  };

  // Número no formato aceito pelo discador do celular (tel:)
  const telefoneParaDiscagem = (telefone) => {
    const num = String(telefone || '').replace(/\D/g, '');
    if (!num) return '';
    // 10 dígitos = fixo com DDD, 11 = celular com DDD → prefixa o país
    if (num.length === 10 || num.length === 11) return `+55${num}`;
    if ((num.length === 12 || num.length === 13) && num.startsWith('55'))
      return `+${num}`;
    return num;
  };

  const notificar = (type, message, duracao = 3000) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), duracao);
  };

  const diffEmDias = (isoDate) => {
    if (!isoDate) return null;
    const [y, m, d] = String(isoDate).substring(0, 10).split('-').map(Number);
    const data = new Date(y, m - 1, d);
    data.setHours(0, 0, 0, 0);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.floor((hoje - data) / (1000 * 60 * 60 * 24));
  };

  // ============================================================
  // Carregar dados de call center (Supabase)
  // ============================================================
  const carregarContatos = useCallback(async () => {
    setLoadingContatos(true);
    const { success, data } = await buscarContatos();
    if (success) {
      const mapa = {};
      (data || []).forEach((c) => {
        mapa[String(c.cd_cliente)] = c;
      });
      setContatos(mapa);
    }
    setLoadingContatos(false);
  }, []);

  // ============================================================
  // Buscar clientes inadimplentes multimarcas (mesma origem da MTM)
  // ============================================================
  const fetchDados = async () => {
    try {
      setLoading(true);

      const dataIni = filtroDataInicial || '2024-01-01';
      const dataFim = filtroDataFinal || hojeStr;

      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      const amanhaStr = amanha.toISOString().split('T')[0];

      const umAnoFrente = new Date();
      umAnoFrente.setFullYear(umAnoFrente.getFullYear() + 1);
      const umAnoFrenteStr = umAnoFrente.toISOString().split('T')[0];

      // PASSO 1: códigos dos clientes MULTIMARCAS
      const respMultimarcas = await fetch(`${TotvsURL}multibrand-clients`);
      if (!respMultimarcas.ok) {
        const errData = await respMultimarcas.json().catch(() => ({}));
        throw new Error(
          errData.message ||
            `Erro ao buscar multimarcas: HTTP ${respMultimarcas.status}`,
        );
      }
      const resultMultimarcas = await respMultimarcas.json();
      const multimarcas = resultMultimarcas.data || [];

      if (multimarcas.length === 0) {
        setDados([]);
        setValoresAVencer({});
        return;
      }

      const multimarcasMap = {};
      multimarcas.forEach((m) => {
        multimarcasMap[String(m.code)] = m;
      });
      const codigosMultimarcas = multimarcas.map((m) => m.code).join(',');

      // PASSO 2: contas a receber (vencidas + a vencer)
      const paramsVencidas = new URLSearchParams({
        dt_inicio: dataIni,
        dt_fim: dataFim,
        modo: 'vencimento',
        situacao: '1',
        status: 'Vencido',
        cd_cliente: codigosMultimarcas,
      });

      const paramsAVencer = new URLSearchParams({
        dt_inicio: amanhaStr,
        dt_fim: umAnoFrenteStr,
        modo: 'vencimento',
        situacao: '1',
        status: 'Em Aberto',
        cd_cliente: codigosMultimarcas,
      });

      const [responseVencidas, responseAVencer] = await Promise.all([
        fetch(
          `${TotvsURL}accounts-receivable/filter?${paramsVencidas.toString()}`,
        ),
        fetch(
          `${TotvsURL}accounts-receivable/filter?${paramsAVencer.toString()}`,
        ),
      ]);

      if (!responseVencidas.ok) {
        const errData = await responseVencidas.json().catch(() => ({}));
        throw new Error(
          errData.message || `Erro HTTP ${responseVencidas.status}`,
        );
      }

      const resultVencidas = await responseVencidas.json();
      const faturasVencidas = resultVencidas.data?.items || [];

      let faturasAVencerTodas = [];
      if (responseAVencer.ok) {
        const resultAVencer = await responseAVencer.json();
        faturasAVencerTodas = resultAVencer.data?.items || [];
      }

      // Apenas tipo documento FATURA
      const vencidasFiltradas = faturasVencidas.filter(
        (item) => item.tp_documento === 1 || item.tp_documento === '1',
      );
      const aVencerFiltradas = faturasAVencerTodas.filter(
        (item) => item.tp_documento === 1 || item.tp_documento === '1',
      );

      // PASSO 3: enriquecer com telefone/UF
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
          }
        } catch (err) {
          console.warn('⚠️ Erro ao buscar dados de pessoas:', err.message);
        }
      }

      const dadosEnriquecidos = vencidasFiltradas.map((item) => {
        const pessoa = pessoasMap[String(item.cd_cliente)] || {};
        const multimarca = multimarcasMap[String(item.cd_cliente)] || {};
        return {
          ...item,
          nm_cliente:
            pessoa.name ||
            multimarca.name ||
            item.nm_cliente ||
            item.nr_cpfcnpj ||
            `Cliente ${item.cd_cliente}`,
          nm_fantasia:
            pessoa.fantasyName ||
            multimarca.fantasyName ||
            item.nm_fantasia ||
            '',
          nr_telefone: pessoa.phone || '',
          ds_uf: pessoa.uf || item.ds_uf || '',
        };
      });

      const aVencerMap = {};
      aVencerFiltradas.forEach((item) => {
        const cd = String(item.cd_cliente);
        aVencerMap[cd] =
          (aVencerMap[cd] || 0) + (parseFloat(item.vl_fatura) || 0);
      });

      setValoresAVencer(aVencerMap);
      setDados(dadosEnriquecidos);
    } catch (error) {
      console.error('❌ Erro ao buscar clientes para o call center:', error);
      setDados([]);
      notificar('error', `Erro ao carregar dados: ${error.message}`, 5000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
    carregarContatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtro de cliente sobre as faturas
  const dadosFiltrados = useMemo(() => {
    if (filtroClientes.length === 0) return dados;
    return dados.filter((item) =>
      filtroClientes.includes(String(item.cd_cliente)),
    );
  }, [dados, filtroClientes]);

  const clientesDisponiveis = useMemo(() => {
    const map = new Map();
    (dados || []).forEach((d) => {
      if (d.cd_cliente) {
        const key = String(d.cd_cliente);
        if (!map.has(key))
          map.set(key, { cd_cliente: key, nm_cliente: d.nm_cliente || key });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.nm_cliente > b.nm_cliente ? 1 : -1,
    );
  }, [dados]);

  // ============================================================
  // Agrupar por cliente + juntar dados de ligação
  // ============================================================
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
          valor_total: 0,
          faturas: [],
        };
      }
      acc[cdCliente].valor_total += parseFloat(item.vl_fatura) || 0;
      acc[cdCliente].faturas.push(item);
      return acc;
    }, {});

    return Object.values(agrupado).map((cliente) => {
      const diasAtrasoMax = (cliente.faturas || []).reduce((max, fatura) => {
        const dias = diffEmDias(fatura.dt_vencimento);
        return dias === null ? max : Math.max(max, dias);
      }, 0);

      const contato = contatos[String(cliente.cd_cliente)] || {};

      return {
        ...cliente,
        diasAtrasoMax,
        situacao: diasAtrasoMax > 60 ? 'INADIMPLENTE' : 'VENCIDO',
        valor_a_vencer: valoresAVencer[cliente.cd_cliente] || 0,
        // Telefone salvo manualmente tem prioridade sobre o do TOTVS
        telefone: contato.telefone || cliente.nr_telefone || '',
        telefone_manual: !!contato.telefone,
        ultima_ligacao: contato.ultima_ligacao || null,
        proximo_contato: contato.proximo_contato || null,
        status_contato: contato.status_contato || null,
        dias_sem_contato: contato.ultima_ligacao
          ? diffEmDias(contato.ultima_ligacao)
          : null,
      };
    });
  }, [dadosFiltrados, contatos, valoresAVencer]);

  // Fila de ligações (busca + filtros + ordenação)
  const fila = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const termoDigitos = termo.replace(/\D/g, '');

    let resultado = clientesAgrupados.filter((c) => {
      const matchBusca =
        !termo ||
        String(c.cd_cliente).toLowerCase().includes(termo) ||
        (c.nm_cliente || '').toLowerCase().includes(termo) ||
        (c.nm_fantasia || '').toLowerCase().includes(termo) ||
        // Só compara telefone quando o termo digitado tem dígitos
        (termoDigitos !== '' &&
          String(c.telefone || '')
            .replace(/\D/g, '')
            .includes(termoDigitos));

      const matchSituacao =
        filtroSituacao === 'TODAS' || c.situacao === filtroSituacao;

      let matchFila = true;
      switch (filtroFila) {
        case 'NUNCA_LIGADO':
          matchFila = !c.ultima_ligacao;
          break;
        case 'LIGADO_HOJE':
          matchFila = c.ultima_ligacao === hojeStr;
          break;
        case 'SEM_CONTATO_7':
          matchFila =
            !c.ultima_ligacao ||
            (c.dias_sem_contato !== null && c.dias_sem_contato >= 7);
          break;
        case 'AGENDADOS_HOJE':
          matchFila = !!c.proximo_contato && c.proximo_contato <= hojeStr;
          break;
        case 'SEM_TELEFONE':
          matchFila = !c.telefone;
          break;
        default:
          matchFila = true;
      }

      return matchBusca && matchSituacao && matchFila;
    });

    if (ordenarPor) {
      resultado = [...resultado].sort((a, b) => {
        let valorA, valorB;
        switch (ordenarPor) {
          case 'cd_cliente':
            valorA = String(a.cd_cliente);
            valorB = String(b.cd_cliente);
            break;
          case 'nm_cliente':
            valorA = (a.nm_cliente || '').toLowerCase();
            valorB = (b.nm_cliente || '').toLowerCase();
            break;
          case 'ds_uf':
            valorA = (a.ds_uf || '').trim().toLowerCase();
            valorB = (b.ds_uf || '').trim().toLowerCase();
            break;
          case 'valor_total':
            valorA = parseFloat(a.valor_total) || 0;
            valorB = parseFloat(b.valor_total) || 0;
            break;
          case 'valor_a_vencer':
            valorA = parseFloat(a.valor_a_vencer) || 0;
            valorB = parseFloat(b.valor_a_vencer) || 0;
            break;
          case 'situacao':
            valorA = (a.situacao || '').toLowerCase();
            valorB = (b.situacao || '').toLowerCase();
            break;
          case 'ultima_ligacao':
            // Nunca ligado vai para o topo na ordem ascendente
            valorA = a.ultima_ligacao || '0000-00-00';
            valorB = b.ultima_ligacao || '0000-00-00';
            break;
          case 'status_contato':
            valorA = (a.status_contato || '').toLowerCase();
            valorB = (b.status_contato || '').toLowerCase();
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
    clientesAgrupados,
    busca,
    filtroSituacao,
    filtroFila,
    ordenarPor,
    direcaoOrdenacao,
    hojeStr,
  ]);

  // Os cards refletem exatamente a fila filtrada (situação, contato e busca)
  const metricas = useMemo(() => {
    const totalClientes = fila.length;
    const valorTotal = fila.reduce(
      (acc, c) => acc + (parseFloat(c.valor_total) || 0),
      0,
    );
    const valorAVencer = fila.reduce(
      (acc, c) => acc + (parseFloat(c.valor_a_vencer) || 0),
      0,
    );
    const nuncaLigados = fila.filter((c) => !c.ultima_ligacao).length;
    const ligadosHoje = fila.filter((c) => c.ultima_ligacao === hojeStr).length;
    const agendadosHoje = fila.filter(
      (c) => c.proximo_contato && c.proximo_contato <= hojeStr,
    ).length;
    const semTelefone = fila.filter((c) => !c.telefone).length;

    return {
      totalClientes,
      valorTotal,
      valorAVencer,
      nuncaLigados,
      ligadosHoje,
      agendadosHoje,
      semTelefone,
    };
  }, [fila, hojeStr]);

  const ordenarColuna = (coluna) => {
    if (ordenarPor === coluna) {
      setDirecaoOrdenacao(direcaoOrdenacao === 'asc' ? 'desc' : 'asc');
    } else {
      setOrdenarPor(coluna);
      setDirecaoOrdenacao('asc');
    }
  };

  const SetaOrdenacao = ({ coluna }) =>
    ordenarPor === coluna ? (
      <span>{direcaoOrdenacao === 'asc' ? '↑' : '↓'}</span>
    ) : null;

  // Atualiza o cache local sem precisar recarregar tudo do Supabase
  const atualizarContatoLocal = (cdCliente, patch) => {
    setContatos((prev) => ({
      ...prev,
      [String(cdCliente)]: { ...(prev[String(cdCliente)] || {}), ...patch },
    }));
  };

  // ============================================================
  // Telefone (edição inline)
  // ============================================================
  const iniciarEdicaoTelefone = (cliente, e) => {
    e.stopPropagation();
    setEditandoTelefone(cliente.cd_cliente);
    setTempTelefone(cliente.telefone || '');
  };

  const cancelarEdicaoTelefone = (e) => {
    e?.stopPropagation();
    setEditandoTelefone(null);
    setTempTelefone('');
  };

  const salvarTelefone = async (cliente, e) => {
    e?.stopPropagation();
    const telefone = tempTelefone.trim();

    setEditandoTelefone(null);
    setTempTelefone('');
    atualizarContatoLocal(cliente.cd_cliente, { telefone });

    const { success, error } = await salvarContato({
      cd_cliente: cliente.cd_cliente,
      nm_cliente: cliente.nm_cliente,
      telefone,
      usuario: user?.email || user?.id || 'Usuário',
    });

    if (success) {
      notificar('success', 'Telefone salvo!');
    } else {
      notificar('error', `Erro ao salvar telefone: ${error}`);
      carregarContatos();
    }
  };

  const copiarTelefone = async (telefone, e) => {
    e.stopPropagation();
    const num = String(telefone || '').replace(/\D/g, '');
    if (!num) return;
    try {
      await navigator.clipboard.writeText(num);
      notificar('success', 'Telefone copiado!', 2000);
    } catch {
      notificar('error', 'Não foi possível copiar o telefone');
    }
  };

  // ============================================================
  // Data da última ligação (edição inline direto na linha)
  // ============================================================
  const salvarUltimaLigacao = async (cliente, novaData) => {
    const valor = novaData || null;
    atualizarContatoLocal(cliente.cd_cliente, { ultima_ligacao: valor });

    const { success, error } = await salvarContato({
      cd_cliente: cliente.cd_cliente,
      nm_cliente: cliente.nm_cliente,
      ultima_ligacao: valor,
      usuario: user?.email || user?.id || 'Usuário',
    });

    if (success) {
      notificar('success', 'Data da última ligação atualizada!', 2000);
    } else {
      notificar('error', `Erro ao salvar data: ${error}`);
      carregarContatos();
    }
  };

  // ============================================================
  // Registro de ligação
  // ============================================================
  const abrirModalLigacao = (cliente, e) => {
    e?.stopPropagation();
    setClienteLigacao(cliente);
    setFormLigacao({
      data_ligacao: hojeStr,
      status_ligacao: '',
      proximo_contato: '',
      observacao: '',
    });
    setModalLigacaoAberto(true);
  };

  const fecharModalLigacao = () => {
    setModalLigacaoAberto(false);
    setClienteLigacao(null);
  };

  const confirmarLigacao = async () => {
    if (!clienteLigacao) return;

    if (!formLigacao.data_ligacao) {
      notificar('error', 'Informe a data da ligação.');
      return;
    }
    if (!formLigacao.status_ligacao) {
      notificar('error', 'Selecione o resultado da ligação.');
      return;
    }

    setSalvandoLigacao(true);
    const usuario = user?.email || user?.id || 'Usuário';

    const { success: okLigacao, error: erroLigacao } = await registrarLigacao({
      cd_cliente: clienteLigacao.cd_cliente,
      nm_cliente: clienteLigacao.nm_cliente,
      telefone: clienteLigacao.telefone,
      data_ligacao: formLigacao.data_ligacao,
      status_ligacao: formLigacao.status_ligacao,
      proximo_contato: formLigacao.proximo_contato || null,
      observacao: formLigacao.observacao.trim() || null,
      valor_vencido: clienteLigacao.valor_total,
      usuario,
    });

    if (!okLigacao) {
      setSalvandoLigacao(false);
      notificar('error', `Erro ao registrar ligação: ${erroLigacao}`);
      return;
    }

    // Estado atual do cliente (última ligação / status / retorno)
    const patch = {
      ultima_ligacao: formLigacao.data_ligacao,
      status_contato: formLigacao.status_ligacao,
      proximo_contato: formLigacao.proximo_contato || null,
    };

    const { success: okContato } = await salvarContato({
      cd_cliente: clienteLigacao.cd_cliente,
      nm_cliente: clienteLigacao.nm_cliente,
      telefone: clienteLigacao.telefone,
      ...patch,
      usuario,
    });

    if (okContato) {
      atualizarContatoLocal(clienteLigacao.cd_cliente, {
        ...patch,
        telefone: clienteLigacao.telefone,
      });
    } else {
      carregarContatos();
    }

    setSalvandoLigacao(false);
    fecharModalLigacao();
    notificar('success', 'Ligação registrada com sucesso!');
  };

  // ============================================================
  // Histórico de ligações
  // ============================================================
  const abrirModalHistorico = async (cliente, e) => {
    e?.stopPropagation();
    setClienteHistorico(cliente);
    setModalHistoricoAberto(true);
    setLoadingHistorico(true);
    setHistoricoLigacoes([]);

    const { success, data } = await buscarLigacoes(cliente.cd_cliente);
    setHistoricoLigacoes(success ? data : []);
    setLoadingHistorico(false);
  };

  const fecharModalHistorico = () => {
    setModalHistoricoAberto(false);
    setClienteHistorico(null);
    setHistoricoLigacoes([]);
  };

  const excluirLigacao = async (id) => {
    if (!confirm('Excluir este registro de ligação?')) return;

    const { success } = await deletarLigacao(id);
    if (success) {
      setHistoricoLigacoes((prev) => prev.filter((l) => l.id !== id));
      notificar('success', 'Registro excluído.');
    } else {
      notificar('error', 'Erro ao excluir registro.');
    }
  };

  // ============================================================
  // Títulos em aberto do cliente
  // ============================================================
  const abrirModalTitulos = (cliente) => {
    setClienteTitulos(cliente);
    setModalTitulosAberto(true);
  };

  const fecharModalTitulos = () => {
    setModalTitulosAberto(false);
    setClienteTitulos(null);
  };

  // ============================================================
  // Blocos reaproveitados pela tabela (desktop) e pelos cards (celular)
  // ============================================================
  const renderTelefone = (cliente) =>
    editandoTelefone === cliente.cd_cliente ? (
      <div className="flex items-center gap-1">
        <input
          type="tel"
          inputMode="tel"
          value={tempTelefone}
          onChange={(e) => setTempTelefone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvarTelefone(cliente, e);
            if (e.key === 'Escape') cancelarEdicaoTelefone(e);
          }}
          placeholder="(00) 00000-0000"
          autoFocus
          className="text-xs border border-gray-300 rounded px-2 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-[#000638]"
        />
        <button
          onClick={(e) => salvarTelefone(cliente, e)}
          className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1.5 rounded transition-colors"
        >
          OK
        </button>
        <button
          onClick={cancelarEdicaoTelefone}
          className="bg-gray-400 hover:bg-gray-500 text-white text-xs px-2 py-1.5 rounded transition-colors"
        >
          ✕
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-1">
        <span
          className={`text-xs font-semibold ${
            cliente.telefone ? 'text-gray-800' : 'text-gray-400 italic'
          }`}
        >
          {cliente.telefone
            ? formatarTelefone(cliente.telefone)
            : 'sem telefone'}
        </span>
        {cliente.telefone && (
          <button
            onClick={(e) => copiarTelefone(cliente.telefone, e)}
            className="text-gray-400 hover:text-[#000638] transition-colors p-1"
            title="Copiar telefone"
          >
            <Copy size={14} />
          </button>
        )}
        <button
          onClick={(e) => iniciarEdicaoTelefone(cliente, e)}
          className="text-gray-400 hover:text-[#000638] transition-colors p-1"
          title="Editar telefone"
        >
          <PencilSimple size={14} />
        </button>
      </div>
    );

  // Botão "Ligar": abre o discador do celular (tel:) e já sobe o modal de registro
  const renderBotaoLigar = (cliente, { full = false } = {}) => {
    const numero = telefoneParaDiscagem(cliente.telefone);
    const classes = `bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-xs font-semibold px-3 py-2 rounded transition-colors flex items-center justify-center gap-1 ${
      full ? 'flex-1' : ''
    }`;

    if (!numero) {
      return (
        <button
          onClick={(e) => abrirModalLigacao(cliente, e)}
          className={`${classes} !bg-gray-400 hover:!bg-gray-500`}
          title="Cliente sem telefone — registra a ligação manualmente"
        >
          <PhoneSlash size={14} weight="bold" />
          Ligar
        </button>
      );
    }

    return (
      <a
        href={`tel:${numero}`}
        onClick={(e) => abrirModalLigacao(cliente, e)}
        className={classes}
        title={`Discar ${formatarTelefone(cliente.telefone)}`}
      >
        <PhoneCall size={14} weight="bold" />
        Ligar
      </a>
    );
  };

  const renderUltimaLigacao = (cliente) => (
    <>
      <input
        type="date"
        value={cliente.ultima_ligacao || ''}
        max={hojeStr}
        onChange={(e) => salvarUltimaLigacao(cliente, e.target.value)}
        className="border border-gray-300 rounded px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-[#000638]"
      />
      <div className="text-[10px] text-gray-500 mt-0.5">
        {cliente.ultima_ligacao
          ? cliente.dias_sem_contato === 0
            ? 'hoje'
            : `há ${cliente.dias_sem_contato} dia${
                cliente.dias_sem_contato !== 1 ? 's' : ''
              }`
          : 'nunca ligado'}
      </div>
    </>
  );

  const renderSituacao = (cliente) => (
    <span
      className={`text-xs font-semibold px-2 py-1 rounded ${
        cliente.situacao === 'INADIMPLENTE'
          ? 'bg-red-100 text-red-800'
          : 'bg-yellow-100 text-yellow-800'
      }`}
    >
      {cliente.situacao}
    </span>
  );

  return (
    <div className="w-full max-w-[1600px] mx-auto py-4 px-3 sm:py-6 sm:px-4 space-y-4 sm:space-y-6">
      <PageTitle
        title="Call Center"
        subtitle="Fila de ligações de cobrança dos clientes Multimarcas — registre a data e o resultado de cada contato"
        icon={Headset}
        iconColor="text-blue-600"
      />

      {/* Filtros de consulta */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchDados();
          }}
        >
          <div className="text-sm font-semibold text-[#000638] mb-2">
            Configurações da fila de ligações
          </div>
          <span className="text-xs text-gray-500 mt-1">
            Base de clientes com títulos vencidos (mesma origem da Inadimplência
            Multimarcas)
          </span>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-3 mt-4">
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
            <div className="col-span-2 lg:col-span-1">
              <FiltroClientes
                clientes={clientesDisponiveis}
                selected={filtroClientes}
                onChange={setFiltroClientes}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
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
                  <PhoneCall size={16} />
                  Carregar Fila
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="shadow-lg rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Clientes na Fila
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-lg font-extrabold text-blue-600 mb-0.5">
              {metricas.totalClientes}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Com títulos vencidos
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CurrencyDollar size={18} className="text-red-600" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Valor Vencido
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-base font-extrabold text-red-600 mb-0.5">
              {formatarMoeda(metricas.valorTotal)}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Total da fila
            </CardDescription>
          </CardContent>
        </Card>

        <Card
          className="shadow-lg rounded-xl bg-white cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
          onClick={() => setFiltroFila('NUNCA_LIGADO')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <PhoneSlash size={18} className="text-orange-600" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Nunca Ligados
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-lg font-extrabold text-orange-600 mb-0.5">
              {metricas.nuncaLigados}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Sem nenhum contato registrado
            </CardDescription>
          </CardContent>
        </Card>

        <Card
          className="shadow-lg rounded-xl bg-white cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
          onClick={() => setFiltroFila('LIGADO_HOJE')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Ligações Hoje
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-lg font-extrabold text-green-600 mb-0.5">
              {metricas.ligadosHoje}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Clientes contatados hoje
            </CardDescription>
          </CardContent>
        </Card>

        <Card
          className="shadow-lg rounded-xl bg-white cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
          onClick={() => setFiltroFila('AGENDADOS_HOJE')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CalendarBlank size={18} className="text-purple-600" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Retornos Pendentes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="text-lg font-extrabold text-purple-600 mb-0.5">
              {metricas.agendadosHoje}
            </div>
            <CardDescription className="text-xs text-gray-500">
              Agendados para hoje ou atrasados
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Tabela da fila */}
      <Card className="shadow-lg rounded-xl bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Headset size={18} className="text-[#000638]" />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Fila de Ligações
              </CardTitle>
              <span className="text-xs text-gray-500">
                ({fila.length} cliente{fila.length !== 1 ? 's' : ''})
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <MagnifyingGlass
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar cliente, código ou telefone"
                  className="border border-gray-300 rounded-lg pl-7 pr-2 py-2 text-xs w-full focus:outline-none focus:ring-2 focus:ring-[#000638]"
                />
              </div>

              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2 text-xs flex-1 sm:flex-none focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                <option value="TODAS">Todas as situações</option>
                <option value="VENCIDO">Vencido (até 60 dias)</option>
                <option value="INADIMPLENTE">
                  Inadimplente (acima de 60 dias)
                </option>
              </select>

              <select
                value={filtroFila}
                onChange={(e) => setFiltroFila(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2 text-xs flex-1 sm:flex-none focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                <option value="TODOS">Todos os contatos</option>
                <option value="NUNCA_LIGADO">Nunca ligados</option>
                <option value="LIGADO_HOJE">Ligados hoje</option>
                <option value="SEM_CONTATO_7">Sem contato há 7+ dias</option>
                <option value="AGENDADOS_HOJE">Retornos pendentes</option>
                <option value="SEM_TELEFONE">Sem telefone</option>
              </select>

              <button
                onClick={carregarContatos}
                disabled={loadingContatos}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#000638] text-white text-xs font-medium rounded hover:bg-[#fe0000] transition-colors disabled:opacity-50"
                title="Recarregar registros de ligações"
              >
                {loadingContatos ? (
                  <CircleNotch size={14} className="animate-spin" />
                ) : (
                  <ClockClockwise size={14} weight="bold" />
                )}
                Atualizar
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 px-4 pb-4">
          <CardDescription className="text-xs text-gray-500 mb-4">
            Clique em uma linha para ver os títulos em aberto do cliente. O
            registro de ligações é manual — o sistema não disca para nenhum
            telefone.
          </CardDescription>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" text="Carregando fila..." />
            </div>
          ) : (
            <>
              {/* ---------- Tabela (desktop) ---------- */}
              <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th
                      className="px-3 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('cd_cliente')}
                    >
                      <div className="flex items-center gap-1">
                        Código
                        <SetaOrdenacao coluna="cd_cliente" />
                      </div>
                    </th>
                    <th
                      className="px-3 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('nm_cliente')}
                    >
                      <div className="flex items-center gap-1">
                        Cliente
                        <SetaOrdenacao coluna="nm_cliente" />
                      </div>
                    </th>
                    <th className="px-3 py-3">Telefone</th>
                    <th
                      className="px-3 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('ds_uf')}
                    >
                      <div className="flex items-center gap-1">
                        UF
                        <SetaOrdenacao coluna="ds_uf" />
                      </div>
                    </th>
                    <th
                      className="px-3 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('valor_total')}
                    >
                      <div className="flex items-center gap-1">
                        Valor Vencido
                        <SetaOrdenacao coluna="valor_total" />
                      </div>
                    </th>
                    <th
                      className="px-3 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('valor_a_vencer')}
                    >
                      <div className="flex items-center gap-1">
                        A Vencer
                        <SetaOrdenacao coluna="valor_a_vencer" />
                      </div>
                    </th>
                    <th
                      className="px-3 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('situacao')}
                    >
                      <div className="flex items-center gap-1">
                        Situação
                        <SetaOrdenacao coluna="situacao" />
                      </div>
                    </th>
                    <th
                      className="px-3 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('ultima_ligacao')}
                    >
                      <div className="flex items-center gap-1">
                        Última Ligação
                        <SetaOrdenacao coluna="ultima_ligacao" />
                      </div>
                    </th>
                    <th
                      className="px-3 py-3 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => ordenarColuna('status_contato')}
                    >
                      <div className="flex items-center gap-1">
                        Resultado
                        <SetaOrdenacao coluna="status_contato" />
                      </div>
                    </th>
                    <th className="px-3 py-3">Retorno</th>
                    <th className="px-3 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {fila.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Nenhum cliente encontrado para os filtros selecionados
                      </td>
                    </tr>
                  ) : (
                    fila.map((cliente) => (
                      <tr
                        key={cliente.cd_cliente}
                        className="bg-white border-b hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => abrirModalTitulos(cliente)}
                      >
                        <td className="px-3 py-3 font-medium text-gray-900">
                          {cliente.cd_cliente}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900">
                            {cliente.nm_cliente || 'N/A'}
                          </div>
                          {cliente.nm_fantasia && (
                            <div className="text-xs text-gray-500">
                              {cliente.nm_fantasia}
                            </div>
                          )}
                        </td>

                        {/* Telefone (editável) */}
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderTelefone(cliente)}
                        </td>

                        <td className="px-3 py-3">
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                            {cliente.ds_uf?.trim() || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-medium text-red-600">
                          {formatarMoeda(cliente.valor_total)}
                        </td>
                        <td className="px-3 py-3 font-medium text-orange-600">
                          {formatarMoeda(cliente.valor_a_vencer)}
                        </td>
                        <td className="px-3 py-3">
                          {renderSituacao(cliente)}
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {cliente.diasAtrasoMax} dia
                            {cliente.diasAtrasoMax !== 1 ? 's' : ''} de atraso
                          </div>
                        </td>

                        {/* Data da última ligação (editável direto na linha) */}
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderUltimaLigacao(cliente)}
                        </td>

                        <td className="px-3 py-3">
                          {cliente.status_contato ? (
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded ${
                                statusInfo(cliente.status_contato).cor
                              }`}
                            >
                              {statusInfo(cliente.status_contato).label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">---</span>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {cliente.proximo_contato ? (
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded ${
                                cliente.proximo_contato <= hojeStr
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {formatarData(cliente.proximo_contato)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">---</span>
                          )}
                        </td>

                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            {renderBotaoLigar(cliente)}
                            <button
                              onClick={(e) => abrirModalHistorico(cliente, e)}
                              className="bg-[#000638] hover:bg-[#fe0000] text-white text-xs font-medium px-2 py-2 rounded transition-colors"
                              title="Histórico de ligações"
                            >
                              <ClockClockwise size={14} weight="bold" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>

              {/* ---------- Cards (celular / tablet) ---------- */}
              <div className="lg:hidden space-y-3">
                {fila.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">
                    Nenhum cliente encontrado para os filtros selecionados
                  </div>
                ) : (
                  fila.map((cliente) => (
                    <div
                      key={cliente.cd_cliente}
                      className="border border-gray-200 rounded-xl p-3 shadow-sm bg-white"
                    >
                      {/* Cabeçalho do card */}
                      <div
                        className="flex justify-between items-start gap-2 cursor-pointer"
                        onClick={() => abrirModalTitulos(cliente)}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-gray-900 break-words">
                            {cliente.nm_cliente || 'N/A'}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            #{cliente.cd_cliente}
                            {cliente.ds_uf?.trim()
                              ? ` · ${cliente.ds_uf.trim()}`
                              : ''}{' '}
                            · {cliente.faturas.length} título
                            {cliente.faturas.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {renderSituacao(cliente)}
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {cliente.diasAtrasoMax} dia
                            {cliente.diasAtrasoMax !== 1 ? 's' : ''} atraso
                          </div>
                        </div>
                      </div>

                      {/* Valores */}
                      <div
                        className="grid grid-cols-2 gap-2 mt-3 cursor-pointer"
                        onClick={() => abrirModalTitulos(cliente)}
                      >
                        <div className="bg-red-50 rounded-lg px-2 py-1.5">
                          <div className="text-[10px] uppercase text-red-700 font-semibold">
                            Vencido
                          </div>
                          <div className="text-sm font-bold text-red-600">
                            {formatarMoeda(cliente.valor_total)}
                          </div>
                        </div>
                        <div className="bg-orange-50 rounded-lg px-2 py-1.5">
                          <div className="text-[10px] uppercase text-orange-700 font-semibold">
                            A vencer
                          </div>
                          <div className="text-sm font-bold text-orange-600">
                            {formatarMoeda(cliente.valor_a_vencer)}
                          </div>
                        </div>
                      </div>

                      {/* Telefone */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-semibold text-gray-500 shrink-0">
                          Telefone
                        </span>
                        {renderTelefone(cliente)}
                      </div>

                      {/* Última ligação + resultado */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">
                            Última ligação
                          </div>
                          {renderUltimaLigacao(cliente)}
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">
                            Resultado
                          </div>
                          {cliente.status_contato ? (
                            <span
                              className={`inline-block text-xs font-semibold px-2 py-1 rounded ${
                                statusInfo(cliente.status_contato).cor
                              }`}
                            >
                              {statusInfo(cliente.status_contato).label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">---</span>
                          )}
                          {cliente.proximo_contato && (
                            <div className="text-[10px] mt-1">
                              <span
                                className={`px-1.5 py-0.5 rounded font-semibold ${
                                  cliente.proximo_contato <= hojeStr
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                retorno {formatarData(cliente.proximo_contato)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-stretch gap-2 mt-3">
                        {renderBotaoLigar(cliente, { full: true })}
                        <button
                          onClick={(e) => abrirModalHistorico(cliente, e)}
                          className="bg-[#000638] hover:bg-[#fe0000] text-white text-xs font-semibold px-3 py-2 rounded transition-colors flex items-center gap-1"
                          title="Histórico de ligações"
                        >
                          <ClockClockwise size={14} weight="bold" />
                          Histórico
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal: Registrar Ligação */}
      {modalLigacaoAberto && clienteLigacao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-lg w-full max-h-[92vh] overflow-y-auto mx-2 sm:mx-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <PhoneCall size={24} weight="bold" className="text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Registrar Ligação
                </h3>
              </div>
              <button
                onClick={fecharModalLigacao}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-sm font-semibold text-[#000638]">
                {clienteLigacao.nm_cliente}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Código: {clienteLigacao.cd_cliente} ·{' '}
                {clienteLigacao.ds_uf?.trim() || 'N/A'}
              </div>
              {clienteLigacao.telefone ? (
                <a
                  href={`tel:${telefoneParaDiscagem(clienteLigacao.telefone)}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors"
                  title="Discar no celular"
                >
                  <Phone size={14} weight="bold" />
                  {formatarTelefone(clienteLigacao.telefone)}
                </a>
              ) : (
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Phone size={12} />
                  sem telefone cadastrado
                </div>
              )}
              <div className="text-xs mt-2">
                <span className="text-red-600 font-bold">
                  {formatarMoeda(clienteLigacao.valor_total)}
                </span>{' '}
                <span className="text-gray-500">
                  vencido em {clienteLigacao.faturas.length} título
                  {clienteLigacao.faturas.length !== 1 ? 's' : ''} ·{' '}
                  {clienteLigacao.diasAtrasoMax} dias de atraso
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#000638]">
                    Data da ligação *
                  </label>
                  <input
                    type="date"
                    value={formLigacao.data_ligacao}
                    max={hojeStr}
                    onChange={(e) =>
                      setFormLigacao((f) => ({
                        ...f,
                        data_ligacao: e.target.value,
                      }))
                    }
                    className="border border-gray-300 rounded-lg px-2 py-1.5 w-full text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#000638]">
                    Agendar retorno
                  </label>
                  <input
                    type="date"
                    value={formLigacao.proximo_contato}
                    onChange={(e) =>
                      setFormLigacao((f) => ({
                        ...f,
                        proximo_contato: e.target.value,
                      }))
                    }
                    className="border border-gray-300 rounded-lg px-2 py-1.5 w-full text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Resultado da ligação *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_LIGACAO.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setFormLigacao((f) => ({ ...f, status_ligacao: s.id }))
                      }
                      className={`text-xs font-semibold px-2 py-2 rounded border transition-colors ${
                        formLigacao.status_ligacao === s.id
                          ? `${s.cor} border-[#000638]`
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Observação
                </label>
                <textarea
                  value={formLigacao.observacao}
                  onChange={(e) =>
                    setFormLigacao((f) => ({ ...f, observacao: e.target.value }))
                  }
                  rows={3}
                  placeholder="O que foi combinado na ligação?"
                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#000638] resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
              <button
                onClick={fecharModalLigacao}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarLigacao}
                disabled={salvandoLigacao}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {salvandoLigacao ? (
                  <>
                    <CircleNotch size={16} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} weight="bold" />
                    Salvar Ligação
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Histórico de Ligações */}
      {modalHistoricoAberto && clienteHistorico && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-3xl w-full max-h-[92vh] overflow-hidden mx-2 sm:mx-4 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ClockClockwise
                  size={24}
                  weight="bold"
                  className="text-[#000638]"
                />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  Histórico — {clienteHistorico.nm_cliente}
                </h3>
              </div>
              <button
                onClick={fecharModalHistorico}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Cliente: {clienteHistorico.cd_cliente} | Valor vencido:{' '}
              {formatarMoeda(clienteHistorico.valor_total)}
            </p>

            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 min-h-[240px] max-h-[420px]">
              {loadingHistorico ? (
                <div className="flex justify-center items-center py-8">
                  <CircleNotch
                    size={32}
                    className="animate-spin text-[#000638]"
                  />
                </div>
              ) : historicoLigacoes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <PhoneSlash size={48} className="mx-auto mb-2 opacity-50" />
                  <p>Nenhuma ligação registrada para este cliente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historicoLigacoes.map((lig) => (
                    <div
                      key={lig.id}
                      className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${
                              statusInfo(lig.status_ligacao).cor
                            }`}
                          >
                            {statusInfo(lig.status_ligacao).label}
                          </span>
                          <span className="text-xs text-gray-600 flex items-center gap-1">
                            <CalendarBlank size={12} />
                            {formatarData(lig.data_ligacao)}
                          </span>
                          {lig.proximo_contato && (
                            <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                              retorno em {formatarData(lig.proximo_contato)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => excluirLigacao(lig.id)}
                          className="text-red-500 hover:text-red-700 transition-colors shrink-0"
                          title="Excluir registro"
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                      </div>

                      {lig.observacao && (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                          {lig.observacao}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {lig.usuario}
                        </span>
                        <span>
                          {lig.valor_vencido != null &&
                            `vencido na época: ${formatarMoeda(lig.valor_vencido)}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Títulos em aberto do cliente */}
      {modalTitulosAberto && clienteTitulos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[92vh] overflow-y-auto mx-2 sm:mx-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Receipt size={24} weight="bold" className="text-[#000638]" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  Títulos em Aberto — {clienteTitulos.nm_cliente}
                </h3>
              </div>
              <button
                onClick={fecharModalTitulos}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-500">Código:</span>{' '}
                <span className="font-semibold">
                  {clienteTitulos.cd_cliente}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Telefone:</span>{' '}
                <span className="font-semibold">
                  {clienteTitulos.telefone
                    ? formatarTelefone(clienteTitulos.telefone)
                    : '---'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Vencido:</span>{' '}
                <span className="font-semibold text-red-600">
                  {formatarMoeda(clienteTitulos.valor_total)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">A vencer:</span>{' '}
                <span className="font-semibold text-orange-600">
                  {formatarMoeda(clienteTitulos.valor_a_vencer)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-3 py-2">Fatura</th>
                    <th className="px-3 py-2">Emissão</th>
                    <th className="px-3 py-2">Vencimento</th>
                    <th className="px-3 py-2">Atraso</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(clienteTitulos.faturas || []).map((fatura, idx) => {
                    const dias = diffEmDias(fatura.dt_vencimento);
                    return (
                      <tr key={idx} className="border-b">
                        <td className="px-3 py-2 font-medium">
                          {fatura.nr_fat || fatura.nr_fatura || 'N/A'}
                        </td>
                        <td className="px-3 py-2">
                          {formatarData(fatura.dt_emissao)}
                        </td>
                        <td className="px-3 py-2">
                          {formatarData(fatura.dt_vencimento)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${
                              dias > 60
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {dias ?? 0} dias
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-red-600">
                          {formatarMoeda(fatura.vl_fatura)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td colSpan={4} className="px-3 py-2 font-bold">
                      TOTAL VENCIDO
                    </td>
                    <td className="px-3 py-2 text-right font-extrabold text-red-700">
                      {formatarMoeda(clienteTitulos.valor_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
              <button
                onClick={fecharModalTitulos}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
              {telefoneParaDiscagem(clienteTitulos.telefone) ? (
                <a
                  href={`tel:${telefoneParaDiscagem(clienteTitulos.telefone)}`}
                  onClick={(e) => {
                    fecharModalTitulos();
                    abrirModalLigacao(clienteTitulos, e);
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <PhoneCall size={16} weight="bold" />
                  Ligar para {formatarTelefone(clienteTitulos.telefone)}
                </a>
              ) : (
                <button
                  onClick={(e) => {
                    fecharModalTitulos();
                    abrirModalLigacao(clienteTitulos, e);
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <PhoneSlash size={16} weight="bold" />
                  Registrar Ligação
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alerta de clientes sem telefone */}
      {!loading && metricas.semTelefone > 0 && (
        <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <Warning size={16} weight="bold" />
          {metricas.semTelefone} cliente
          {metricas.semTelefone !== 1 ? 's' : ''} sem telefone cadastrado — use
          o lápis na coluna Telefone para preencher manualmente.
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

export default CallCenter;
