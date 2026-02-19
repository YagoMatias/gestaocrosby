import React, { useEffect, useState, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import PageTitle from '../components/ui/PageTitle';
import {
  Receipt,
  Funnel,
  Spinner,
  CurrencyDollar,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
  CaretUpDown,
  FileArrowDown,
  Eye,
  CheckCircle,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const TitulosClientes = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [status, setStatus] = useState('todos');
  const [cdCliente, setCdCliente] = useState('');

  // Estados para busca de clientes
  const [termoBuscaNome, setTermoBuscaNome] = useState('');
  const [termoBuscaFantasia, setTermoBuscaFantasia] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState([]);
  const [modalBuscaAberto, setModalBuscaAberto] = useState(false);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);

  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(20);

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

  // Estados para modal de observações
  const [obsModalAberto, setObsModalAberto] = useState(false);
  const [obsFatura, setObsFatura] = useState([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [boletoBase64, setBoletoBase64] = useState('');
  const [boletoLoading, setBoletoLoading] = useState(false);
  const [boletoError, setBoletoError] = useState('');
  const [faturaSelecionada, setFaturaSelecionada] = useState(null);

  // Estados para transações
  const [transacoesFatura, setTransacoesFatura] = useState([]);
  const [transacoesLoading, setTransacoesLoading] = useState(false);
  const [transacoesError, setTransacoesError] = useState('');

  // Estados para DANFE
  const [danfeLoading, setDanfeLoading] = useState(false);
  const [danfeError, setDanfeError] = useState('');

  // Estado para armazenar códigos das filiais (empresas próprias)
  const [filiaisCodigos, setFiliaisCodigos] = useState([]);

  const BaseURL = 'https://apigestaocrosby-bw2v.onrender.com/api/financial/';
  const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';
  const FranchiseURL =
    'https://apigestaocrosby-bw2v.onrender.com/api/franchise/';

  // Buscar filiais (empresas) da API TOTVS ao carregar
  useEffect(() => {
    const buscarFiliais = async () => {
      try {
        const response = await fetch(`${TotvsURL}branches`);
        if (response.ok) {
          const data = await response.json();
          // Extrair códigos das filiais (cd_empresa)
          const codigos = data
            .map((branch) => parseInt(branch.cd_empresa))
            .filter((code) => !isNaN(code) && code > 0);
          console.log('📋 Filiais carregadas:', codigos);
          setFiliaisCodigos(codigos);
        }
      } catch (error) {
        console.error('Erro ao carregar filiais:', error);
        // Fallback para filiais padrão
        setFiliaisCodigos([1, 2, 6, 100, 101, 99, 990, 200, 400, 4, 850, 85]);
      }
    };
    buscarFiliais();
  }, []);

  // Helpers de data sem fuso horário
  const parseDateNoTZ = (isoDate) => {
    if (!isoDate) return null;
    try {
      const [datePart] = String(isoDate).split('T');
      const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    } catch {
      return null;
    }
  };

  const formatDateBR = (isoDate) => {
    const d = parseDateNoTZ(isoDate);
    if (!d) return '--';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  // Função para formatar valores monetários
  const formatCurrency = (value) => {
    if (!value && value !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // CSS customizado para a tabela
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .table-container {
        overflow-x: auto;
        position: relative;
        max-width: 100%;
      }
      .extrato-table {
        border-collapse: collapse;
        width: 100%;
      }
      .extrato-table th,
      .extrato-table td {
        padding: 6px 8px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 12px;
        line-height: 1.4;
      }
      .extrato-table th:last-child,
      .extrato-table td:last-child {
        border-right: none;
      }
      .extrato-table th {
        background-color: #000638;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.05em;
      }
      .extrato-table tbody tr:nth-child(odd) {
        background-color: white;
      }
      .extrato-table tbody tr:nth-child(even) {
        background-color: #f9fafb;
      }
      .extrato-table tbody tr:hover {
        background-color: #f3f4f6;
      }
      .extrato-table thead th:first-child,
      .extrato-table tbody td:first-child {
        position: sticky;
        left: 0;
        z-index: 10;
        background-color: inherit;
      }
      .extrato-table thead th:first-child {
        background-color: #000638;
      }
      .extrato-table tbody tr:nth-child(even) td:first-child {
        background-color: #f9fafb;
      }
      .extrato-table tbody tr:nth-child(odd) td:first-child {
        background-color: white;
      }
      .extrato-table tbody tr:hover td:first-child {
        background-color: #f3f4f6;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Função para ordenação
  const handleSort = (campo) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Função para ícone de ordenação
  const getSortIcon = (campo) => {
    if (ordenacao.campo !== campo) {
      return <CaretUpDown size={12} className="opacity-50" />;
    }
    return ordenacao.direcao === 'asc' ? (
      <CaretUp size={12} />
    ) : (
      <CaretDown size={12} />
    );
  };

  // Dados processados (ordenados)
  const dadosProcessados = useMemo(() => {
    let dadosFiltrados = [...dados];

    // Aplicar ordenação
    if (ordenacao.campo) {
      dadosFiltrados.sort((a, b) => {
        let valorA = a[ordenacao.campo];
        let valorB = b[ordenacao.campo];

        // Tratamento especial para datas
        if (ordenacao.campo.includes('dt_')) {
          valorA = valorA ? new Date(valorA) : new Date(0);
          valorB = valorB ? new Date(valorB) : new Date(0);
        }

        // Tratamento especial para valores numéricos
        if (
          ordenacao.campo.includes('vl_') ||
          ordenacao.campo.includes('nr_')
        ) {
          valorA = parseFloat(valorA) || 0;
          valorB = parseFloat(valorB) || 0;
        }

        // Tratamento para strings
        if (typeof valorA === 'string') {
          valorA = valorA.toLowerCase();
          valorB = valorB.toLowerCase();
        }

        if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
        if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return dadosFiltrados;
  }, [dados, ordenacao]);

  // Dados paginados para exibição
  const dadosPaginados = useMemo(() => {
    const startIndex = (paginaAtual - 1) * itensPorPagina;
    const endIndex = startIndex + itensPorPagina;
    return dadosProcessados.slice(startIndex, endIndex);
  }, [dadosProcessados, paginaAtual, itensPorPagina]);

  // Total de páginas para paginação
  const totalPages = Math.ceil(dadosProcessados.length / itensPorPagina);

  // Busca de clientes por nome desabilitada - usar código do cliente diretamente
  const buscarClientes = () => {
    alert(
      'Busca por nome desabilitada. Use o código do cliente para consultar.',
    );
  };

  // Função para selecionar um cliente da lista
  const selecionarCliente = (cliente) => {
    setClienteSelecionado(cliente);
    setCdCliente(cliente.cd_pessoa);
    setModalBuscaAberto(false);
    console.log('✅ Cliente selecionado:', cliente);
  };

  const buscarDados = async () => {
    if (!cdCliente || cdCliente.trim() === '') {
      alert('Digite o código do cliente para consultar!');
      return;
    }

    setLoading(true);
    setPaginaAtual(1);
    try {
      const codigoCliente = parseInt(cdCliente.trim(), 10);
      if (isNaN(codigoCliente) || codigoCliente <= 0) {
        throw new Error('Código do cliente inválido');
      }

      console.log(
        `🔍 Buscando dados via TOTVS para cd_cliente: ${codigoCliente}, status: ${status}`,
      );

      // Montar filtro para API TOTVS (mesma rota que ContasPagarFranquias)
      const branchCodeList =
        filiaisCodigos.length > 0
          ? filiaisCodigos
          : [1, 2, 6, 100, 101, 99, 990, 200, 400, 4, 850, 85];
      const filter = {
        branchCodeList,
        customerCodeList: [codigoCliente],
      };

      // Filtrar por status se não for "todos"
      if (status === 'em_aberto' || status === 'vencidos') {
        filter.hasOpenInvoices = true;
        filter.dischargeTypeList = [0];
      }

      const response = await fetch(
        `${TotvsURL}accounts-receivable/search-all`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter,
            expand: 'invoice,calculateValue',
            order: '-expiredDate',
            maxPages: 20,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Resposta TOTVS accounts-receivable:', result);

      let todosOsDados = result.data?.items || [];

      // Mapear dados TOTVS para formato esperado pelo componente
      todosOsDados = todosOsDados.map((item) => ({
        ...item,
        cd_empresa: item.branchCode,
        cd_cliente: item.customerCode,
        nm_cliente:
          item.customerName ||
          item.customerCpfCnpj ||
          `Cliente ${item.customerCode}`,
        nr_cpfcnpj: item.customerCpfCnpj,
        nr_fatura: item.receivableCode,
        nr_fat: item.receivableCode,
        nr_parcela: item.installmentCode,
        dt_vencimento: item.expiredDate,
        dt_liq: item.paymentDate || item.settlementDate,
        dt_emissao: item.issueDate,
        vl_fatura: item.installmentValue,
        vl_pago: item.paidValue || 0,
        vl_liquido: item.netValue,
        vl_desconto: item.discountValue,
        vl_abatimento: item.rebateValue,
        vl_juros: item.interestValue,
        vl_multa: item.assessmentValue,
        cd_barras: item.barCode,
        linha_digitavel: item.digitableLine,
        nosso_numero: item.ourNumber,
        qr_code_pix: item.qrCodePix,
        tp_situacao: item.status,
        tp_documento: item.documentType,
        tp_faturamento: item.billingType,
        tp_baixa: item.dischargeType,
        tp_cobranca: item.chargeType,
        cd_portador: item.bearerCode,
        nm_portador: item.bearerName,
        cancelado: item.canceled,
        dias_atraso: item.calculatedValues?.daysLate,
        vl_acrescimo: item.calculatedValues?.increaseValue,
        vl_juros_calc: item.calculatedValues?.interestValue,
        vl_multa_calc: item.calculatedValues?.fineValue,
        vl_desconto_calc: item.calculatedValues?.discountValue,
        vl_corrigido: item.calculatedValues?.correctedValue,
        invoice: item.invoice,
      }));

      // Filtrar apenas FATURA + NORMAL
      todosOsDados = todosOsDados.filter((item) => {
        const isFatura =
          item.tp_documento === 'FATURA' ||
          item.tp_documento === 1 ||
          String(item.tp_documento).toUpperCase().includes('FATURA');
        const isNormal =
          item.tp_situacao === 'NORMAL' ||
          item.tp_situacao === 1 ||
          item.tp_situacao === 0 ||
          String(item.tp_situacao).toUpperCase() === 'NORMAL';
        return isFatura && isNormal;
      });

      console.log(
        `📊 Total após filtrar FATURA + NORMAL: ${todosOsDados.length}`,
      );

      // Aplicar filtro local baseado no status selecionado
      if (status !== 'todos') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        todosOsDados = todosOsDados.filter((item) => {
          const temDataLiquidacao =
            item.dt_liq && item.dt_liq !== null && item.dt_liq !== '';
          const dataVencimento = item.dt_vencimento
            ? new Date(item.dt_vencimento)
            : null;

          // Se tem data de liquidação, é PAGO
          if (temDataLiquidacao) {
            return status === 'pagos';
          }

          // Se não tem data de liquidação, aplicar lógica normal
          const valorFaturado = parseFloat(item.vl_fatura) || 0;
          const valorPago = parseFloat(item.vl_pago) || 0;
          const estaPago = valorPago >= valorFaturado && valorFaturado > 0;

          if (status === 'pagos') {
            return estaPago;
          } else if (status === 'vencidos') {
            return !estaPago && dataVencimento && dataVencimento < hoje;
          } else if (status === 'em_aberto') {
            return !estaPago && (!dataVencimento || dataVencimento >= hoje);
          }

          return true;
        });
      }

      console.log(
        `📊 Total de dados após filtro "${status}":`,
        todosOsDados.length,
      );

      setDados(todosOsDados);
      setDadosCarregados(true);
    } catch (err) {
      console.error('❌ Erro ao buscar dados:', err);
      setDados([]);
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    buscarDados();
  };

  // Função para buscar transações da fatura
  const buscarTransacoesFatura = async (fatura) => {
    setTransacoesLoading(true);
    setTransacoesError('');

    try {
      const cd_pessoa = fatura.cd_cliente || '';
      const dt_emissao = fatura.dt_emissao
        ? fatura.dt_emissao.split('T')[0]
        : '';

      if (!dt_emissao) {
        throw new Error('Data de emissão não disponível');
      }

      // Buscar faturas relacionadas (mesmo cliente, data emissão, vencimento e parcela)
      const faturasRelacionadas = dados.filter(
        (f) =>
          f.cd_cliente === fatura.cd_cliente &&
          f.dt_emissao?.split('T')[0] === dt_emissao &&
          f.dt_vencimento?.split('T')[0] ===
            fatura.dt_vencimento?.split('T')[0] &&
          f.nr_parcela === fatura.nr_parcela,
      );

      console.log('📋 Faturas relacionadas:', faturasRelacionadas);

      // Somar o valor total das faturas relacionadas
      const valorTotalFaturas = faturasRelacionadas.reduce(
        (soma, f) => soma + (parseFloat(f.vl_fatura) || 0),
        0,
      );

      console.log(
        `💰 Valor total das faturas somadas: R$ ${valorTotalFaturas.toFixed(
          2,
        )}`,
      );

      // Calcular intervalo de 30 dias
      const dataEmissao = new Date(dt_emissao + 'T00:00:00');
      const dataLimite = new Date(dataEmissao);
      dataLimite.setDate(dataLimite.getDate() + 30);
      const dt_limite = dataLimite.toISOString().split('T')[0];

      console.log('🔍 Buscando transações da fatura no intervalo de 30 dias:', {
        cd_pessoa,
        vl_total: valorTotalFaturas,
        dt_inicio: dt_emissao,
        dt_fim: dt_limite,
      });

      // Buscar todas as transações no intervalo de 30 dias
      const promises = [];
      for (let i = 0; i <= 30; i++) {
        const dataAtual = new Date(dataEmissao);
        dataAtual.setDate(dataAtual.getDate() + i);
        const dt_busca = dataAtual.toISOString().split('T')[0];

        promises.push(
          fetch(
            `${FranchiseURL}trans_fatura?cd_pessoa=${cd_pessoa}&dt_transacao=${dt_busca}&vl_transacao=${valorTotalFaturas}`,
          )
            .then((res) => res.json())
            .then((data) => {
              // Extrair transações
              let transacoes = [];
              if (data.success && data.data && data.data.data) {
                transacoes = data.data.data;
              } else if (
                data.success &&
                data.data &&
                Array.isArray(data.data)
              ) {
                transacoes = data.data;
              }
              return transacoes;
            })
            .catch(() => []),
        );
      }

      const resultados = await Promise.all(promises);
      const todasTransacoes = resultados.flat();

      console.log(
        '📊 Total de transações encontradas (brutas):',
        todasTransacoes.length,
      );
      console.log('� Transações brutas:', todasTransacoes);

      // Filtrar por empresa < 100 e valor próximo (tolerância de R$ 0.10)
      const tolerancia = 0.1;
      const transacoesFiltradas = todasTransacoes.filter((t) => {
        const valorTransacao = parseFloat(t.vl_transacao) || 0;
        const diferencaValor = Math.abs(valorTransacao - valorTotalFaturas);
        return t.cd_empresa < 100 && diferencaValor <= tolerancia;
      });

      console.log(
        `🔍 Transações filtradas (empresa<100 e valor≈${valorTotalFaturas}):`,
        transacoesFiltradas,
      );

      // Remover duplicatas baseado em nr_transacao
      const transacoesUnicas = transacoesFiltradas.filter(
        (t, index, self) =>
          index === self.findIndex((x) => x.nr_transacao === t.nr_transacao),
      );

      console.log(
        `✅ ${transacoesUnicas.length} transações únicas encontradas`,
      );

      // Lógica: Retornar transações únicas encontradas
      let transacoesFinais = [];
      if (transacoesUnicas.length > 0) {
        transacoesFinais = transacoesUnicas;
        console.log(
          `✅ ${transacoesUnicas.length} transações encontradas no intervalo de 30 dias`,
        );
      } else {
        console.log('⚠️ Nenhuma transação encontrada');
      }

      setTransacoesFatura(transacoesFinais);
    } catch (error) {
      console.error('❌ Erro ao buscar transações:', error);
      setTransacoesError(error.message || 'Erro ao buscar transações');
      setTransacoesFatura([]);
    } finally {
      setTransacoesLoading(false);
    }
  };

  // Nova função otimizada usando a rota trans-faturamento
  const buscarTransacoesFaturaOtimizada = async (fatura) => {
    setTransacoesLoading(true);
    setTransacoesError('');

    try {
      const cd_cliente = fatura.cd_cliente || '';
      const nr_fat = fatura.nr_fat || '';
      const nr_parcela = fatura.nr_parcela || '';
      const vl_fatura = fatura.vl_fatura || 0;

      if (!cd_cliente || !nr_fat || !nr_parcela) {
        throw new Error('Dados da fatura incompletos');
      }

      console.log('🔍 Buscando transações da fatura:', {
        cd_cliente,
        nr_fat,
        nr_parcela,
        vl_fatura,
      });

      // Usar a nova rota otimizada que retorna transação origem e destino
      const response = await fetch(
        `${FranchiseURL}trans_fatura?cd_cliente=${cd_cliente}&nr_fat=${nr_fat}&nr_parcela=${nr_parcela}&vl_fatura=${vl_fatura}`,
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar transações da fatura');
      }

      const data = await response.json();
      console.log('✅ Resposta da API:', data);

      // Extrair array de transações
      let transacoes = [];
      if (data.success && data.data && data.data.data) {
        transacoes = data.data.data;
      } else if (data.success && data.data && Array.isArray(data.data)) {
        transacoes = data.data;
      }

      console.log('📊 Transações recebidas:', transacoes);

      // Processar transações: escolher entre origem, destino ou própria transação baseado em cd_empresa < 100
      const transacoesProcessadas = transacoes
        .map((t) => {
          // Prioridade 1: Verificar se cd_empresadest < 100
          if (t.cd_empresadest && parseInt(t.cd_empresadest) < 100) {
            return {
              cd_empresa: t.cd_empresadest,
              nr_transacao: t.nr_transacaodest,
              dt_transacao: t.dt_transacaodest,
              vl_transacao: t.vl_transacao || 0,
              tipo: 'destino',
            };
          }
          // Prioridade 2: Verificar se cd_empresaori < 100
          else if (t.cd_empresaori && parseInt(t.cd_empresaori) < 100) {
            return {
              cd_empresa: t.cd_empresaori,
              nr_transacao: t.nr_transacaoori,
              dt_transacao: t.dt_transacaoori,
              vl_transacao: t.vl_transacao || 0,
              tipo: 'origem',
            };
          }
          // Prioridade 3: Se ambos forem null, usar dados da própria transação se cd_empresa < 100
          else if (
            !t.cd_empresadest &&
            !t.cd_empresaori &&
            t.cd_empresa &&
            parseInt(t.cd_empresa) < 100
          ) {
            return {
              cd_empresa: t.cd_empresa,
              nr_transacao: t.nr_transacao,
              dt_transacao: t.dt_transacao,
              vl_transacao: t.vl_transacao || 0,
              tipo: 'propria',
            };
          }
          // Se nenhuma condição atendida, retornar null
          return null;
        })
        .filter((t) => t !== null); // Remover nulls

      console.log(
        `✅ ${transacoesProcessadas.length} transações processadas (empresa < 100):`,
        transacoesProcessadas,
      );

      setTransacoesFatura(transacoesProcessadas);
    } catch (error) {
      console.error('❌ Erro ao buscar transações:', error);
      setTransacoesError(error.message || 'Erro ao buscar transações');
      setTransacoesFatura([]);
    } finally {
      setTransacoesLoading(false);
    }
  };

  // Função para gerar DANFE a partir da transação
  const gerarDanfeTransacao = async (transacao) => {
    try {
      setDanfeLoading(true);
      setDanfeError('');

      console.log('🔍 Gerando DANFE da transação:', transacao);

      const cd_pessoa = parseInt(faturaSelecionada?.cd_cliente) || 0;
      const dataTransacao = transacao.dt_transacao
        ? transacao.dt_transacao.split('T')[0]
        : '';

      if (!dataTransacao) {
        throw new Error('Data da transação não disponível');
      }

      // Buscar faturas com mesmo cliente, data emissão, vencimento e parcela
      const faturasRelacionadas = dados.filter(
        (f) =>
          f.cd_cliente === faturaSelecionada.cd_cliente &&
          f.dt_emissao?.split('T')[0] ===
            faturaSelecionada.dt_emissao?.split('T')[0] &&
          f.dt_vencimento?.split('T')[0] ===
            faturaSelecionada.dt_vencimento?.split('T')[0] &&
          f.nr_parcela === faturaSelecionada.nr_parcela,
      );

      console.log('📋 Faturas relacionadas encontradas:', faturasRelacionadas);

      // Somar o valor total das faturas relacionadas
      const valorTotalFaturas = faturasRelacionadas.reduce(
        (soma, fatura) => soma + (parseFloat(fatura.vl_fatura) || 0),
        0,
      );

      console.log(
        `💰 Valor total das faturas somadas: R$ ${valorTotalFaturas.toFixed(
          2,
        )}`,
      );
      console.log(
        `💰 Valor da transação: R$ ${parseFloat(transacao.vl_transacao).toFixed(
          2,
        )}`,
      );

      const payload = {
        filter: {
          branchCodeList: [parseInt(transacao.cd_empresa)],
          personCodeList: [cd_pessoa],
          transactionBranchCode: parseInt(transacao.cd_empresa),
          transactionCode: parseInt(transacao.nr_transacao),
          transactionDate: dataTransacao,
        },
      };

      console.log('📤 Payload DANFE enviado:', payload);

      const response = await fetch(`${TotvsURL}danfe-from-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao gerar DANFE');
      }

      const data = await response.json();
      console.log('✅ DANFE recebida:', data);

      let base64 = '';
      if (data.success && data.data) {
        base64 = data.data.danfePdfBase64 || data.data.base64 || '';
      } else if (data.danfePdfBase64) {
        base64 = data.danfePdfBase64;
      }

      if (base64) {
        abrirPDFDanfe(base64, transacao.nr_transacao);
      } else {
        throw new Error('DANFE não retornada pela API');
      }
    } catch (error) {
      console.error('❌ Erro ao gerar DANFE:', error);
      setDanfeError(error.message || 'Erro ao gerar DANFE');
      alert(`Erro ao gerar DANFE: ${error.message}`);
    } finally {
      setDanfeLoading(false);
    }
  };

  // Função para abrir PDF da DANFE em nova aba
  const abrirPDFDanfe = (base64String, nrTransacao) => {
    try {
      const base64 = base64String.replace(/^data:application\/pdf;base64,/, '');
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const newWindow = window.open(url, '_blank');

      if (newWindow) {
        console.log('✅ DANFE aberta em nova aba');
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 1000);
      } else {
        console.warn('⚠️ Popup bloqueado, iniciando download...');
        const link = document.createElement('a');
        link.href = url;
        link.download = `danfe-transacao-${nrTransacao}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('❌ Erro ao abrir DANFE:', error);
      alert('Erro ao abrir a DANFE. Tente novamente.');
    }
  };

  // Função para abrir modal de observações
  const abrirObsFatura = async (fatura) => {
    try {
      setObsLoading(true);
      setObsModalAberto(true);
      setFaturaSelecionada(fatura);
      setBoletoBase64('');
      setBoletoError('');

      const cd_cliente = fatura.cd_cliente || '';
      const nr_fat = fatura.nr_fat || '';

      console.log(
        `🔍 Buscando observações - cd_cliente: ${cd_cliente}, nr_fat: ${nr_fat}`,
      );

      // Buscar transações da fatura usando a nova rota otimizada
      buscarTransacoesFaturaOtimizada(fatura);

      const response = await apiClient.financial.obsFati({
        cd_cliente,
        nr_fat,
      });

      let rows = [];
      if (response && response.success && Array.isArray(response.data)) {
        rows = response.data;
      } else if (Array.isArray(response)) {
        rows = response;
      }

      // Filtrar observações indesejadas
      const textosFiltrar = [
        'BOLETO CANCELADO: BANCO REJEITOU A FATURA',
        'BOLETO CANCELADO: GERADO PARA O BANCO ERRADO',
      ];

      const rowsFiltradas = rows.filter((obs) => {
        const textoObs = (obs.ds_observacao || '').trim().toUpperCase();
        return !textosFiltrar.some((filtro) =>
          textoObs.includes(filtro.toUpperCase()),
        );
      });

      console.log(
        `✅ ${rowsFiltradas.length} observações encontradas (${
          rows.length - rowsFiltradas.length
        } filtradas)`,
      );
      setObsFatura(rowsFiltradas);
    } catch (error) {
      console.error('❌ Erro ao buscar observações:', error);
      setObsFatura([]);
    } finally {
      setObsLoading(false);
    }
  };

  // Função para buscar boleto bancário
  const buscarBoleto = async () => {
    if (!faturaSelecionada) return;

    try {
      setBoletoLoading(true);
      setBoletoError('');
      setBoletoBase64('');

      const payload = {
        branchCode: parseInt(faturaSelecionada.cd_empresa) || 0,
        customerCode: faturaSelecionada.cd_cliente || '',
        receivableCode: parseInt(faturaSelecionada.nr_fat) || 0,
        installmentNumber: parseInt(faturaSelecionada.nr_parcela) || 0,
      };

      console.log('🔍 Buscando boleto com os dados:', payload);

      const response = await fetch(`${TotvsURL}bank-slip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar boleto');
      }

      const data = await response.json();
      console.log('✅ Boleto recebido:', data);

      // O boleto pode vir em diferentes formatos
      let base64 = '';

      if (typeof data === 'string') {
        base64 = data;
      } else if (data.data && data.data.base64) {
        // Formato: { data: { base64: { content: "..." } } }
        if (typeof data.data.base64 === 'string') {
          base64 = data.data.base64;
        } else if (data.data.base64.content) {
          base64 = data.data.base64.content;
        }
      } else if (data.data && typeof data.data === 'string') {
        base64 = data.data;
      } else if (data.base64) {
        if (typeof data.base64 === 'string') {
          base64 = data.base64;
        } else if (data.base64.content) {
          base64 = data.base64.content;
        }
      }

      if (base64 && typeof base64 === 'string') {
        setBoletoBase64(base64);
        console.log('✅ Base64 do boleto:', base64.substring(0, 100) + '...');
        console.log('📏 Tamanho do base64:', base64.length, 'caracteres');

        // Converter base64 para PDF e abrir em nova aba
        abrirPDF(base64);
      } else {
        console.error('❌ Formato de resposta inválido:', data);
        throw new Error('Formato de resposta inválido - base64 não encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar boleto:', error);
      setBoletoError(error.message || 'Erro ao buscar boleto');
    } finally {
      setBoletoLoading(false);
    }
  };

  // Função para converter base64 em PDF e abrir em nova aba
  const abrirPDF = (base64String) => {
    try {
      // Remove o prefixo data:application/pdf;base64, se existir
      const base64 = base64String.replace(/^data:application\/pdf;base64,/, '');

      // Converte base64 para array de bytes
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Cria um Blob do tipo PDF
      const blob = new Blob([bytes], { type: 'application/pdf' });

      // Cria uma URL para o Blob
      const url = window.URL.createObjectURL(blob);

      // Abre em nova aba
      const newWindow = window.open(url, '_blank');

      if (newWindow) {
        console.log('✅ PDF aberto em nova aba');
        // Libera a URL após um tempo (para garantir que o PDF foi carregado)
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 1000);
      } else {
        // Se o popup foi bloqueado, oferece download
        console.warn('⚠️ Popup bloqueado, iniciando download...');
        baixarPDF(blob);
      }
    } catch (error) {
      console.error('❌ Erro ao abrir PDF:', error);
      alert('Erro ao abrir o boleto. Tente novamente.');
    }
  };

  // Função para baixar o PDF
  const baixarPDF = (blob) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boleto-${faturaSelecionada?.nr_fat || 'fatura'}-parcela-${
      faturaSelecionada?.nr_parcela || '1'
    }.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    console.log('✅ Download do PDF iniciado');
  };

  // Função para exportar dados para Excel
  const handleExportExcel = () => {
    if (dadosProcessados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }

    try {
      const dadosParaExportar = dadosProcessados.map((item) => ({
        Cliente: item.nm_cliente || '',
        'Nº Fatura': item.nr_fat || '',
        Parcela: item.nr_parcela || '',
        Emissão:
          formatDateBR(item.dt_emissao) === '--'
            ? ''
            : formatDateBR(item.dt_emissao),
        Vencimento:
          formatDateBR(item.dt_vencimento) === '--'
            ? ''
            : formatDateBR(item.dt_vencimento),
        Liquidação:
          formatDateBR(item.dt_liq) === '--' ? '' : formatDateBR(item.dt_liq),
        'Valor Fatura': parseFloat(item.vl_fatura) || 0,
        'Valor Pago': parseFloat(item.vl_pago) || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contas a Receber');

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `contas-pagar-franquias-${hoje}.xlsx`;

      saveAs(data, nomeArquivo);

      console.log('✅ Excel exportado com sucesso:', nomeArquivo);
    } catch (error) {
      console.error('❌ Erro ao exportar Excel:', error);
      alert('Erro ao exportar arquivo Excel. Tente novamente.');
    }
  };

  // Funções para paginação
  const irParaPagina = (pagina) => {
    setPaginaAtual(pagina);
  };

  const paginaAnterior = () => {
    if (paginaAtual > 1) {
      setPaginaAtual(paginaAtual - 1);
    }
  };

  const proximaPagina = () => {
    if (paginaAtual < totalPages) {
      setPaginaAtual(paginaAtual + 1);
    }
  };

  // Calcular totais para os cards
  const calcularTotais = () => {
    const totais = dadosProcessados.reduce(
      (acc, item) => {
        const valorFatura = parseFloat(item.vl_fatura) || 0;
        const valorPago = parseFloat(item.vl_pago) || 0;
        const temDataLiquidacao =
          item.dt_liq && item.dt_liq !== null && item.dt_liq !== '';

        acc.valorFaturado += valorFatura;
        acc.valorPago += valorPago;

        // Se tem data de liquidação, não contabiliza no "a pagar"
        // Se não tem data de liquidação, considera o saldo restante
        if (!temDataLiquidacao) {
          const saldo = valorFatura - valorPago;
          if (saldo > 0) {
            acc.valorAPagar += saldo;
          }
        }

        return acc;
      },
      {
        valorFaturado: 0,
        valorPago: 0,
        valorAPagar: 0,
      },
    );

    return totais;
  };

  const totais = calcularTotais();

  // Resetar página quando dados mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [dados, ordenacao]);

  // Gerar array de páginas para exibição
  const gerarPaginas = () => {
    const totalPaginas = Math.ceil(dadosProcessados.length / itensPorPagina);
    const paginas = [];
    const maxPaginasVisiveis = 5;

    if (totalPaginas <= maxPaginasVisiveis) {
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i);
      }
    } else {
      if (paginaAtual <= 3) {
        for (let i = 1; i <= 4; i++) {
          paginas.push(i);
        }
        paginas.push('...');
        paginas.push(totalPaginas);
      } else if (paginaAtual >= totalPaginas - 2) {
        paginas.push(1);
        paginas.push('...');
        for (let i = totalPaginas - 3; i <= totalPaginas; i++) {
          paginas.push(i);
        }
      } else {
        paginas.push(1);
        paginas.push('...');
        for (let i = paginaAtual - 1; i <= paginaAtual + 1; i++) {
          paginas.push(i);
        }
        paginas.push('...');
        paginas.push(totalPaginas);
      }
    }

    return paginas;
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Portal de Títulos MTM"
        subtitle="Consulta de títulos dos nossos clientes"
        icon={Receipt}
        iconColor="text-red-600"
      />

      {/* Formulário de Filtros */}
      <div className="mb-4">
        <form
          onSubmit={handleFiltrar}
          className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full max-w-7xl mx-auto border border-[#000638]/10"
        >
          <div className="mb-2">
            <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
              <Funnel size={18} weight="bold" />
              Filtros
            </span>
            <span className="text-xs text-gray-500 mt-1">
              Selecione a empresa e situação para análise
            </span>
          </div>

          {/* Busca por Nome/Fantasia - DESABILITADO */}
          <div className="mb-3 opacity-50 pointer-events-none">
            <p className="text-xs font-semibold text-gray-400 mb-2">
              Buscar Cliente por Nome (desabilitado)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="relative">
                <label className="block text-xs font-semibold mb-0.5 text-gray-400">
                  Nome da Pessoa
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={termoBuscaNome}
                    disabled
                    placeholder="Desabilitado - use o código do cliente"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 pr-8 w-full bg-gray-100 text-gray-400 text-xs cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="relative">
                <label className="block text-xs font-semibold mb-0.5 text-gray-400">
                  Nome Fantasia
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={termoBuscaFantasia}
                    disabled
                    placeholder="Desabilitado - use o código do cliente"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 pr-8 w-full bg-gray-100 text-gray-400 text-xs cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Código do Cliente
              </label>
              <input
                type="number"
                value={cdCliente}
                onChange={(e) => setCdCliente(e.target.value)}
                placeholder="Digite o código ou busque por nome"
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Situação
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="todos">TODOS</option>
                <option value="em_aberto">A PAGAR</option>
                <option value="pagos">PAGOS</option>
                <option value="vencidos">VENCIDOS</option>
              </select>
            </div>
            <div className="flex items-center">
              <button
                type="submit"
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner size={10} className="animate-spin" />
                    <span>Carregando...</span>
                  </>
                ) : (
                  <>
                    <Receipt size={10} />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Cliente Selecionado - Rodapé */}
          {clienteSelecionado && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-700">Cliente:</span>{' '}
                  {clienteSelecionado.cd_pessoa} -{' '}
                  {clienteSelecionado.nm_pessoa}
                  {clienteSelecionado.nm_fantasia && (
                    <span className="text-gray-500">
                      {' '}
                      ({clienteSelecionado.nm_fantasia})
                    </span>
                  )}
                </span>
                <button
                  onClick={() => {
                    setClienteSelecionado(null);
                    setCdCliente('');
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Limpar seleção"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Cards de Resumo */}
      {dadosProcessados.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 mb-6 max-w-7xl mx-auto">
          {/* Valor Total Faturado */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={14} className="text-blue-600" />
                <CardTitle className="text-xs font-bold text-blue-700">
                  Valor Total
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-blue-600 mb-0.5 break-words">
                {totais.valorFaturado.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor total faturado
              </CardDescription>
            </CardContent>
          </Card>

          {/* Valor Pago */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-700">
                  Valor Pago
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-green-600 mb-0.5 break-words">
                {totais.valorPago.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor total pago
              </CardDescription>
            </CardContent>
          </Card>

          {/* Valor a Receber */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={14} className="text-red-600" />
                <CardTitle className="text-xs font-bold text-red-700">
                  Valor a Pagar
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-red-600 mb-0.5 break-words">
                {totais.valorAPagar.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor pendente
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 max-w-7xl mx-auto w-full">
        <div className="p-3 border-b border-[#000638]/10 flex justify-between items-center">
          <h2 className="text-sm font-bold text-[#000638] font-barlow">
            Contas a Pagar
          </h2>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-600">
              {dadosCarregados
                ? `${dadosProcessados.length} registros encontrados`
                : 'Nenhum dado carregado'}
            </div>
            {dadosProcessados.length > 0 && (
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 transition-colors font-medium text-xs"
              >
                <FileArrowDown size={12} />
                BAIXAR EXCEL
              </button>
            )}
          </div>
        </div>

        <div className="p-3">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="flex items-center gap-3">
                <Spinner size={18} className="animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">
                  Carregando dados...
                </span>
              </div>
            </div>
          ) : !dadosCarregados ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-2">
                  Clique em "Buscar" para carregar as informações
                </div>
                <div className="text-gray-400 text-xs">
                  Selecione a empresa e situação desejadas
                </div>
              </div>
            </div>
          ) : dados.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-2">
                  Nenhum dado encontrado
                </div>
                <div className="text-gray-400 text-xs">
                  Verifique os filtros selecionados ou tente novamente
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-[350px] md:max-w-[700px] lg:max-w-[900px] xl:max-w-[1100px] 2xl:max-w-[1300px] mx-auto overflow-x-auto">
              <table className="border-collapse rounded-lg overflow-hidden shadow-lg extrato-table">
                <thead className="bg-[#000638] text-white text-sm uppercase tracking-wider">
                  <tr>
                    <th
                      className="px-2 py-2 text-left cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('nm_cliente')}
                    >
                      <div className="flex items-center">
                        Cliente
                        {getSortIcon('nm_cliente')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('nr_fat')}
                    >
                      <div className="flex items-center justify-center">
                        Nº Fatura
                        {getSortIcon('nr_fat')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('nr_parcela')}
                    >
                      <div className="flex items-center justify-center">
                        Parcela
                        {getSortIcon('nr_parcela')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('dt_emissao')}
                    >
                      <div className="flex items-center justify-center">
                        Emissão
                        {getSortIcon('dt_emissao')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('dt_vencimento')}
                    >
                      <div className="flex items-center justify-center">
                        Vencimento
                        {getSortIcon('dt_vencimento')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('dt_liq')}
                    >
                      <div className="flex items-center justify-center">
                        Liquidação
                        {getSortIcon('dt_liq')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_fatura')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Fatura
                        {getSortIcon('vl_fatura')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_pago')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Pago
                        {getSortIcon('vl_pago')}
                      </div>
                    </th>
                    <th className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center">
                        Detalhar
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dadosPaginados.map((item, index) => (
                    <tr key={index} className="text-sm transition-colors">
                      <td className="text-left text-gray-900 px-2 py-2">
                        {item.nm_cliente || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {item.nr_fat || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {item.nr_parcela || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {formatDateBR(item.dt_emissao)}
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {formatDateBR(item.dt_vencimento)}
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {formatDateBR(item.dt_liq)}
                      </td>
                      <td className="text-center font-semibold text-green-600 px-2 py-2">
                        {(parseFloat(item.vl_fatura) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center font-semibold text-blue-600 px-2 py-2">
                        {(parseFloat(item.vl_pago) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center px-2 py-2">
                        <button
                          onClick={() => abrirObsFatura(item)}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs mx-auto font-medium"
                          title="Ver observações"
                        >
                          <Eye size={14} weight="bold" />
                          Detalhar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-center text-sm text-gray-600">
                Total de {dadosProcessados.length} registros
              </div>

              {/* Paginação */}
              {dadosProcessados.length > itensPorPagina && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-4 sm:mb-0">
                    Mostrando {(paginaAtual - 1) * itensPorPagina + 1} a{' '}
                    {Math.min(
                      paginaAtual * itensPorPagina,
                      dadosProcessados.length,
                    )}{' '}
                    de {dadosProcessados.length} registros
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Botão Anterior */}
                    <button
                      onClick={paginaAnterior}
                      disabled={paginaAtual === 1}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CaretLeft size={16} />
                      Anterior
                    </button>

                    {/* Números das páginas */}
                    <div className="flex items-center gap-1">
                      {gerarPaginas().map((pagina, index) => (
                        <button
                          key={index}
                          onClick={() =>
                            typeof pagina === 'number' && irParaPagina(pagina)
                          }
                          disabled={typeof pagina !== 'number'}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            pagina === paginaAtual
                              ? 'bg-[#000638] text-white'
                              : typeof pagina === 'number'
                                ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                : 'text-gray-400 cursor-default'
                          }`}
                        >
                          {pagina}
                        </button>
                      ))}
                    </div>

                    {/* Botão Próximo */}
                    <button
                      onClick={proximaPagina}
                      disabled={paginaAtual === totalPages}
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Próximo
                      <CaretRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Busca de Clientes */}
      {modalBuscaAberto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          style={{ zIndex: 99998 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <MagnifyingGlass size={24} className="text-blue-600" />
                Clientes Encontrados
              </h2>
              <button
                onClick={() => setModalBuscaAberto(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} weight="bold" />
              </button>
            </div>

            <div className="text-sm text-gray-600 mb-4">
              {clientesEncontrados.length} cliente(s) encontrado(s)
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Código
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Nome Fantasia
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {clientesEncontrados.map((cliente, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {cliente.cd_pessoa}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {cliente.nm_pessoa}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {cliente.nm_fantasia || '--'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => selecionarCliente(cliente)}
                          className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Selecionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setModalBuscaAberto(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Observações e Boleto */}
      {obsModalAberto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          style={{ zIndex: 99999 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Detalhes da Fatura
              </h2>
              <button
                onClick={() => setObsModalAberto(false)}
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

            {/* Informações da Fatura */}
            {faturaSelecionada && (
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Informações da Fatura
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Cliente:</span>
                    <p className="font-medium">
                      {faturaSelecionada.nm_cliente}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nº Fatura:</span>
                    <p className="font-medium">{faturaSelecionada.nr_fat}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Parcela:</span>
                    <p className="font-medium">
                      {faturaSelecionada.nr_parcela}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Empresa:</span>
                    <p className="font-medium">
                      {faturaSelecionada.cd_empresa}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Alerta para empresa 101 */}
            {faturaSelecionada && faturaSelecionada.cd_empresa === '101' && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800 font-semibold">
                      ⚠️ Essa fatura não é referente a compra de mercadoria,
                      verifique as observações ou contate a Central de
                      Franquias.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Seção de Transações Relacionadas */}
            <div className="border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Receipt size={20} className="text-purple-600" />
                Transações Relacionadas
              </h3>

              <div className="min-h-[150px]">
                {transacoesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <LoadingSpinner size="sm" text="Carregando transações..." />
                  </div>
                ) : transacoesError ? (
                  <div className="bg-red-50 border border-red-200 rounded p-4">
                    <p className="text-sm text-red-600">{transacoesError}</p>
                  </div>
                ) : transacoesFatura.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Empresa
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                            Nº Transação
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                            Data
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                            Valor
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {transacoesFatura
                          .filter((transacao) => transacao.cd_empresa < 100)
                          .map((transacao, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {transacao.cd_empresa || '--'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center font-bold text-[#000638]">
                                {transacao.nr_transacao || '--'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {formatDateBR(transacao.dt_transacao)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                                {formatCurrency(transacao.vl_transacao)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => gerarDanfeTransacao(transacao)}
                                  disabled={danfeLoading}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors mx-auto"
                                  title="Gerar DANFE desta transação"
                                >
                                  <FileArrowDown size={18} weight="bold" />
                                  {danfeLoading ? 'Gerando...' : 'Gerar NF'}
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-8">
                    Nenhuma transação encontrada para esta fatura.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Seção 1: Observações da Fatura */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Receipt size={20} className="text-blue-600" />
                  Observações da Fatura
                </h3>

                <div className="min-h-[200px]">
                  {obsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <LoadingSpinner
                        size="sm"
                        text="Carregando observações..."
                      />
                    </div>
                  ) : obsFatura && obsFatura.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-2">
                      {obsFatura.map((o, idx) => (
                        <li key={idx} className="text-sm text-gray-700">
                          {o.ds_observacao}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-8">
                      Nenhuma observação encontrada para esta fatura.
                    </div>
                  )}
                </div>
              </div>

              {/* Seção 2: Boleto Bancário - Só aparece se não estiver pago */}
              {(() => {
                const valorFaturado =
                  parseFloat(faturaSelecionada?.vl_fatura) || 0;
                const valorPago = parseFloat(faturaSelecionada?.vl_pago) || 0;
                const estaPago =
                  valorPago >= valorFaturado && valorFaturado > 0;

                return !estaPago ? (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FileArrowDown size={20} className="text-green-600" />
                      Baixar Boleto Bancário
                    </h3>

                    <div className="min-h-[200px]">
                      {!boletoBase64 && !boletoLoading && !boletoError && (
                        <div className="flex flex-col items-center justify-center py-8">
                          <p className="text-sm text-gray-500 mb-4 text-center">
                            Clique no botão abaixo para gerar o boleto bancário
                          </p>
                          <button
                            onClick={buscarBoleto}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium"
                          >
                            <FileArrowDown size={18} weight="bold" />
                            Gerar Boleto
                          </button>
                        </div>
                      )}

                      {boletoLoading && (
                        <div className="flex items-center justify-center py-6">
                          <LoadingSpinner size="sm" text="Gerando boleto..." />
                        </div>
                      )}

                      {boletoError && (
                        <div className="bg-red-50 border border-red-200 rounded p-4">
                          <p className="text-sm text-red-600 font-medium mb-2">
                            Erro ao gerar boleto:
                          </p>
                          <p className="text-sm text-red-500">{boletoError}</p>
                          <button
                            onClick={buscarBoleto}
                            className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      )}

                      {boletoBase64 && (
                        <div className="space-y-3">
                          <div className="bg-green-50 border border-green-200 rounded p-3">
                            <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                              <CheckCircle
                                size={16}
                                className="text-green-600"
                              />
                              Boleto gerado e aberto em nova aba!
                            </p>
                          </div>

                          <div className="space-y-2">
                            <button
                              onClick={() => abrirPDF(boletoBase64)}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                            >
                              <Eye size={18} weight="bold" />
                              Visualizar Boleto Novamente
                            </button>

                            <button
                              onClick={() => {
                                const base64 = boletoBase64.replace(
                                  /^data:application\/pdf;base64,/,
                                  '',
                                );
                                const binaryString = window.atob(base64);
                                const bytes = new Uint8Array(
                                  binaryString.length,
                                );
                                for (let i = 0; i < binaryString.length; i++) {
                                  bytes[i] = binaryString.charCodeAt(i);
                                }
                                const blob = new Blob([bytes], {
                                  type: 'application/pdf',
                                });
                                baixarPDF(blob);
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium"
                            >
                              <FileArrowDown size={18} weight="bold" />
                              Baixar Boleto
                            </button>
                          </div>

                          <div className="bg-gray-50 border border-gray-200 rounded p-3">
                            <p className="text-xs font-semibold text-gray-700 mb-2">
                              Informações técnicas:
                            </p>
                            <p className="text-xs text-gray-500">
                              Tamanho do arquivo:{' '}
                              {typeof boletoBase64 === 'string'
                                ? `${(
                                    (boletoBase64.length * 0.75) /
                                    1024
                                  ).toFixed(2)} KB`
                                : '0 KB'}
                            </p>
                            <p className="text-xs text-gray-500">
                              Formato: PDF
                            </p>
                          </div>

                          <button
                            onClick={buscarBoleto}
                            className="w-full text-sm text-gray-600 hover:text-gray-700 font-medium"
                          >
                            Gerar novamente
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircle size={20} className="text-green-600" />
                      Status do Pagamento
                    </h3>
                    <div className="min-h-[200px] flex items-center justify-center">
                      <div className="text-center">
                        <CheckCircle
                          size={48}
                          className="text-green-600 mx-auto mb-4"
                        />
                        <p className="text-lg font-semibold text-green-700 mb-2">
                          Boleto Pago
                        </p>
                        <p className="text-sm text-gray-600">
                          Esta fatura já foi liquidada e não requer boleto
                          bancário.
                        </p>
                        {faturaSelecionada?.dt_liq && (
                          <p className="text-xs text-gray-500 mt-2">
                            Data de liquidação:{' '}
                            {formatDateBR(faturaSelecionada.dt_liq)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setObsModalAberto(false)}
                className="px-6 py-2 bg-[#000638] text-white rounded hover:bg-[#fe0000] transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TitulosClientes;
