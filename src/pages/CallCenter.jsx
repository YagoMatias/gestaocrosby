import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import FiltroClientes from '../components/filters/FiltroClientes';
import { useAuth } from '../components/AuthContext';
import useCallCenter from '../hooks/useCallCenter';
import PageTitle from '../components/ui/PageTitle';
import { TotvsURL, API_BASE_URL } from '../config/constants';
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
  ChatText,
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
  { id: 'SMS_ENVIADO', label: 'SMS enviado', cor: 'bg-teal-100 text-teal-800' },
];

// WhatsApp de atendimento divulgado nos SMS. Só dígitos com DDI, no formato
// que o wa.me espera — mudar aqui reflete em todos os modelos.
const WHATSAPP_COBRANCA = '5571991003428';

// Modelo padrão do SMS de cobrança — usado tanto no envio avulso quanto no
// disparo em massa (editável nos dois modais). Sem acentos: SMS usa GSM-7 e
// caractere fora da tabela derruba o limite de 160 para 70.
// {VALOR} é substituído pelo total vencido do cliente (só o número — o "R$"
// já está escrito no texto).
const MENSAGEM_SMS_PADRAO =
  'Crosby: seu CNPJ tem R$ {VALOR} em faturas VENCIDAS, podendo adicionar ' +
  'multa e juros,risco de PROTESTO. Renegocie no WhatsApp: ' +
  `https://wa.me/${WHATSAPP_COBRANCA}`;

// Teto rígido de 1 SMS: acima de 160 a operadora divide em 2 partes e cobra
// 2 créditos por cliente. O envio é bloqueado em vez de dividir.
const SMS_LIMITE = 160;

// ============================================================
// Modo ADIMPLENTES — dois níveis, por urgência, para não virar spam:
//
//   Vence HOJE ou AMANHÃ  → aviso + código de barras (prioridade URGENTE)
//   Vence em 2 a 7 dias   → só um lembrete consolidado, SEM código de barras
//                           (o boleto chega quando a fatura ficar urgente)
//
// Teto de 3 SMS por cliente por dia — o mesmo do backend. Na prática:
// 1 aviso + até 2 códigos de barras.
// ============================================================
const DIAS_URGENTE = 1; // 0 = vence hoje, 1 = vence amanhã
const TETO_SMS_CLIENTE = 3;

// Placeholders: {NOME} {VALOR} {VENCIMENTO} {NOTA}. Sem NF, o trecho
// ", ref. NF {NOTA}" some sozinho.
const MENSAGEM_SMS_URGENTE =
  'Crosby: Ola {NOME}! Sua fatura de R$ {VALOR} vence dia {VENCIMENTO}, ' +
  'ref. NF {NOTA}. Segue o codigo de barras do boleto no proximo SMS.';

// Usado quando o cliente tem mais de uma fatura vencendo hoje/amanhã
const MENSAGEM_SMS_URGENTE_MULTI =
  'Crosby: Ola {NOME}! Voce tem {QTD} faturas vencendo ({DATAS}), total ' +
  'R$ {TOTAL}. Seguem os codigos de barras nos proximos SMS.';

// Faturas de 2 a 7 dias: um único SMS, sem boleto.
// Enxuto de propósito: com nome de 20 chars, 3 datas e valor de 7 dígitos
// o texto resolvido bate 155 — ainda dentro dos 160 de 1 SMS.
const MENSAGEM_SMS_LEMBRETE =
  'Crosby: Ola {NOME}! {QTD} faturas a vencer ({DATAS}), total R$ {TOTAL}. ' +
  `O boleto chega no dia do vencimento. wa.me/${WHATSAPP_COBRANCA}`;

/**
 * Normaliza um telefone para 55 + DDD + 9 dígitos (celular).
 *
 * Precisa espelhar exatamente a normalizarNumero do backend
 * (routes/sms.routes.js): é por este número que as respostas da DisparoPro
 * são casadas com o cliente. Se as duas divergirem, a tela reporta falha em
 * SMS que na verdade saiu.
 *
 * Muito cadastro do TOTVS ainda tem celular de 8 dígitos, anterior ao nono
 * dígito — daí a reposição do 9.
 *
 * @returns {{numero: string|null, motivo: string|null, fixo: boolean}}
 */
const normalizarCelularSms = (telefone) => {
  const d = String(telefone || '').replace(/\D/g, '');
  if (!d) return { numero: null, motivo: 'Sem telefone', fixo: false };

  let nacional = d;
  if (d.length >= 12 && d.startsWith('55')) nacional = d.slice(2);

  if (nacional.length < 10 || nacional.length > 11) {
    return { numero: null, motivo: 'Telefone incompleto', fixo: false };
  }

  const ddd = nacional.slice(0, 2);
  let assinante = nacional.slice(2);

  if (Number(ddd) < 11) {
    return { numero: null, motivo: `DDD inválido (${ddd})`, fixo: false };
  }

  if (assinante.length === 8) {
    if (/^[2-5]/.test(assinante)) {
      return { numero: null, motivo: 'Fixo não recebe SMS', fixo: true };
    }
    assinante = `9${assinante}`; // repõe o nono dígito
  }

  if (assinante.length !== 9 || !assinante.startsWith('9')) {
    return { numero: null, motivo: 'Não parece celular', fixo: false };
  }

  return { numero: `55${ddd}${assinante}`, motivo: null, fixo: false };
};

const dataCurtaSms = (isoDate) => {
  const [, m, d] = String(isoDate || '').substring(0, 10).split('-');
  return d && m ? `${d}/${m}` : '';
};

// Nome apresentável para o SMS. O TOTVS devolve fantasia bem irregular:
// "53.065.997 FABIA MARCELA...", "F073 - CROSBY BEZERROS", ou vazio — sem
// limpar, o cliente recebe "Ola 53.065.997 FABIA!".
const nomeParaSms = (cliente) => {
  const limpar = (s) =>
    String(s || '')
      .trim()
      // CNPJ/CPF no começo ("53.065.997", "12.345.678/0001-99")
      .replace(/^[\d.\-/]{5,}\s*/, '')
      // código de loja no começo ("F073 - ", "MTM ")
      .replace(/^[A-Z]{1,3}\d{2,4}\s*-\s*/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  let nome = limpar(cliente?.nm_fantasia) || limpar(cliente?.nm_cliente);
  // Sobrou só número/lixo? Cai para o primeiro nome da razão social
  if (!/[A-Za-zÀ-ÿ]{3}/.test(nome)) {
    nome = String(cliente?.nm_cliente || '')
      .replace(/[\d.\-/]/g, ' ')
      .trim()
      .split(/\s+/)[0];
  }
  if (!nome) return 'cliente';

  // Nome longo estoura os 160 chars do SMS — corta em 20, por palavra inteira
  if (nome.length > 20) {
    const corte = nome.lastIndexOf(' ', 20);
    nome = nome.slice(0, corte > 8 ? corte : 20).trim();
  }
  return nome;
};

// Lista de datas de vencimento, sem repetir e em ordem
const listarDatas = (faturas) => {
  const datas = [
    ...new Set((faturas || []).map((f) => f.dt_vencimento?.substring(0, 10))),
  ]
    .filter(Boolean)
    .sort();
  const curtas = datas.map(dataCurtaSms);
  if (curtas.length <= 3) return curtas.join(', ');
  return `${curtas.slice(0, 2).join(', ')} e mais ${curtas.length - 2}`;
};

const somaFaturas = (faturas) =>
  (faturas || []).reduce((s, f) => s + (parseFloat(f.vl_fatura) || 0), 0);

/**
 * Resolve os placeholders. `fatura` é usado no modelo de fatura única;
 * `faturas` alimenta {QTD} {DATAS} {TOTAL} nos modelos consolidados.
 */
const aplicarTemplateLembrete = (template, cliente, fatura, faturas = null) => {
  let t = String(template || '');
  const grupo = faturas || (fatura ? [fatura] : []);

  t = t.replace(/\{nome\}/gi, nomeParaSms(cliente));
  t = t.replace(/\{qtd\}/gi, String(grupo.length));
  t = t.replace(/\{datas\}/gi, listarDatas(grupo));
  t = t.replace(/\{total\}/gi, valorParaSms(somaFaturas(grupo)));
  t = t.replace(/\{valor\}/gi, valorParaSms(fatura?.vl_fatura));
  t = t.replace(/\{vencimento\}/gi, dataCurtaSms(fatura?.dt_vencimento));

  const nf = fatura?.nr_nota_fiscal;
  if (nf) {
    t = t.replace(/\{nota\}/gi, String(nf));
  } else {
    // remove o trecho opcional da NF (com a pontuação que o precede)
    t = t
      .replace(/[,;]?\s*ref(erente)?\.?\s*(a\s*)?(NF|nota fiscal)\s*\{nota\}/gi, '')
      .replace(/\{nota\}/gi, '');
  }
  return t
    .replace(/\s{2,}/g, ' ')
    // concordância quando {QTD} resolve para 1
    .replace(/\b1 faturas\b/g, '1 fatura')
    .trim();
};

// Faturas do cliente que têm boleto emitido (linha digitável disponível)
const faturasComBoleto = (cliente) =>
  (cliente?.faturas || []).filter(
    (f) => String(f.linha_digitavel || '').replace(/\D/g, '').length >= 40,
  );

// Dias até o vencimento (0 = hoje, negativo = já venceu)
const diasAteVencimento = (fatura) => {
  const str = String(fatura?.dt_vencimento || '').substring(0, 10);
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  const venc = new Date(y, m - 1, d);
  venc.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((venc - hoje) / 86400000);
};

/**
 * Monta o plano de SMS de um cliente conforme a urgência das faturas.
 * @returns {{tipo, mensagens, urgentes, futuras, excedentes}}
 */
const planoSmsCliente = (cliente, templates) => {
  const vazio = {
    tipo: 'NENHUM',
    mensagens: [],
    urgentes: [],
    futuras: [],
    excedentes: [],
  };
  if (!cliente) return vazio;

  const urgentes = faturasComBoleto(cliente).filter((f) => {
    const d = diasAteVencimento(f);
    return d !== null && d <= DIAS_URGENTE;
  });

  // Vence hoje/amanhã → aviso + código de barras
  if (urgentes.length > 0) {
    const ordenadas = [...urgentes].sort(
      (a, b) => (diasAteVencimento(a) ?? 0) - (diasAteVencimento(b) ?? 0),
    );
    // 1 aviso + N boletos, respeitando o teto por cliente
    const cabem = ordenadas.slice(0, TETO_SMS_CLIENTE - 1);
    const excedentes = ordenadas.slice(TETO_SMS_CLIENTE - 1);
    const unica = cabem.length === 1;

    const aviso = aplicarTemplateLembrete(
      unica ? templates.urgente : templates.urgenteMulti,
      cliente,
      unica ? cabem[0] : null,
      cabem,
    );

    return {
      tipo: 'URGENTE',
      urgentes: ordenadas,
      futuras: [],
      excedentes,
      mensagens: [
        { texto: aviso, prioridade: 'URGENTE', papel: 'AVISO' },
        ...cabem.map((f) => ({
          texto: String(f.linha_digitavel || '').replace(/\D/g, ''),
          prioridade: 'URGENTE',
          papel: 'BOLETO',
          fatura: f,
        })),
      ],
    };
  }

  // 2 a 7 dias → um único lembrete, sem boleto (boleto vai no vencimento)
  const futuras = (cliente.faturas || []).filter((f) => {
    const d = diasAteVencimento(f);
    return d !== null && d > DIAS_URGENTE;
  });
  if (futuras.length === 0) return vazio;

  return {
    tipo: 'LEMBRETE',
    urgentes: [],
    futuras,
    excedentes: [],
    mensagens: [
      {
        texto: aplicarTemplateLembrete(
          templates.lembrete,
          cliente,
          null,
          futuras,
        ),
        prioridade: 'NORMAL',
        papel: 'LEMBRETE',
      },
    ],
  };
};

// Valor GSM-safe: o modo currency do toLocaleString insere NBSP entre "R$" e
// o número, caractere que não existe na tabela GSM-7.
const valorParaSms = (v) =>
  (parseFloat(v) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const aplicarTemplateSms = (template, cliente) =>
  String(template || '').replace(
    /\{valor\}/gi,
    valorParaSms(cliente?.valor_total),
  );

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
    buscarUltimosSms,
    deletarLigacao,
  } = useCallCenter();

  const hojeStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // INADIMPLENTES = títulos vencidos (cobrança) | ADIMPLENTES = títulos a
  // vencer de hoje até +7 dias (lembrete com código de barras)
  const [modo, setModo] = useState('INADIMPLENTES');

  // Cache por modo: trocar o toggle NÃO refaz a consulta TOTVS de um recorte
  // que já foi carregado. { [modo]: { dados, valoresAVencer, carregadoEm,
  // chaveFiltro } }. Só recarrega no botão "Carregar Fila" ou no 1º acesso.
  const [cachePorModo, setCachePorModo] = useState({});
  // Loading por modo — uma busca em andamento não trava a aba já carregada
  const [carregandoModo, setCarregandoModo] = useState({});
  // Trava síncrona: o `disabled` do botão só reage no próximo render, então um
  // duplo-clique rápido dispararia duas consultas TOTVS de 12 páginas
  const buscasEmVooRef = useRef(new Set());

  const [notification, setNotification] = useState(null);

  // Filtros de consulta (mesma base da Inadimplência MTM)
  const [filtroDataInicial, setFiltroDataInicial] = useState('2024-04-01');
  const [filtroDataFinal, setFiltroDataFinal] = useState(hojeStr);
  const [filtroClientes, setFiltroClientes] = useState([]);

  // Filtros da fila de ligações
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('TODAS');
  const [filtroFila, setFiltroFila] = useState('TODOS');

  // Dados de call center vindos do Supabase
  const [contatos, setContatos] = useState({}); // { cd_cliente: { telefone, ultima_ligacao, ... } }
  // Último SMS por cliente, derivado do histórico de ligações
  const [ultimosSms, setUltimosSms] = useState({}); // { cd_cliente: { data_ligacao, data_criacao } }
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

  // SMS (DisparoPro via backend)
  const [modalSmsAberto, setModalSmsAberto] = useState(false);
  const [clienteSms, setClienteSms] = useState(null);
  const [textoSms, setTextoSms] = useState(MENSAGEM_SMS_PADRAO);
  const [enviandoSms, setEnviandoSms] = useState(false);
  const [saldoSms, setSaldoSms] = useState(null);

  // SMS em massa (seleção de clientes)
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [modalSmsLoteAberto, setModalSmsLoteAberto] = useState(false);
  const [textoSmsLote, setTextoSmsLote] = useState(MENSAGEM_SMS_PADRAO);
  const [enviandoSmsLote, setEnviandoSmsLote] = useState(false);

  // Painel de falhas de SMS (vem de sms_enviados via backend)
  const [modalFalhasAberto, setModalFalhasAberto] = useState(false);
  const [falhasSms, setFalhasSms] = useState([]);
  const [resumoFalhas, setResumoFalhas] = useState({});
  const [loadingFalhas, setLoadingFalhas] = useState(false);
  const [erroFalhas, setErroFalhas] = useState(null);

  // Modelos do modo adimplente (editáveis nos modais)
  const [tplUrgente, setTplUrgente] = useState(MENSAGEM_SMS_URGENTE);
  const [tplLembrete, setTplLembrete] = useState(MENSAGEM_SMS_LEMBRETE);
  const templatesSms = useMemo(
    () => ({
      urgente: tplUrgente,
      urgenteMulti: MENSAGEM_SMS_URGENTE_MULTI,
      lembrete: tplLembrete,
    }),
    [tplUrgente, tplLembrete],
  );

  // ============================================================
  // Cache por modo — tudo abaixo lê do bucket do modo ativo
  // ============================================================
  // Identifica o recorte carregado. ADIMPLENTES tem janela fixa (hoje..+7),
  // então só o dia importa; INADIMPLENTES depende das datas escolhidas.
  const chaveFiltroDe = (m) =>
    m === 'ADIMPLENTES'
      ? `ADIMPLENTES|${hojeStr}`
      : `INADIMPLENTES|${filtroDataInicial}|${filtroDataFinal}`;

  // Saldo vem como string pt-BR ("50,35" / "-3,35")
  const saldoNegativo = String(saldoSms ?? '').trim().startsWith('-');

  const cacheAtual = cachePorModo[modo];
  const dados = cacheAtual?.dados || [];
  const valoresAVencer = cacheAtual?.valoresAVencer || {};
  const loading = !!carregandoModo[modo];
  // Filtros mudaram depois que os dados foram carregados
  const cacheDesatualizado =
    !!cacheAtual && cacheAtual.chaveFiltro !== chaveFiltroDe(modo);

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

  // Número para o discador (tel:). Diferente do SMS, aqui fixo serve — dá
  // para ligar normalmente. Celular de 8 dígitos ganha o 9, senão a chamada
  // não completa.
  const telefoneParaDiscagem = (telefone) => {
    const cel = normalizarCelularSms(telefone);
    if (cel.numero) return `+${cel.numero}`;

    const num = String(telefone || '').replace(/\D/g, '');
    if (!num) return '';
    if (num.length === 10 || num.length === 11) return `+55${num}`;
    if ((num.length === 12 || num.length === 13) && num.startsWith('55'))
      return `+${num}`;
    return num;
  };

  // Número que a DisparoPro vai usar — base do casamento das respostas
  const numeroSms = (telefone) => normalizarCelularSms(telefone).numero;

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
    const [resContatos, resSms] = await Promise.all([
      buscarContatos(),
      buscarUltimosSms(),
    ]);
    if (resContatos.success) {
      const mapa = {};
      (resContatos.data || []).forEach((c) => {
        mapa[String(c.cd_cliente)] = c;
      });
      setContatos(mapa);
    }
    if (resSms.success) setUltimosSms(resSms.data || {});
    setLoadingContatos(false);
  }, []);

  // ============================================================
  // Buscar clientes inadimplentes multimarcas (mesma origem da MTM)
  // ============================================================
  const fetchDados = async (modoAtual = modo, { forcar = false } = {}) => {
    // Já em cache e sem pedido explícito de recarga → não gasta rota
    if (!forcar && cachePorModo[modoAtual]) return;
    // Busca já em andamento para este modo → evita disparo duplicado
    if (buscasEmVooRef.current.has(modoAtual)) return;

    const chaveFiltro = chaveFiltroDe(modoAtual);

    try {
      buscasEmVooRef.current.add(modoAtual);
      setCarregandoModo((prev) => ({ ...prev, [modoAtual]: true }));

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
        setCachePorModo((prev) => ({
          ...prev,
          [modoAtual]: {
            dados: [],
            valoresAVencer: {},
            carregadoEm: new Date(),
            chaveFiltro,
          },
        }));
        return;
      }

      const multimarcasMap = {};
      multimarcas.forEach((m) => {
        multimarcasMap[String(m.code)] = m;
      });
      const codigosMultimarcas = multimarcas.map((m) => m.code).join(',');

      // PASSO 2: contas a receber conforme o modo
      let vencidasFiltradas = [];
      let aVencerFiltradas = [];

      if (modoAtual === 'ADIMPLENTES') {
        // Títulos a vencer de hoje até +7 dias, com NF (expand_invoice) e
        // linha digitável — tudo em uma única consulta
        const seteDias = new Date();
        seteDias.setDate(seteDias.getDate() + 7);
        const seteDiasStr = seteDias.toISOString().split('T')[0];

        const paramsJanela = new URLSearchParams({
          dt_inicio: hojeStr,
          dt_fim: seteDiasStr,
          modo: 'vencimento',
          situacao: '1',
          status: 'Em Aberto',
          cd_cliente: codigosMultimarcas,
          expand_invoice: '1',
        });

        const respJanela = await fetch(
          `${TotvsURL}accounts-receivable/filter?${paramsJanela.toString()}`,
        );
        if (!respJanela.ok) {
          const errData = await respJanela.json().catch(() => ({}));
          throw new Error(errData.message || `Erro HTTP ${respJanela.status}`);
        }
        const resultJanela = await respJanela.json();
        vencidasFiltradas = (resultJanela.data?.items || []).filter(
          (item) => item.tp_documento === 1 || item.tp_documento === '1',
        );
      } else {
        // INADIMPLENTES: vencidas no período + a vencer (1 ano) p/ contexto
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
        vencidasFiltradas = faturasVencidas.filter(
          (item) => item.tp_documento === 1 || item.tp_documento === '1',
        );
        aVencerFiltradas = faturasAVencerTodas.filter(
          (item) => item.tp_documento === 1 || item.tp_documento === '1',
        );
      }

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

      setCachePorModo((prev) => ({
        ...prev,
        [modoAtual]: {
          dados: dadosEnriquecidos,
          valoresAVencer: aVencerMap,
          carregadoEm: new Date(),
          chaveFiltro,
        },
      }));
    } catch (error) {
      console.error('❌ Erro ao buscar clientes para o call center:', error);
      // Falha não apaga um cache bom que já existia para este modo
      notificar('error', `Erro ao carregar dados: ${error.message}`, 5000);
    } finally {
      buscasEmVooRef.current.delete(modoAtual);
      setCarregandoModo((prev) => ({ ...prev, [modoAtual]: false }));
    }
  };

  // Falhas de SMS dos últimos 7 dias, com o motivo de cada uma
  const carregarFalhas = useCallback(async () => {
    setLoadingFalhas(true);
    setErroFalhas(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/sms/falhas?dias=7`);
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.message || `HTTP ${resp.status}`);
      setFalhasSms(json?.data?.falhas || []);
      setResumoFalhas(json?.data?.porMotivo || {});
    } catch (err) {
      setFalhasSms([]);
      setResumoFalhas({});
      setErroFalhas(err.message);
    } finally {
      setLoadingFalhas(false);
    }
  }, []);

  const abrirModalFalhas = () => {
    setModalFalhasAberto(true);
    carregarFalhas();
  };

  // Saldo de créditos SMS (DisparoPro)
  const carregarSaldoSms = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/sms/saldo`);
      if (!resp.ok) return;
      const json = await resp.json();
      if (json?.data?.saldo != null) setSaldoSms(json.data.saldo);
    } catch {
      // saldo é informativo — falha silenciosa
    }
  }, []);

  useEffect(() => {
    fetchDados();
    carregarContatos();
    carregarSaldoSms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Troca de modo: os dados de cada aba ficam em cache, então voltar para uma
  // aba já carregada é instantâneo — só busca no TOTVS no primeiro acesso.
  const trocarModo = (novoModo) => {
    if (novoModo === modo) return;
    setModo(novoModo);
    // A seleção é por cliente e as listas são disjuntas — limpar evita
    // disparar SMS para quem nem está na aba visível
    setSelecionados(new Set());
    setFiltroSituacao('TODAS');
    fetchDados(novoModo); // no-op se já houver cache
  };

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

      // ADIMPLENTES: dias até o vencimento mais próximo (diffEmDias é
      // negativo para datas futuras)
      const diasParaVencer = (cliente.faturas || []).reduce((min, fatura) => {
        const dias = diffEmDias(fatura.dt_vencimento);
        if (dias === null) return min;
        const paraVencer = Math.max(0, -dias);
        return min === null ? paraVencer : Math.min(min, paraVencer);
      }, null);

      const contato = contatos[String(cliente.cd_cliente)] || {};

      return {
        ...cliente,
        diasAtrasoMax,
        diasParaVencer: diasParaVencer ?? 0,
        situacao:
          modo === 'ADIMPLENTES'
            ? 'A VENCER'
            : diasAtrasoMax > 60
              ? 'INADIMPLENTE'
              : 'VENCIDO',
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
        // A coluna em call_center_contatos tem prioridade: a leitura derivada
        // do histórico é limitada a 1000 linhas pelo PostgREST
        ultimo_sms:
          contato.ultimo_sms ||
          ultimosSms[String(cliente.cd_cliente)]?.data_ligacao ||
          null,
      };
    });
  }, [dadosFiltrados, contatos, valoresAVencer, ultimosSms, modo]);

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
        case 'SEM_SMS_POSSIVEL':
          // tem telefone cadastrado, mas a operadora não entrega SMS nele
          matchFila = !!c.telefone && !numeroSms(c.telefone);
          break;
        case 'SEM_SMS':
          matchFila = !c.ultimo_sms;
          break;
        case 'SMS_HOJE':
          matchFila = c.ultimo_sms === hojeStr;
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
          case 'ultimo_sms':
            // Nunca enviado vai para o topo na ordem ascendente
            valorA = a.ultimo_sms || '0000-00-00';
            valorB = b.ultimo_sms || '0000-00-00';
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

  // Marca o SMS de hoje localmente e persiste em call_center_contatos.
  // A gravação é best-effort: se a coluna ultimo_sms ainda não existir no
  // Supabase, a data continua sendo derivada de call_center_ligacoes.
  const marcarSmsEnviadoLocal = (clientesEnviados) => {
    // No modo adimplente o mesmo cliente aparece uma vez por fatura —
    // deduplica para não gravar o contato várias vezes
    const unicos = [
      ...new Map(
        clientesEnviados.map((c) => [String(c.cd_cliente), c]),
      ).values(),
    ];

    const agora = new Date().toISOString();
    setUltimosSms((prev) => {
      const novo = { ...prev };
      unicos.forEach((c) => {
        novo[String(c.cd_cliente)] = {
          data_ligacao: hojeStr,
          data_criacao: agora,
        };
      });
      return novo;
    });

    unicos.forEach((c) => {
      atualizarContatoLocal(c.cd_cliente, { ultimo_sms: hojeStr });
      salvarContato({
        cd_cliente: c.cd_cliente,
        nm_cliente: c.nm_cliente,
        ultimo_sms: hojeStr,
        usuario: user?.email || user?.id || 'Usuário',
      }).then(({ success, error }) => {
        if (!success) {
          console.warn(
            `ultimo_sms não persistido (cliente ${c.cd_cliente}): ${error}. Rode o ALTER TABLE de database/schema-call-center.sql.`,
          );
        }
      });
    });
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
  // Seleção de clientes para SMS em massa
  // ============================================================
  const toggleSelecionado = (cdCliente) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      const key = String(cdCliente);
      if (novo.has(key)) novo.delete(key);
      else novo.add(key);
      return novo;
    });
  };

  // Marca/desmarca todos os clientes visíveis na fila filtrada
  const todosVisiveisSelecionados =
    fila.length > 0 &&
    fila.every((c) => selecionados.has(String(c.cd_cliente)));

  const toggleTodosVisiveis = () => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (todosVisiveisSelecionados) {
        fila.forEach((c) => novo.delete(String(c.cd_cliente)));
      } else {
        fila.forEach((c) => novo.add(String(c.cd_cliente)));
      }
      return novo;
    });
  };

  // Clientes selecionados (objetos completos, na ordem da lista agrupada)
  const clientesSelecionados = useMemo(
    () =>
      clientesAgrupados.filter((c) => selecionados.has(String(c.cd_cliente))),
    [clientesAgrupados, selecionados],
  );

  // ============================================================
  // SMS de cobrança (DisparoPro via backend /api/sms)
  // ============================================================
  const abrirModalSms = (cliente, e) => {
    e?.stopPropagation();
    setClienteSms(cliente);
    setTextoSms(
      modo === 'ADIMPLENTES' ? MENSAGEM_SMS_URGENTE : MENSAGEM_SMS_PADRAO,
    );
    setTplLembrete(MENSAGEM_SMS_LEMBRETE);
    setModalSmsAberto(true);
  };

  const fecharModalSms = () => {
    setModalSmsAberto(false);
    setClienteSms(null);
  };

  // Texto do SMS avulso já com {VALOR} resolvido para o cliente aberto
  const textoSmsResolvido = useMemo(
    () => aplicarTemplateSms(textoSms.trim(), clienteSms),
    [textoSms, clienteSms],
  );

  // ADIMPLENTES: lembrete resolvido por fatura (cada uma vira 2 SMS:
  // lembrete + linha digitável do boleto)
  const previaLembrete = useMemo(() => {
    const vazio = {
      tipo: 'NENHUM',
      mensagens: [],
      urgentes: [],
      futuras: [],
      excedentes: [],
      acimaDoLimite: 0,
    };
    if (modo !== 'ADIMPLENTES' || !clienteSms) return vazio;

    const plano = planoSmsCliente(clienteSms, {
      urgente: textoSms.trim(),
      urgenteMulti: MENSAGEM_SMS_URGENTE_MULTI,
      lembrete: tplLembrete.trim(),
    });
    return {
      ...plano,
      // Só os textos contam: a linha digitável tem 47 dígitos fixos
      acimaDoLimite: plano.mensagens.filter(
        (m) => m.papel !== 'BOLETO' && m.texto.length > SMS_LIMITE,
      ).length,
    };
  }, [modo, clienteSms, textoSms, tplLembrete]);

  // Envia um conjunto de mensagens e devolve { enviados, rejeitados }
  const postarSms = async (mensagens) => {
    const resp = await fetch(`${API_BASE_URL}/api/sms/enviar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagens }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      // 409 = travas anti-spam recusaram tudo; 403 = fora da janela de horário
      const motivo =
        json?.details?.bloqueadas?.[0]?.motivo ||
        json?.details?.invalidas?.[0]?.motivo ||
        json?.message ||
        `HTTP ${resp.status}`;
      throw new Error(motivo);
    }
    return json?.data || { enviados: 0, rejeitados: [], bloqueadas: [] };
  };

  const enviarSms = async () => {
    if (!clienteSms) return;

    if (!clienteSms.telefone) {
      notificar('error', 'Cliente sem telefone cadastrado.');
      return;
    }

    const usuario = user?.email || user?.id || 'Usuário';
    setEnviandoSms(true);
    try {
      if (modo === 'ADIMPLENTES') {
        // ---- Plano por urgência: urgente (aviso + boletos) ou lembrete ----
        const { tipo, mensagens: plano, acimaDoLimite } = previaLembrete;
        if (plano.length === 0) {
          throw new Error(
            'Nenhuma fatura elegível: as urgentes precisam de boleto emitido.',
          );
        }
        if (acimaDoLimite > 0) {
          throw new Error(
            `${acimaDoLimite} mensagem(ns) acima de ${SMS_LIMITE} caracteres — encurte o texto.`,
          );
        }

        const {
          enviados = 0,
          rejeitados = [],
          bloqueadas = [],
        } = await postarSms(
          plano.map((m) => ({
            numero: clienteSms.telefone,
            mensagem: m.texto,
            prioridade: m.prioridade,
            cd_cliente: clienteSms.cd_cliente,
            nm_cliente: clienteSms.nm_cliente,
            parceiro_id: clienteSms.cd_cliente,
          })),
        );

        if (enviados === 0) {
          const det = rejeitados[0];
          throw new Error(
            bloqueadas[0]?.motivo ||
              (det?.descricao_detalhe
                ? `Operadora rejeitou: ${det.descricao_detalhe}`
                : 'SMS não foi aceito pela plataforma'),
          );
        }

        const faturasEnviadas =
          tipo === 'URGENTE' ? previaLembrete.urgentes : previaLembrete.futuras;
        await registrarLigacao({
          cd_cliente: clienteSms.cd_cliente,
          nm_cliente: clienteSms.nm_cliente,
          telefone: clienteSms.telefone,
          data_ligacao: hojeStr,
          status_ligacao: 'SMS_ENVIADO',
          observacao:
            tipo === 'URGENTE'
              ? `SMS vencimento: ${faturasEnviadas.length} fatura(s) + codigo(s) de barras (${enviados} SMS)`
              : `SMS lembrete: ${faturasEnviadas.length} fatura(s) a vencer, sem boleto`,
          valor_vencido: somaFaturas(faturasEnviadas),
          usuario,
        });

        marcarSmsEnviadoLocal([clienteSms]);
        fecharModalSms();
        notificar(
          rejeitados.length > 0 || bloqueadas.length > 0 ? 'warning' : 'success',
          `${enviados} SMS enviado(s)${
            bloqueadas.length ? `, ${bloqueadas.length} bloqueado(s) por trava` : ''
          }${rejeitados.length ? `, ${rejeitados.length} rejeitado(s)` : ''}!`,
          6000,
        );
        carregarSaldoSms();
      } else {
        // ---- Cobrança: 1 SMS ----
        const texto = textoSmsResolvido;
        if (!texto) throw new Error('A mensagem está vazia.');
        if (texto.length > SMS_LIMITE) {
          throw new Error(
            `Mensagem com ${texto.length} caracteres (máx. ${SMS_LIMITE}).`,
          );
        }

        const { enviados = 0, rejeitados = [] } = await postarSms([
          {
            numero: clienteSms.telefone,
            mensagem: texto,
            prioridade: 'NORMAL',
            cd_cliente: clienteSms.cd_cliente,
            nm_cliente: clienteSms.nm_cliente,
            parceiro_id: clienteSms.cd_cliente,
          },
        ]);
        if (enviados === 0) {
          const det = rejeitados[0];
          throw new Error(
            det?.descricao_detalhe
              ? `Operadora rejeitou: ${det.descricao_detalhe}`
              : 'SMS não foi aceito pela plataforma',
          );
        }

        await registrarLigacao({
          cd_cliente: clienteSms.cd_cliente,
          nm_cliente: clienteSms.nm_cliente,
          telefone: clienteSms.telefone,
          data_ligacao: hojeStr,
          status_ligacao: 'SMS_ENVIADO',
          observacao: `SMS: ${texto}`,
          valor_vencido: clienteSms.valor_total,
          usuario,
        });

        marcarSmsEnviadoLocal([clienteSms]);
        fecharModalSms();
        notificar('success', 'SMS enviado com sucesso!');
        carregarSaldoSms();
      }
    } catch (err) {
      notificar('error', `Erro ao enviar SMS: ${err.message}`, 5000);
    } finally {
      setEnviandoSms(false);
    }
  };

  // ============================================================
  // SMS em massa (mesmo template para todos os selecionados)
  // ============================================================
  const abrirModalSmsLote = () => {
    setTextoSmsLote(
      modo === 'ADIMPLENTES' ? MENSAGEM_SMS_LEMBRETE : MENSAGEM_SMS_PADRAO,
    );
    setTplUrgente(MENSAGEM_SMS_URGENTE);
    setModalSmsLoteAberto(true);
  };

  const fecharModalSmsLote = () => setModalSmsLoteAberto(false);

  // Prévia do lote: mensagens resolvidas por cliente + validação de tamanho
  const previaLote = useMemo(() => {
    // Só entram números que a DisparoPro aceita: fixo e telefone incompleto
    // são barrados aqui, antes de gastar crédito
    const comTelefone = clientesSelecionados.filter((c) => numeroSms(c.telefone));
    const semTelefone = clientesSelecionados.length - comTelefone.length;

    if (modo === 'ADIMPLENTES') {
      // Um plano por CLIENTE (não por fatura): urgente = aviso + boletos,
      // futuro = 1 lembrete sem boleto. Teto de 3 SMS por cliente.
      const planos = comTelefone
        .map((c) => ({
          cliente: c,
          plano: planoSmsCliente(c, {
            urgente: tplUrgente.trim(),
            urgenteMulti: MENSAGEM_SMS_URGENTE_MULTI,
            lembrete: textoSmsLote.trim(),
          }),
        }))
        .filter((p) => p.plano.mensagens.length > 0);

      const urgentes = planos.filter((p) => p.plano.tipo === 'URGENTE');
      const lembretes = planos.filter((p) => p.plano.tipo === 'LEMBRETE');
      const semNada = comTelefone.length - planos.length;
      const totalSms = planos.reduce(
        (s, p) => s + p.plano.mensagens.length,
        0,
      );

      const textos = planos.flatMap((p) =>
        p.plano.mensagens.filter((m) => m.papel !== 'BOLETO'),
      );
      const maisLonga = textos.reduce(
        (max, m) => (m.texto.length > max.texto.length ? m : max),
        { texto: '' },
      );

      return {
        mensagens: planos,
        semTelefone,
        semBoleto: semNada,
        qtdUrgentes: urgentes.length,
        qtdLembretes: lembretes.length,
        excedentes: planos.reduce(
          (s, p) => s + p.plano.excedentes.length,
          0,
        ),
        maisLonga,
        acimaDoLimite: textos.filter((m) => m.texto.length > SMS_LIMITE).length,
        totalSms,
      };
    }

    const mensagens = comTelefone.map((c) => ({
      cliente: c,
      texto: aplicarTemplateSms(textoSmsLote.trim(), c),
    }));
    const maisLonga = mensagens.reduce(
      (max, m) => (m.texto.length > max.texto.length ? m : max),
      { texto: '' },
    );
    const acimaDoLimite = mensagens.filter(
      (m) => m.texto.length > SMS_LIMITE,
    ).length;
    return {
      mensagens,
      semTelefone,
      semBoleto: 0,
      qtdUrgentes: 0,
      qtdLembretes: 0,
      excedentes: 0,
      maisLonga,
      acimaDoLimite,
      totalSms: mensagens.length,
    };
  }, [clientesSelecionados, textoSmsLote, tplUrgente, modo]);

  const enviarSmsLote = async () => {
    const { mensagens, acimaDoLimite } = previaLote;

    if (mensagens.length === 0) {
      notificar(
        'error',
        modo === 'ADIMPLENTES'
          ? 'Nenhuma fatura com boleto entre os selecionados.'
          : 'Nenhum cliente selecionado com telefone válido.',
      );
      return;
    }
    if (acimaDoLimite > 0) {
      notificar(
        'error',
        `${acimaDoLimite} mensagem(ns) acima de ${SMS_LIMITE} caracteres — encurte o texto.`,
      );
      return;
    }

    setEnviandoSmsLote(true);
    const usuario = user?.email || user?.id || 'Usuário';
    let totalEnviados = 0;
    const falhas = [];
    const enviadosClientes = [];

    try {
      // Backend aceita no máximo 50 mensagens por requisição. No modo
      // adimplente cada cliente pode gerar até 3 SMS — 15 clientes por bloco
      // garante que o plano de um cliente nunca é partido entre requisições.
      const porBloco = modo === 'ADIMPLENTES' ? 15 : 50;

      for (let i = 0; i < mensagens.length; i += porBloco) {
        const bloco = mensagens.slice(i, i + porBloco);
        const payload =
          modo === 'ADIMPLENTES'
            ? bloco.flatMap((p) =>
                p.plano.mensagens.map((m) => ({
                  numero: p.cliente.telefone,
                  mensagem: m.texto,
                  prioridade: m.prioridade,
                  cd_cliente: p.cliente.cd_cliente,
                  nm_cliente: p.cliente.nm_cliente,
                  parceiro_id: p.cliente.cd_cliente,
                })),
              )
            : bloco.map((m) => ({
                numero: m.cliente.telefone,
                mensagem: m.texto,
                prioridade: 'NORMAL',
                cd_cliente: m.cliente.cd_cliente,
                nm_cliente: m.cliente.nm_cliente,
                parceiro_id: m.cliente.cd_cliente,
              }));

        let data;
        try {
          data = await postarSms(payload);
        } catch (err) {
          bloco.forEach((m) =>
            falhas.push({ cliente: m.cliente, motivo: err.message }),
          );
          continue;
        }

        const detalhe = data?.detalhe || [];
        const bloqueadas = data?.bloqueadas || [];
        // Casa a resposta (numero normalizado 55...) com o item do bloco.
        // Um mesmo número aparece várias vezes no modo adimplente — o
        // sucesso é avaliado pelo conjunto de respostas daquele número.
        const avaliar = (cliente) => {
          const digitos = numeroSms(cliente.telefone) || '';
          const dets = detalhe.filter((d) => String(d.numero) === digitos);
          const trava = bloqueadas.find((b) => String(b.numero) === digitos);
          const ok =
            dets.length > 0 &&
            dets.every((d) => ['02', '03'].includes(String(d.codigo_status)));
          return { ok, dets, trava };
        };

        bloco.forEach((m) => {
          const { ok, dets, trava } = avaliar(m.cliente);
          if (ok) {
            totalEnviados += 1;
            enviadosClientes.push(m.cliente);
          } else {
            falhas.push({
              cliente: m.cliente,
              motivo:
                trava?.motivo ||
                dets.find(
                  (d) => !['02', '03'].includes(String(d.codigo_status)),
                )?.descricao_detalhe ||
                'Rejeitado pela plataforma',
            });
          }
        });

        // Registrar histórico dos aceitos deste bloco
        await Promise.all(
          bloco
            .filter((m) => avaliar(m.cliente).ok)
            .map((m) => {
              const faturas =
                modo === 'ADIMPLENTES'
                  ? m.plano.tipo === 'URGENTE'
                    ? m.plano.urgentes
                    : m.plano.futuras
                  : [];
              return registrarLigacao({
                cd_cliente: m.cliente.cd_cliente,
                nm_cliente: m.cliente.nm_cliente,
                telefone: m.cliente.telefone,
                data_ligacao: hojeStr,
                status_ligacao: 'SMS_ENVIADO',
                observacao:
                  modo === 'ADIMPLENTES'
                    ? m.plano.tipo === 'URGENTE'
                      ? `SMS vencimento (lote): ${faturas.length} fatura(s) + codigo(s) de barras`
                      : `SMS lembrete (lote): ${faturas.length} fatura(s) a vencer, sem boleto`
                    : `SMS (lote): ${m.texto}`,
                valor_vencido:
                  modo === 'ADIMPLENTES'
                    ? somaFaturas(faturas)
                    : m.cliente.valor_total,
                usuario,
              });
            }),
        );
      }

      if (totalEnviados > 0) {
        marcarSmsEnviadoLocal(enviadosClientes);
        fecharModalSmsLote();
        setSelecionados(new Set());
        carregarSaldoSms();
      }

      const rotulo = modo === 'ADIMPLENTES' ? 'lembrete(s)' : 'SMS';
      if (falhas.length === 0) {
        notificar('success', `${totalEnviados} ${rotulo} enviados com sucesso!`);
      } else {
        notificar(
          totalEnviados > 0 ? 'warning' : 'error',
          `${totalEnviados} enviado(s), ${falhas.length} falha(s). Ex.: ${falhas[0].cliente.nm_cliente}: ${falhas[0].motivo}`,
          8000,
        );
      }
    } catch (err) {
      notificar('error', `Erro no disparo em massa: ${err.message}`, 6000);
    } finally {
      setEnviandoSmsLote(false);
    }
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
          title={
            cliente.telefone && !numeroSms(cliente.telefone)
              ? normalizarCelularSms(cliente.telefone).motivo
              : undefined
          }
        >
          {cliente.telefone
            ? formatarTelefone(cliente.telefone)
            : 'sem telefone'}
          {cliente.telefone && !numeroSms(cliente.telefone) && (
            <span className="ml-1 text-orange-600" title="Não recebe SMS">
              ⚠
            </span>
          )}
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

  // Botão SMS: abre o modal de disparo (DisparoPro). Cinza quando sem
  // telefone — ou, no modo adimplente, sem boleto emitido.
  const renderBotaoSms = (cliente, { full = false } = {}) => {
    const cel = normalizarCelularSms(cliente.telefone);
    const temTelefone = !!cel.numero;
    const temBoleto =
      modo !== 'ADIMPLENTES' ||
      planoSmsCliente(cliente, templatesSms).mensagens.length > 0;
    const habilitado = temTelefone && temBoleto;
    return (
      <button
        onClick={(e) =>
          habilitado ? abrirModalSms(cliente, e) : e.stopPropagation()
        }
        disabled={!habilitado}
        className={`text-white text-xs font-semibold px-3 py-2 rounded transition-colors flex items-center justify-center gap-1 ${
          full ? 'flex-1' : ''
        } ${
          habilitado
            ? 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
        title={
          !temTelefone
            ? `Não recebe SMS: ${cel.motivo}`
            : !temBoleto
              ? 'Nenhuma fatura elegível (vencendo hoje/amanhã precisa de boleto)'
              : modo === 'ADIMPLENTES'
                ? `Enviar lembrete + código de barras para ${formatarTelefone(cliente.telefone)}`
                : `Enviar SMS de cobrança para ${formatarTelefone(cliente.telefone)}`
        }
      >
        <ChatText size={14} weight="bold" />
        SMS
      </button>
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
        cliente.situacao === 'A VENCER'
          ? 'bg-blue-100 text-blue-800'
          : cliente.situacao === 'INADIMPLENTE'
            ? 'bg-red-100 text-red-800'
            : 'bg-yellow-100 text-yellow-800'
      }`}
    >
      {cliente.situacao}
    </span>
  );

  // Data do último SMS enviado ao cliente (derivada do histórico)
  const renderUltimoSms = (cliente) =>
    cliente.ultimo_sms ? (
      <div className="flex items-center gap-1">
        <span className="text-xs font-semibold px-2 py-1 rounded bg-teal-100 text-teal-800">
          {formatarData(cliente.ultimo_sms)}
        </span>
        {cliente.ultimo_sms === hojeStr && (
          <span className="text-[10px] font-bold text-teal-700">hoje</span>
        )}
      </div>
    ) : (
      <span className="text-xs text-gray-400">nunca</span>
    );

  // Texto auxiliar sob a situação (atraso ou proximidade do vencimento)
  const legendaSituacao = (cliente) =>
    modo === 'ADIMPLENTES'
      ? cliente.diasParaVencer === 0
        ? 'vence hoje'
        : `vence em ${cliente.diasParaVencer} dia${cliente.diasParaVencer !== 1 ? 's' : ''}`
      : `${cliente.diasAtrasoMax} dia${cliente.diasAtrasoMax !== 1 ? 's' : ''} de atraso`;

  return (
    <div className="w-full max-w-[1600px] mx-auto py-4 px-3 sm:py-6 sm:px-4 space-y-4 sm:space-y-6">
      <PageTitle
        title="Call Center"
        subtitle="Cobrança de vencidos e lembretes de vencimento dos clientes Multimarcas — ligações e SMS em um só lugar"
        icon={Headset}
        iconColor="text-blue-600"
      />

      {/* Toggle INADIMPLENTES / ADIMPLENTES */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: 'INADIMPLENTES', label: 'Inadimplentes', Icone: Warning },
          { id: 'ADIMPLENTES', label: 'Adimplentes', Icone: CalendarBlank },
        ].map(({ id, label, Icone }) => (
          <button
            key={id}
            onClick={() => trocarModo(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-colors shadow-md ${
              modo === id
                ? 'bg-[#000638] text-white'
                : 'bg-white text-[#000638] border border-[#000638]/30 hover:bg-gray-50'
            }`}
          >
            {carregandoModo[id] ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <Icone size={16} weight="bold" />
            )}
            {label}
            {/* Bolinha = aba já carregada, troca instantânea */}
            {cachePorModo[id] && !carregandoModo[id] && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  modo === id ? 'bg-green-400' : 'bg-green-500'
                }`}
                title="Dados já carregados"
              />
            )}
          </button>
        ))}

        {cacheAtual?.carregadoEm && (
          <span className="text-[11px] text-gray-500 ml-1">
            atualizado às{' '}
            {cacheAtual.carregadoEm.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
        {cacheDesatualizado && (
          <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
            filtros alterados — clique em Carregar Fila
          </span>
        )}
      </div>

      {/* Filtros de consulta */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchDados(modo, { forcar: true });
          }}
        >
          <div className="text-sm font-semibold text-[#000638] mb-2">
            Configurações da fila de ligações
          </div>
          <span className="text-xs text-gray-500 mt-1">
            {modo === 'ADIMPLENTES'
              ? 'Clientes com faturas a vencer de hoje até 7 dias — lembrete com código de barras'
              : 'Base de clientes com títulos vencidos (mesma origem da Inadimplência Multimarcas)'}
          </span>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-3 mt-4">
            {modo === 'INADIMPLENTES' ? (
              <>
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
              </>
            ) : (
              <div className="col-span-2 flex items-center gap-2 text-xs text-[#000638] bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <CalendarBlank size={14} weight="bold" />
                Janela fixa: vencimentos de <b>hoje</b> até <b>+7 dias</b>
              </div>
            )}
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
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
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
              {modo === 'ADIMPLENTES'
                ? 'Com faturas a vencer (7 dias)'
                : 'Com títulos vencidos'}
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-xl bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CurrencyDollar
                size={18}
                className={
                  modo === 'ADIMPLENTES' ? 'text-orange-600' : 'text-red-600'
                }
              />
              <CardTitle className="text-sm font-bold text-[#000638]">
                {modo === 'ADIMPLENTES' ? 'Valor a Vencer' : 'Valor Vencido'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div
              className={`text-base font-extrabold mb-0.5 ${
                modo === 'ADIMPLENTES' ? 'text-orange-600' : 'text-red-600'
              }`}
            >
              {formatarMoeda(metricas.valorTotal)}
            </div>
            <CardDescription className="text-xs text-gray-500">
              {modo === 'ADIMPLENTES' ? 'Próximos 7 dias' : 'Total da fila'}
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

        {/* Saldo DisparoPro (créditos de SMS) */}
        <Card
          className="shadow-lg rounded-xl bg-white cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
          onClick={carregarSaldoSms}
          title="Clique para atualizar o saldo"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ChatText
                size={18}
                className={saldoNegativo ? 'text-red-600' : 'text-teal-600'}
              />
              <CardTitle className="text-sm font-bold text-[#000638]">
                Saldo SMS
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div
              className={`text-base font-extrabold mb-0.5 ${
                saldoNegativo ? 'text-red-600' : 'text-teal-600'
              }`}
            >
              {saldoSms != null ? `R$ ${saldoSms}` : '---'}
            </div>
            <CardDescription className="text-xs text-gray-500">
              {saldoSms == null
                ? 'DisparoPro indisponível'
                : saldoNegativo
                  ? 'Recarregue para enviar SMS'
                  : 'Créditos DisparoPro'}
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
              {saldoSms != null && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    String(saldoSms).trim().startsWith('-')
                      ? 'bg-red-100 text-red-700'
                      : 'bg-teal-100 text-teal-700'
                  }`}
                  title="Saldo de créditos SMS (DisparoPro)"
                >
                  Saldo SMS: R$ {saldoSms}
                </span>
              )}
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

              {modo === 'INADIMPLENTES' && (
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
              )}

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
                <option value="SEM_SMS_POSSIVEL">Telefone não recebe SMS</option>
                <option value="SEM_SMS">Nunca receberam SMS</option>
                <option value="SMS_HOJE">SMS enviado hoje</option>
              </select>

              <button
                onClick={abrirModalFalhas}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-orange-600 text-white text-xs font-medium rounded hover:bg-orange-700 transition-colors"
                title="SMS que não chegaram e o motivo"
              >
                <Warning size={14} weight="bold" />
                Falhas SMS
              </button>
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
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={todosVisiveisSelecionados}
                        onChange={toggleTodosVisiveis}
                        className="w-4 h-4 accent-[#000638] cursor-pointer"
                        title="Selecionar todos os clientes filtrados"
                      />
                    </th>
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
                        {modo === 'ADIMPLENTES' ? 'Valor a Vencer' : 'Valor Vencido'}
                        <SetaOrdenacao coluna="valor_total" />
                      </div>
                    </th>
                    {modo === 'INADIMPLENTES' && (
                      <th
                        className="px-3 py-3 cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => ordenarColuna('valor_a_vencer')}
                      >
                        <div className="flex items-center gap-1">
                          A Vencer
                          <SetaOrdenacao coluna="valor_a_vencer" />
                        </div>
                      </th>
                    )}
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
                      onClick={() => ordenarColuna('ultimo_sms')}
                    >
                      <div className="flex items-center gap-1">
                        Último SMS
                        <SetaOrdenacao coluna="ultimo_sms" />
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
                        colSpan={modo === 'INADIMPLENTES' ? 13 : 12}
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
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selecionados.has(String(cliente.cd_cliente))}
                            onChange={() => toggleSelecionado(cliente.cd_cliente)}
                            className="w-4 h-4 accent-[#000638] cursor-pointer"
                          />
                        </td>
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
                        <td
                          className={`px-3 py-3 font-medium ${
                            modo === 'ADIMPLENTES'
                              ? 'text-orange-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatarMoeda(cliente.valor_total)}
                        </td>
                        {modo === 'INADIMPLENTES' && (
                          <td className="px-3 py-3 font-medium text-orange-600">
                            {formatarMoeda(cliente.valor_a_vencer)}
                          </td>
                        )}
                        <td className="px-3 py-3">
                          {renderSituacao(cliente)}
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {legendaSituacao(cliente)}
                          </div>
                        </td>

                        {/* Data da última ligação (editável direto na linha) */}
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderUltimaLigacao(cliente)}
                        </td>

                        <td className="px-3 py-3">{renderUltimoSms(cliente)}</td>

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
                            {renderBotaoSms(cliente)}
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
                {fila.length > 0 && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#000638] px-1 py-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={todosVisiveisSelecionados}
                      onChange={toggleTodosVisiveis}
                      className="w-4 h-4 accent-[#000638]"
                    />
                    Selecionar todos ({fila.length})
                  </label>
                )}
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
                        <input
                          type="checkbox"
                          checked={selecionados.has(String(cliente.cd_cliente))}
                          onChange={() => toggleSelecionado(cliente.cd_cliente)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 accent-[#000638] shrink-0 mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
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
                            {legendaSituacao(cliente)}
                          </div>
                        </div>
                      </div>

                      {/* Valores */}
                      <div
                        className="grid grid-cols-2 gap-2 mt-3 cursor-pointer"
                        onClick={() => abrirModalTitulos(cliente)}
                      >
                        {modo === 'ADIMPLENTES' ? (
                          <>
                            <div className="bg-orange-50 rounded-lg px-2 py-1.5">
                              <div className="text-[10px] uppercase text-orange-700 font-semibold">
                                A vencer (7d)
                              </div>
                              <div className="text-sm font-bold text-orange-600">
                                {formatarMoeda(cliente.valor_total)}
                              </div>
                            </div>
                            <div className="bg-blue-50 rounded-lg px-2 py-1.5">
                              <div className="text-[10px] uppercase text-blue-700 font-semibold">
                                SMS previstos
                              </div>
                              <div className="text-sm font-bold text-blue-600">
                                {
                                  planoSmsCliente(cliente, templatesSms)
                                    .mensagens.length
                                }
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>

                      {/* Telefone */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-semibold text-gray-500 shrink-0">
                          Telefone
                        </span>
                        {renderTelefone(cliente)}
                      </div>

                      {/* Última ligação + último SMS + resultado */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-gray-500 mb-1">
                            Última ligação
                          </div>
                          {renderUltimaLigacao(cliente)}
                          <div className="text-[10px] uppercase font-semibold text-gray-500 mt-2 mb-1">
                            Último SMS
                          </div>
                          {renderUltimoSms(cliente)}
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
                        {renderBotaoSms(cliente, { full: true })}
                        <button
                          onClick={(e) => abrirModalHistorico(cliente, e)}
                          className="bg-[#000638] hover:bg-[#fe0000] text-white text-xs font-semibold px-3 py-2 rounded transition-colors flex items-center gap-1"
                          title="Histórico de ligações"
                        >
                          <ClockClockwise size={14} weight="bold" />
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
                <span
                  className={`font-bold ${
                    modo === 'ADIMPLENTES' ? 'text-orange-600' : 'text-red-600'
                  }`}
                >
                  {formatarMoeda(clienteLigacao.valor_total)}
                </span>{' '}
                <span className="text-gray-500">
                  {modo === 'ADIMPLENTES' ? 'a vencer' : 'vencido'} em{' '}
                  {clienteLigacao.faturas.length} título
                  {clienteLigacao.faturas.length !== 1 ? 's' : ''} ·{' '}
                  {legendaSituacao(clienteLigacao)}
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

      {/* Barra flutuante: disparo em massa */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#000638] text-white rounded-full shadow-2xl px-4 py-2.5">
          <span className="text-xs font-bold whitespace-nowrap">
            {selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}
          </span>
          {/* Previsão de consumo antes de abrir o modal */}
          <span className="text-[11px] font-semibold text-white/80 whitespace-nowrap">
            ≈ {previaLote.totalSms} crédito
            {previaLote.totalSms !== 1 ? 's' : ''}
          </span>
          <button
            onClick={abrirModalSmsLote}
            className="bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <ChatText size={14} weight="bold" />
            Enviar SMS
          </button>
          <button
            onClick={() => setSelecionados(new Set())}
            className="text-white/70 hover:text-white transition-colors"
            title="Limpar seleção"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      )}

      {/* Modal: Falhas de SMS */}
      {modalFalhasAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[92vh] overflow-hidden mx-2 sm:mx-4 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Warning size={24} weight="bold" className="text-orange-600" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  SMS que não chegaram — últimos 7 dias
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={carregarFalhas}
                  disabled={loadingFalhas}
                  className="text-gray-400 hover:text-[#000638] transition-colors disabled:opacity-50"
                  title="Recarregar"
                >
                  <ClockClockwise size={18} weight="bold" />
                </button>
                <button
                  onClick={() => setModalFalhasAberto(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={22} weight="bold" />
                </button>
              </div>
            </div>

            {/* Resumo por motivo */}
            {Object.keys(resumoFalhas).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(resumoFalhas)
                  .sort((a, b) => b[1] - a[1])
                  .map(([motivo, qtd]) => (
                    <span
                      key={motivo}
                      className="text-xs font-semibold bg-orange-50 text-orange-800 border border-orange-200 rounded px-2 py-1"
                    >
                      {qtd}× {motivo}
                    </span>
                  ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-3 min-h-[240px]">
              {loadingFalhas ? (
                <div className="flex justify-center items-center py-8">
                  <CircleNotch
                    size={32}
                    className="animate-spin text-[#000638]"
                  />
                </div>
              ) : erroFalhas ? (
                <div className="text-center py-8 text-sm text-red-700">
                  <Warning size={40} className="mx-auto mb-2 opacity-60" />
                  {erroFalhas}
                </div>
              ) : falhasSms.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle size={44} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Nenhuma falha registrada nos últimos 7 dias
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-gray-700 uppercase bg-gray-100">
                      <tr>
                        <th className="px-2 py-2">Quando</th>
                        <th className="px-2 py-2">Cliente</th>
                        <th className="px-2 py-2">Número</th>
                        <th className="px-2 py-2">Tipo</th>
                        <th className="px-2 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {falhasSms.map((f) => (
                        <tr key={f.id} className="border-b bg-white">
                          <td className="px-2 py-2 whitespace-nowrap text-gray-600">
                            {new Date(f.enviado_em).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-2 py-2">
                            <div className="font-semibold text-[#000638]">
                              {f.nm_cliente || '---'}
                            </div>
                            {f.cd_cliente && (
                              <div className="text-[10px] text-gray-500">
                                #{f.cd_cliente}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {formatarTelefone(
                              String(f.numero || '').replace(/^55/, ''),
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`font-semibold px-1.5 py-0.5 rounded ${
                                f.status === 'INVALIDO'
                                  ? 'bg-orange-100 text-orange-800'
                                  : f.status === 'BLOQUEADO'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {f.status}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-gray-700">
                            {f.motivo || '---'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-[11px] text-gray-500 mt-2">
              <b>INVALIDO</b>: número recusado antes de sair (não gasta
              crédito). <b>BLOQUEADO</b>: barrado pelo teto diário ou cooldown.{' '}
              <b>REJEITADO</b>: a operadora não aceitou.
            </p>
          </div>
        </div>
      )}

      {/* Modal: SMS em massa */}
      {modalSmsLoteAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-lg w-full max-h-[92vh] overflow-y-auto mx-2 sm:mx-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ChatText size={24} weight="bold" className="text-teal-600" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  SMS em Massa
                </h3>
              </div>
              <button
                onClick={fecharModalSmsLote}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-700 space-y-1">
              {modo === 'ADIMPLENTES' ? (
                <div>
                  <span className="font-bold text-[#000638]">
                    {previaLote.mensagens.length}
                  </span>{' '}
                  cliente{previaLote.mensagens.length !== 1 ? 's' : ''} ={' '}
                  <span className="font-bold text-[#000638]">
                    {previaLote.totalSms} crédito
                    {previaLote.totalSms !== 1 ? 's' : ''}
                  </span>
                  <div className="mt-1 text-[11px] text-gray-600">
                    {previaLote.qtdUrgentes} vencendo hoje/amanhã (aviso +
                    código de barras) · {previaLote.qtdLembretes} só lembrete
                    (2 a 7 dias, sem boleto)
                  </div>
                </div>
              ) : (
                <div>
                  <span className="font-bold text-[#000638]">
                    {previaLote.mensagens.length}
                  </span>{' '}
                  cliente{previaLote.mensagens.length !== 1 ? 's' : ''} com
                  telefone recebera
                  {previaLote.mensagens.length !== 1 ? 'ão' : ''} o SMS
                </div>
              )}
              {previaLote.semTelefone > 0 && (
                <div className="text-orange-700">
                  ⚠ {previaLote.semTelefone} selecionado
                  {previaLote.semTelefone !== 1 ? 's' : ''} sem telefone será
                  {previaLote.semTelefone !== 1 ? 'ão' : ''} ignorado
                  {previaLote.semTelefone !== 1 ? 's' : ''}
                </div>
              )}
              {previaLote.semBoleto > 0 && (
                <div className="text-orange-700">
                  ⚠ {previaLote.semBoleto} cliente
                  {previaLote.semBoleto !== 1 ? 's' : ''} sem fatura elegível
                  será{previaLote.semBoleto !== 1 ? 'ão' : ''} ignorado
                  {previaLote.semBoleto !== 1 ? 's' : ''}
                </div>
              )}
              {previaLote.excedentes > 0 && (
                <div className="text-orange-700">
                  ⚠ {previaLote.excedentes} boleto
                  {previaLote.excedentes !== 1 ? 's' : ''} além do teto de{' '}
                  {TETO_SMS_CLIENTE} SMS/cliente — envie pelo WhatsApp
                </div>
              )}
            </div>

            {modo === 'ADIMPLENTES' && (
              <>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Aviso de vencimento — hoje/amanhã (use {'{NOME}'},{' '}
                  {'{VALOR}'}, {'{VENCIMENTO}'}, {'{NOTA}'})
                </label>
                <textarea
                  value={tplUrgente}
                  onChange={(e) => setTplUrgente(e.target.value)}
                  rows={3}
                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#000638] resize-none mb-3"
                />
              </>
            )}

            <label className="block text-xs font-semibold mb-1 text-[#000638]">
              {modo === 'ADIMPLENTES'
                ? `Lembrete — 2 a 7 dias, sem boleto (use {NOME}, {QTD}, {DATAS}, {TOTAL})`
                : 'Mensagem (use {VALOR} para o total vencido de cada cliente)'}
            </label>
            <textarea
              value={textoSmsLote}
              onChange={(e) => setTextoSmsLote(e.target.value)}
              rows={4}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#000638] resize-none"
            />
            <div
              className={`text-[11px] mt-1 text-right font-semibold ${
                previaLote.acimaDoLimite > 0 ? 'text-red-600' : 'text-gray-500'
              }`}
            >
              {previaLote.acimaDoLimite > 0
                ? `${previaLote.acimaDoLimite} mensagem(ns) passam de ${SMS_LIMITE} caracteres — encurte o texto`
                : `maior mensagem: ${previaLote.maisLonga.texto.length}/${SMS_LIMITE} caracteres · ${previaLote.totalSms} crédito${previaLote.totalSms !== 1 ? 's' : ''}`}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Máximo de {SMS_LIMITE} caracteres por SMS. Evite acentos: fora do
              padrão GSM eles reduzem o limite para 70.
              {modo === 'ADIMPLENTES' &&
                ' Se a fatura não tiver NF, o trecho "ref. NF {NOTA}" é removido automaticamente.'}
            </p>

            {previaLote.mensagens.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-[#000638] mb-1">
                  Prévia ({previaLote.mensagens[0].cliente.nm_cliente}):
                </div>
                {modo === 'ADIMPLENTES' ? (
                  previaLote.mensagens[0].plano.mensagens.map((m, idx) => (
                    <div
                      key={idx}
                      className={`bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-xs text-gray-800 ${
                        idx > 0 ? 'mt-1' : ''
                      } ${m.papel === 'BOLETO' ? 'break-all' : 'whitespace-pre-wrap'}`}
                    >
                      <span className="font-bold text-teal-700">
                        SMS {idx + 1}
                        {m.papel === 'BOLETO' ? ' (boleto)' : ''}:
                      </span>{' '}
                      {m.texto}
                    </div>
                  ))
                ) : (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-xs text-gray-800 whitespace-pre-wrap">
                    {previaLote.mensagens[0].texto}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
              <button
                onClick={fecharModalSmsLote}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={enviarSmsLote}
                disabled={
                  enviandoSmsLote ||
                  previaLote.mensagens.length === 0 ||
                  previaLote.acimaDoLimite > 0 ||
                  !textoSmsLote.trim()
                }
                className="px-4 py-2 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {enviandoSmsLote ? (
                  <>
                    <CircleNotch size={16} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <ChatText size={16} weight="bold" />
                    {modo === 'ADIMPLENTES'
                      ? `Enviar ${previaLote.totalSms} SMS`
                      : `Enviar para ${previaLote.mensagens.length} cliente${previaLote.mensagens.length !== 1 ? 's' : ''}`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enviar SMS */}
      {modalSmsAberto && clienteSms && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-lg w-full max-h-[92vh] overflow-y-auto mx-2 sm:mx-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ChatText size={24} weight="bold" className="text-teal-600" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  {modo === 'ADIMPLENTES'
                    ? 'Enviar Lembrete de Vencimento'
                    : 'Enviar SMS de Cobrança'}
                </h3>
              </div>
              <button
                onClick={fecharModalSms}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-sm font-semibold text-[#000638]">
                {clienteSms.nm_cliente}
              </div>
              <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                <Phone size={12} />
                {formatarTelefone(clienteSms.telefone)}
              </div>
              <div className="text-xs mt-1">
                <span
                  className={`font-bold ${
                    modo === 'ADIMPLENTES' ? 'text-orange-600' : 'text-red-600'
                  }`}
                >
                  {formatarMoeda(clienteSms.valor_total)}
                </span>{' '}
                <span className="text-gray-500">
                  {modo === 'ADIMPLENTES'
                    ? `a vencer · ${legendaSituacao(clienteSms)}`
                    : `vencido · ${clienteSms.diasAtrasoMax} dias de atraso`}
                </span>
              </div>
              {String(clienteSms.telefone || '').replace(/\D/g, '').length !==
                11 && (
                <div className="text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-2">
                  ⚠ Este número pode não ser um celular — SMS só chega em
                  celulares.
                </div>
              )}
            </div>

            {modo === 'ADIMPLENTES' && (
              <div
                className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
                  previaLembrete.tipo === 'URGENTE'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : previaLembrete.tipo === 'LEMBRETE'
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                {previaLembrete.tipo === 'URGENTE' && (
                  <>
                    <b>Vence hoje/amanhã</b> — vai aviso + código de barras (
                    {previaLembrete.mensagens.length} SMS)
                  </>
                )}
                {previaLembrete.tipo === 'LEMBRETE' && (
                  <>
                    <b>Vence em 2 a 7 dias</b> — vai só o lembrete, sem código
                    de barras (1 SMS). O boleto sai quando faltar 1 dia.
                  </>
                )}
                {previaLembrete.tipo === 'NENHUM' &&
                  'Nenhuma fatura elegível: as que vencem hoje/amanhã precisam de boleto emitido.'}
              </div>
            )}

            <label className="block text-xs font-semibold mb-1 text-[#000638]">
              {modo === 'ADIMPLENTES'
                ? previaLembrete.tipo === 'LEMBRETE'
                  ? 'Lembrete (use {NOME}, {QTD}, {DATAS} e {TOTAL})'
                  : 'Aviso de vencimento (use {NOME}, {VALOR}, {VENCIMENTO} e {NOTA})'
                : 'Mensagem (use {VALOR} para o total vencido)'}
            </label>
            <textarea
              value={
                modo === 'ADIMPLENTES' && previaLembrete.tipo === 'LEMBRETE'
                  ? tplLembrete
                  : textoSms
              }
              onChange={(e) =>
                modo === 'ADIMPLENTES' && previaLembrete.tipo === 'LEMBRETE'
                  ? setTplLembrete(e.target.value)
                  : setTextoSms(e.target.value)
              }
              rows={4}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#000638] resize-none"
            />
            {modo === 'ADIMPLENTES' ? (
              <div
                className={`text-[11px] mt-1 text-right font-semibold ${
                  previaLembrete.acimaDoLimite > 0
                    ? 'text-red-600'
                    : 'text-gray-500'
                }`}
              >
                {previaLembrete.acimaDoLimite > 0
                  ? `mensagem passa de ${SMS_LIMITE} caracteres — encurte`
                  : `${previaLembrete.mensagens.length} SMS = ${previaLembrete.mensagens.length} crédito${previaLembrete.mensagens.length !== 1 ? 's' : ''}`}
              </div>
            ) : (
              <div
                className={`text-[11px] mt-1 text-right font-semibold ${
                  textoSmsResolvido.length > SMS_LIMITE
                    ? 'text-red-600'
                    : 'text-gray-500'
                }`}
              >
                {textoSmsResolvido.length}/{SMS_LIMITE} caracteres
              </div>
            )}
            <p className="text-[11px] text-gray-500 mt-1">
              Máximo de {SMS_LIMITE} caracteres (1 SMS). Evite acentos: fora do
              padrão GSM eles reduzem o limite para 70.
              {modo === 'ADIMPLENTES' &&
                ' Se a fatura não tiver NF, o trecho "ref. NF {NOTA}" é removido automaticamente.'}
            </p>

            {modo === 'ADIMPLENTES' ? (
              <>
                {/* Faturas contempladas */}
                <div className="mt-3">
                  <div className="text-xs font-semibold text-[#000638] mb-1">
                    {previaLembrete.tipo === 'URGENTE'
                      ? `Faturas vencendo (${previaLembrete.urgentes.length}):`
                      : `Faturas a vencer (${previaLembrete.futuras.length}):`}
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(previaLembrete.tipo === 'URGENTE'
                      ? previaLembrete.urgentes
                      : previaLembrete.futuras
                    ).map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1"
                      >
                        <span className="font-semibold text-[#000638]">
                          Fat {f.nr_fat || f.nr_fatura}
                          {f.nr_nota_fiscal
                            ? ` · NF ${f.nr_nota_fiscal}`
                            : ' · sem NF'}
                        </span>
                        <span className="text-gray-600">
                          {formatarMoeda(f.vl_fatura)} · vence{' '}
                          {dataCurtaSms(f.dt_vencimento)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {previaLembrete.excedentes.length > 0 && (
                    <div className="text-[11px] text-orange-700 mt-1">
                      ⚠ {previaLembrete.excedentes.length} boleto
                      {previaLembrete.excedentes.length !== 1 ? 's' : ''} não
                      cabe{previaLembrete.excedentes.length !== 1 ? 'm' : ''} no
                      teto de {TETO_SMS_CLIENTE} SMS/dia — envie pelo WhatsApp
                    </div>
                  )}
                </div>

                {/* Prévia de cada SMS do plano */}
                {previaLembrete.mensagens.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-[#000638] mb-1">
                      Prévia:
                    </div>
                    {previaLembrete.mensagens.map((m, idx) => (
                      <div
                        key={idx}
                        className={`bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-xs text-gray-800 ${
                          idx > 0 ? 'mt-1' : ''
                        } ${m.papel === 'BOLETO' ? 'break-all' : 'whitespace-pre-wrap'}`}
                      >
                        <span className="font-bold text-teal-700">
                          SMS {idx + 1}
                          {m.papel === 'BOLETO' ? ' (boleto)' : ''}:
                        </span>{' '}
                        {m.texto}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              textoSmsResolvido && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-[#000638] mb-1">
                    Prévia:
                  </div>
                  <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-xs text-gray-800 whitespace-pre-wrap">
                    {textoSmsResolvido}
                  </div>
                </div>
              )
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
              <button
                onClick={fecharModalSms}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={enviarSms}
                disabled={
                  enviandoSms ||
                  (modo === 'ADIMPLENTES'
                    ? previaLembrete.mensagens.length === 0 ||
                      previaLembrete.acimaDoLimite > 0
                    : !textoSmsResolvido ||
                      textoSmsResolvido.length > SMS_LIMITE)
                }
                className="px-4 py-2 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {enviandoSms ? (
                  <>
                    <CircleNotch size={16} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <ChatText size={16} weight="bold" />
                    {modo === 'ADIMPLENTES'
                      ? `Enviar ${previaLembrete.mensagens.length} SMS`
                      : 'Enviar SMS'}
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

            <p className="text-sm text-gray-600 mb-2">
              Cliente: {clienteHistorico.cd_cliente} | Valor vencido:{' '}
              {formatarMoeda(clienteHistorico.valor_total)}
            </p>

            {/* Resumo: ligações x SMS, com a data do último SMS */}
            {!loadingHistorico && historicoLigacoes.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                <span className="bg-blue-50 text-blue-800 border border-blue-200 rounded px-2 py-1 font-semibold flex items-center gap-1">
                  <PhoneCall size={12} weight="bold" />
                  {
                    historicoLigacoes.filter(
                      (l) => l.status_ligacao !== 'SMS_ENVIADO',
                    ).length
                  }{' '}
                  ligação(ões)
                </span>
                <span className="bg-teal-50 text-teal-800 border border-teal-200 rounded px-2 py-1 font-semibold flex items-center gap-1">
                  <ChatText size={12} weight="bold" />
                  {
                    historicoLigacoes.filter(
                      (l) => l.status_ligacao === 'SMS_ENVIADO',
                    ).length
                  }{' '}
                  SMS
                </span>
                {(() => {
                  // Histórico já vem ordenado por data desc
                  const ultimo = historicoLigacoes.find(
                    (l) => l.status_ligacao === 'SMS_ENVIADO',
                  );
                  return ultimo ? (
                    <span className="bg-gray-100 text-gray-700 border border-gray-200 rounded px-2 py-1 font-semibold">
                      último SMS em {formatarData(ultimo.data_ligacao)}
                    </span>
                  ) : null;
                })()}
              </div>
            )}

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
                  <p>Nenhum contato registrado para este cliente</p>
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
                            className={`text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 ${
                              statusInfo(lig.status_ligacao).cor
                            }`}
                          >
                            {lig.status_ligacao === 'SMS_ENVIADO' ? (
                              <ChatText size={12} weight="bold" />
                            ) : (
                              <PhoneCall size={12} weight="bold" />
                            )}
                            {statusInfo(lig.status_ligacao).label}
                          </span>
                          <span className="text-xs text-gray-600 flex items-center gap-1">
                            <CalendarBlank size={12} />
                            {formatarData(lig.data_ligacao)}
                            {/* SMS pode ter vários no mesmo dia — mostra a hora */}
                            {lig.status_ligacao === 'SMS_ENVIADO' &&
                              lig.data_criacao && (
                                <span className="text-gray-500">
                                  às{' '}
                                  {new Date(lig.data_criacao).toLocaleTimeString(
                                    'pt-BR',
                                    { hour: '2-digit', minute: '2-digit' },
                                  )}
                                </span>
                              )}
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
                <span className="text-gray-500">
                  {modo === 'ADIMPLENTES' ? 'A vencer (7d):' : 'Vencido:'}
                </span>{' '}
                <span
                  className={`font-semibold ${
                    modo === 'ADIMPLENTES' ? 'text-orange-600' : 'text-red-600'
                  }`}
                >
                  {formatarMoeda(clienteTitulos.valor_total)}
                </span>
              </div>
              {modo === 'INADIMPLENTES' && (
                <div>
                  <span className="text-gray-500">A vencer:</span>{' '}
                  <span className="font-semibold text-orange-600">
                    {formatarMoeda(clienteTitulos.valor_a_vencer)}
                  </span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-3 py-2">Fatura</th>
                    {modo === 'ADIMPLENTES' && (
                      <th className="px-3 py-2">NF</th>
                    )}
                    <th className="px-3 py-2">Emissão</th>
                    <th className="px-3 py-2">Vencimento</th>
                    <th className="px-3 py-2">
                      {modo === 'ADIMPLENTES' ? 'Vence em' : 'Atraso'}
                    </th>
                    {modo === 'ADIMPLENTES' && (
                      <th className="px-3 py-2">Boleto</th>
                    )}
                    <th className="px-3 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(clienteTitulos.faturas || []).map((fatura, idx) => {
                    const dias = diffEmDias(fatura.dt_vencimento);
                    const temBoleto =
                      String(fatura.linha_digitavel || '').replace(/\D/g, '')
                        .length >= 40;
                    return (
                      <tr key={idx} className="border-b">
                        <td className="px-3 py-2 font-medium">
                          {fatura.nr_fat || fatura.nr_fatura || 'N/A'}
                        </td>
                        {modo === 'ADIMPLENTES' && (
                          <td className="px-3 py-2">
                            {fatura.nr_nota_fiscal || '---'}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {formatarData(fatura.dt_emissao)}
                        </td>
                        <td className="px-3 py-2">
                          {formatarData(fatura.dt_vencimento)}
                        </td>
                        <td className="px-3 py-2">
                          {modo === 'ADIMPLENTES' ? (
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
                              {Math.max(0, -(dias ?? 0)) === 0
                                ? 'hoje'
                                : `${Math.max(0, -(dias ?? 0))} dia${Math.max(0, -(dias ?? 0)) !== 1 ? 's' : ''}`}
                            </span>
                          ) : (
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded ${
                                dias > 60
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {dias ?? 0} dias
                            </span>
                          )}
                        </td>
                        {modo === 'ADIMPLENTES' && (
                          <td className="px-3 py-2">
                            {temBoleto ? (
                              <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">
                                emitido
                              </span>
                            ) : (
                              <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-600">
                                sem boleto
                              </span>
                            )}
                          </td>
                        )}
                        <td
                          className={`px-3 py-2 text-right font-semibold ${
                            modo === 'ADIMPLENTES'
                              ? 'text-orange-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatarMoeda(fatura.vl_fatura)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td
                      colSpan={modo === 'ADIMPLENTES' ? 6 : 4}
                      className="px-3 py-2 font-bold"
                    >
                      {modo === 'ADIMPLENTES' ? 'TOTAL A VENCER' : 'TOTAL VENCIDO'}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-extrabold ${
                        modo === 'ADIMPLENTES'
                          ? 'text-orange-700'
                          : 'text-red-700'
                      }`}
                    >
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
