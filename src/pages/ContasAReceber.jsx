import React, { useEffect, useState, useCallback, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import FiltroCliente from '../components/FiltroCliente';
import FiltroFormaPagamento from '../components/FiltroFormaPagamento';
import FiltroNomeFantasia from '../components/FiltroNomeFantasia';
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
  Calendar,
  Funnel,
  Spinner,
  CurrencyDollar,
  Clock,
  Warning,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
  CaretUpDown,
  Percent,
  FileArrowDown,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const ContasAReceber = ({ modo = 'vencimento' }) => {
  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [status, setStatus] = useState('Todos');
  const [situacao, setSituacao] = useState('NORMAIS');
  const [duplicata, setDuplicata] = useState('');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);

  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(20);

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

  // Estados para filtro mensal
  const [filtroMensal, setFiltroMensal] = useState('ANO');
  const [filtroDia, setFiltroDia] = useState(null);

  // Estados para filtros adicionais
  const [filtroFatura, setFiltroFatura] = useState('');
  const [filtroPortador, setFiltroPortador] = useState('');
  const [filtroCobranca, setFiltroCobranca] = useState('TODOS');
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('TODOS');

  // Estados para os novos filtros de seleção múltipla
  const [clientesSelecionados, setClientesSelecionados] = useState([]);
  const [formasPagamentoSelecionadas, setFormasPagamentoSelecionadas] =
    useState([]);
  const [nomesFantasiaSelecionados, setNomesFantasiaSelecionados] = useState(
    [],
  );
  const [dadosClientes, setDadosClientes] = useState([]);
  const [dadosFormasPagamento, setDadosFormasPagamento] = useState([]);
  const [dadosNomesFantasia, setDadosNomesFantasia] = useState([]);

  // Estado para informações de pessoas
  const [infoPessoas, setInfoPessoas] = useState({});

  const BaseURL = 'https://apigestaocrosby-bw2v.onrender.com/api/financial/';

  // Helpers de data sem fuso horário (tratar 'YYYY-MM-DD' como data local)
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
        padding: 3px 4px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 9px;
        line-height: 1.2;
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
        font-size: 8px;
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
      .extrato-table tbody tr.bg-blue-100 td:first-child {
        background-color: #dbeafe;
      }
      .extrato-table tbody tr.bg-blue-100:hover td:first-child {
        background-color: #bfdbfe;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Função para ordenação
  const handleSort = useCallback((campo) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Função para ícone de ordenação
  const getSortIcon = useCallback(
    (campo) => {
      if (ordenacao.campo !== campo) {
        return <CaretUpDown size={12} className="opacity-50" />;
      }
      return ordenacao.direcao === 'asc' ? (
        <CaretUp size={12} />
      ) : (
        <CaretDown size={12} />
      );
    },
    [ordenacao],
  );

  // Função para obter número de dias do mês
  const obterDiasDoMes = (mes) => {
    const meses = {
      JAN: 31,
      FEV: 28,
      MAR: 31,
      ABR: 30,
      MAI: 31,
      JUN: 30,
      JUL: 31,
      AGO: 31,
      SET: 30,
      OUT: 31,
      NOV: 30,
      DEZ: 31,
    };
    return meses[mes] || 0;
  };

  // Função para lidar com mudança de filtro mensal
  const handleFiltroMensalChange = (novoFiltro) => {
    setFiltroMensal(novoFiltro);
    setFiltroDia(null); // Limpar filtro de dia quando mudar o mês
  };

  // Função para converter tipo de documento de número para nome
  const converterTipoDocumento = (numero) => {
    const tiposDocumento = {
      1: 'Fatura',
      2: 'Cheque',
      3: 'Dinheiro',
      4: 'Cartão crédito',
      5: 'Cartão débito',
      6: 'Nota débito',
      7: 'TEF',
      8: 'Cheque TEF',
      9: 'Troco',
      10: 'Adiantamento (saída cx.)',
      11: 'Desconto financeiro',
      12: 'DOFNI',
      13: 'Vale',
      14: 'Nota promissória',
      15: 'Cheque garantido',
      16: 'TED/DOC',
      17: 'Pré-Autorização TEF',
      18: 'Cheque presente',
      19: 'TEF/TECBAN - BANRISUL',
      20: 'CREDEV',
      21: 'Cartão próprio',
      22: 'TEF/HYPERCARD',
      23: 'Bônus desconto',
      25: 'Voucher',
      26: 'PIX',
      27: 'PicPay',
      28: 'Ame',
      29: 'Mercado Pago',
      30: 'Marketplace',
      31: 'Outro documento',
    };

    return tiposDocumento[numero] || numero || 'Não informado';
  };

  // Função para aplicar filtro mensal e por dia
  const aplicarFiltroMensal = (dados, filtro, diaFiltro = null) => {
    return dados.filter((item) => {
      // Base do filtro mensal conforme modo selecionado
      const campoDataBase =
        modo === 'emissao' ? item.dt_emissao : item.dt_vencimento;
      if (!campoDataBase) return false;

      const data = parseDateNoTZ(campoDataBase);
      const ano = data.getFullYear();
      const mes = data.getMonth() + 1; // getMonth() retorna 0-11, então +1
      const dia = data.getDate();

      if (filtro === 'ANO') {
        // Mostrar dados dos anos 2025 e 2026
        return ano === 2025 || ano === 2026;
      }

      // Filtros por mês específico
      const mesesMap = {
        JAN: 1,
        FEV: 2,
        MAR: 3,
        ABR: 4,
        MAI: 5,
        JUN: 6,
        JUL: 7,
        AGO: 8,
        SET: 9,
        OUT: 10,
        NOV: 11,
        DEZ: 12,
      };

      const mesDoFiltro = mesesMap[filtro];
      if (mesDoFiltro) {
        // Se há filtro por dia, verificar também o dia
        if (diaFiltro !== null) {
          return mes === mesDoFiltro && dia === diaFiltro;
        }
        return mes === mesDoFiltro;
      }

      return true;
    });
  };

  // Função para filtrar dados por situação
  const filtrarDadosPorSituacao = (dadosOriginais) => {
    if (!dadosOriginais || dadosOriginais.length === 0) return [];

    switch (situacao) {
      case 'NORMAIS':
        // Mostra apenas itens que NÃO têm data de cancelamento
        return dadosOriginais.filter((item) => !item.dt_cancelamento);
      case 'CANCELADAS':
        // Mostra apenas itens que TÊM data de cancelamento
        return dadosOriginais.filter((item) => item.dt_cancelamento);
      case 'TODAS':
        // Mostra todos os itens
        return dadosOriginais;
      default:
        return dadosOriginais;
    }
  };

  // Função para filtrar dados por status
  const filtrarDadosPorStatus = (dadosOriginais) => {
    if (!dadosOriginais || dadosOriginais.length === 0) return [];

    switch (status) {
      case 'Todos':
        // Mostra todos os itens
        return dadosOriginais;
      case 'Pago':
        // Mostra apenas itens pagos
        return dadosOriginais.filter((item) => parseFloat(item.vl_pago) > 0);
      case 'Vencido':
        // Mostra apenas itens vencidos (data de vencimento menor que hoje)
        return dadosOriginais.filter((item) => {
          const dv = parseDateNoTZ(item.dt_vencimento);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          return dv && dv < hoje;
        });
      case 'A Vencer':
        // Mostra apenas itens a vencer (data de vencimento maior ou igual a hoje)
        return dadosOriginais.filter((item) => {
          const dv = parseDateNoTZ(item.dt_vencimento);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          return !dv || dv >= hoje;
        });
      default:
        return dadosOriginais;
    }
  };

  // Dados filtrados por situação
  const dadosFiltrados = filtrarDadosPorSituacao(dados);

  // Dados filtrados por situação E status
  const dadosFiltradosCompletos = filtrarDadosPorStatus(dadosFiltrados);

  // Aplicar filtros adicionais aos dados já filtrados por situação e status
  const dadosComFiltrosAdicionais = dadosFiltradosCompletos.filter((item) => {
    // Filtro por cliente (seleção múltipla)
    if (clientesSelecionados.length > 0) {
      const cdCliente = item.cd_cliente?.toString();
      const isSelected = clientesSelecionados.some(
        (cliente) => cliente.cd_cliente?.toString() === cdCliente,
      );
      if (!isSelected) {
        return false;
      }
    }

    // Filtro por fatura
    if (filtroFatura) {
      const nrFatura = item.nr_fatura || '';
      if (
        !nrFatura.toString().toLowerCase().includes(filtroFatura.toLowerCase())
      ) {
        return false;
      }
    }

    // Filtro por portador (usa nr_portador, igual fatura)
    if (filtroPortador) {
      const nrPortador = item.nr_portador || '';
      if (
        !nrPortador
          .toString()
          .toLowerCase()
          .includes(filtroPortador.toLowerCase())
      ) {
        return false;
      }
    }

    // Filtro por forma de pagamento (seleção múltipla)
    if (formasPagamentoSelecionadas.length > 0) {
      const tpDocumento = item.tp_documento?.toString();
      const isSelected = formasPagamentoSelecionadas.some(
        (forma) => forma.codigo?.toString() === tpDocumento,
      );
      if (!isSelected) {
        return false;
      }
    }

    // Filtro por nome fantasia (seleção múltipla)
    if (nomesFantasiaSelecionados.length > 0) {
      // Se informações de pessoas ainda não carregaram, não filtrar por nome fantasia
      if (!infoPessoas || Object.keys(infoPessoas).length === 0) {
        // Mantém o item até dados estarem disponíveis
      } else {
        const key = String(item.cd_cliente || '').trim();
        const fantasia = infoPessoas[key]?.nm_fantasia;
        const isSelected = nomesFantasiaSelecionados.some(
          (nome) => nome.nm_fantasia === fantasia,
        );
        if (!isSelected) {
          return false;
        }
      }
    }

    // Filtro por cobrança
    if (filtroCobranca !== 'TODOS') {
      const tipoCobranca = item.tp_cobranca;

      if (filtroCobranca === 'DESCONTADA' && tipoCobranca !== '2') {
        return false;
      }
      if (filtroCobranca === 'NÃO ESTÁ EM COBRANÇA' && tipoCobranca !== '0') {
        return false;
      }
      if (filtroCobranca === 'SIMPLES' && tipoCobranca !== '1') {
        return false;
      }
    }

    // Filtro por Tipo de Cliente (Franquias/Outros)
    if (filtroTipoCliente !== 'TODOS') {
      // Se informações de pessoas ainda não carregaram, não filtrar por tipo
      if (!infoPessoas || Object.keys(infoPessoas).length === 0) {
        // Mantém o item até dados estarem disponíveis
      } else {
        const key = String(item.cd_cliente || '').trim();
        const fantasia = (infoPessoas[key]?.nm_fantasia || '').toUpperCase();
        const ehFranquia = fantasia.includes(' - CROSBY');
        if (filtroTipoCliente === 'FRANQUIAS' && !ehFranquia) return false;
        if (filtroTipoCliente === 'OUTROS' && ehFranquia) return false;
      }
    }

    return true;
  });

  // Dados processados (filtrados, ordenados e com filtro mensal)
  const dadosProcessados = useMemo(() => {
    let dadosFiltrados = [...dadosComFiltrosAdicionais];

    // Aplicar filtro mensal
    dadosFiltrados = aplicarFiltroMensal(
      dadosFiltrados,
      filtroMensal,
      filtroDia,
    );

    // Aplicar ordenação
    if (ordenacao.campo) {
      dadosFiltrados.sort((a, b) => {
        let valorA, valorB;

        // Tratamento especial para campos de informações de pessoas
        if (ordenacao.campo === 'nm_fantasia') {
          valorA = infoPessoas[String(a.cd_cliente).trim()]?.nm_fantasia || '';
          valorB = infoPessoas[String(b.cd_cliente).trim()]?.nm_fantasia || '';
        } else if (ordenacao.campo === 'ds_siglaest') {
          valorA = infoPessoas[String(a.cd_cliente).trim()]?.ds_siglaest || '';
          valorB = infoPessoas[String(b.cd_cliente).trim()]?.ds_siglaest || '';
        } else {
          valorA = a[ordenacao.campo];
          valorB = b[ordenacao.campo];
        }

        // Tratamento especial para datas
        if (ordenacao.campo.includes('dt_')) {
          valorA = valorA ? new Date(valorA) : new Date(0);
          valorB = valorB ? new Date(valorB) : new Date(0);
        }

        // Tratamento especial para valores numéricos
        if (
          ordenacao.campo.includes('vl_') ||
          ordenacao.campo.includes('pr_')
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
  }, [
    dadosComFiltrosAdicionais,
    ordenacao,
    filtroMensal,
    filtroDia,
    infoPessoas,
  ]);

  // Dados paginados para exibição
  const dadosPaginados = useMemo(() => {
    const startIndex = (paginaAtual - 1) * itensPorPagina;
    const endIndex = startIndex + itensPorPagina;
    return dadosProcessados.slice(startIndex, endIndex);
  }, [dadosProcessados, paginaAtual, itensPorPagina]);

  // Total de páginas para paginação
  const totalPages = Math.ceil(dadosProcessados.length / itensPorPagina);

  // Definir datas padrão (mês atual)
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    setDataInicio(primeiroDia.toISOString().split('T')[0]);
    setDataFim(ultimoDia.toISOString().split('T')[0]);
  }, []);

  // Função para buscar informações de pessoas (em lotes para evitar URL muito longa)
  const buscarInfoPessoas = async (codigosPessoa) => {
    if (!codigosPessoa || codigosPessoa.length === 0) return {};

    try {
      const codigosUnicos = [...new Set(codigosPessoa.filter(Boolean))];
      const CHUNK_SIZE = 50; // Número de códigos por requisição
      const chunks = [];
      for (let i = 0; i < codigosUnicos.length; i += CHUNK_SIZE) {
        chunks.push(codigosUnicos.slice(i, i + CHUNK_SIZE));
      }

      const results = await Promise.all(
        chunks.map(async (chunk) => {
          const queryParams = chunk
            .map((codigo) => `cd_pessoa=${encodeURIComponent(codigo)}`)
            .join('&');
          const url = `${BaseURL}infopessoa?${queryParams}`;
          try {
            const res = await fetch(url);
            if (!res.ok) {
              console.warn(
                'Erro ao buscar informações de pessoas (lote):',
                res.status,
                res.statusText,
                url,
              );
              return [];
            }
            const data = await res.json();
            // Formatos suportados:
            // 1) { success, data: { data: [ ... ] } }
            // 2) { success, data: [ ... ] }
            // 3) [ ... ]
            if (data?.data?.data && Array.isArray(data.data.data))
              return data.data.data;
            if (Array.isArray(data?.data)) return data.data;
            if (Array.isArray(data)) return data;
            return [];
          } catch (e) {
            console.warn('Falha ao buscar lote de pessoas:', e);
            return [];
          }
        }),
      );

      const infoPessoasObj = {};
      results.flat().forEach((pessoa) => {
        if (pessoa && pessoa.cd_pessoa != null) {
          const key = String(pessoa.cd_pessoa).trim();
          infoPessoasObj[key] = pessoa;
        }
      });

      return infoPessoasObj;
    } catch (err) {
      console.error('Erro ao buscar informações de pessoas:', err);
      return {};
    }
  };

  const buscarDados = async (inicio = dataInicio, fim = dataFim) => {
    if (!inicio || !fim) return;

    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }

    setLoading(true);
    setPaginaAtual(1); // Reset para primeira página ao buscar novos dados
    try {
      const todasAsPromises = empresasSelecionadas.map(async (empresa) => {
        try {
          const endpoint =
            modo === 'emissao' ? 'contas-receberemiss' : 'contas-receber';
          const res = await fetch(
            `${BaseURL}${endpoint}?dt_inicio=${inicio}&dt_fim=${fim}&cd_empresa=${empresa.cd_empresa}`,
          );

          if (!res.ok) {
            console.warn(
              `Erro ao buscar empresa ${empresa.cd_empresa}: HTTP ${res.status}`,
            );
            return [];
          }

          const data = await res.json();
          console.log(
            `Resposta da API para empresa ${empresa.cd_empresa}:`,
            data,
          );

          let dadosArray = [];
          if (Array.isArray(data)) {
            dadosArray = data;
          } else if (data && typeof data === 'object') {
            if (data.dados && Array.isArray(data.dados)) {
              dadosArray = data.dados;
            } else if (data.data && Array.isArray(data.data)) {
              dadosArray = data.data;
            } else if (
              data.data &&
              data.data.data &&
              Array.isArray(data.data.data)
            ) {
              dadosArray = data.data.data;
            } else if (data.result && Array.isArray(data.result)) {
              dadosArray = data.result;
            } else if (data.contas && Array.isArray(data.contas)) {
              dadosArray = data.contas;
            } else {
              dadosArray = Object.values(data);
            }
          }

          return dadosArray.filter((item) => item && typeof item === 'object');
        } catch (err) {
          console.warn(`Erro ao buscar empresa ${empresa.cd_empresa}:`, err);
          return [];
        }
      });

      const resultados = await Promise.all(todasAsPromises);
      const todosOsDados = resultados.flat();

      console.log('📊 Total de dados:', todosOsDados.length);

      // Extrair códigos únicos de clientes para buscar informações de pessoas
      const codigosClientes = [
        ...new Set(todosOsDados.map((item) => item.cd_cliente).filter(Boolean)),
      ];
      console.log('👥 Códigos de clientes únicos:', codigosClientes);

      // Buscar informações de pessoas
      const infoPessoasData = await buscarInfoPessoas(codigosClientes);
      setInfoPessoas(infoPessoasData);

      // Extrair dados únicos de nomes fantasia das informações de pessoas
      const nomesFantasiaUnicos = Object.entries(infoPessoasData)
        .filter(([key, pessoa]) => pessoa.nm_fantasia)
        .map(([key, pessoa]) => ({
          cd_cliente: key,
          nm_fantasia: pessoa.nm_fantasia,
        }))
        .filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.nm_fantasia === item.nm_fantasia),
        );
      setDadosNomesFantasia(nomesFantasiaUnicos);

      setDados(todosOsDados);
      setDadosCarregados(true);

      // Extrair dados únicos de clientes
      const clientesUnicos = [
        ...new Set(
          todosOsDados.map((item) =>
            JSON.stringify({
              cd_cliente: item.cd_cliente?.toString(),
              nm_cliente: item.nm_cliente,
            }),
          ),
        ),
      ]
        .map((str) => JSON.parse(str))
        .filter((cliente) => cliente.cd_cliente && cliente.nm_cliente);
      setDadosClientes(clientesUnicos);

      // Extrair dados únicos de formas de pagamento
      const formasPagamentoUnicas = [
        ...new Set(
          todosOsDados.map((item) =>
            JSON.stringify({
              codigo: item.tp_documento?.toString(),
              descricao: converterTipoDocumento(item.tp_documento),
            }),
          ),
        ),
      ]
        .map((str) => JSON.parse(str))
        .filter((forma) => forma.codigo && forma.descricao);
      setDadosFormasPagamento(formasPagamentoUnicas);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
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

  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  const handleSelectClientes = (clientes) => {
    setClientesSelecionados([...clientes]); // Garantir que é um novo array
  };

  const handleSelectFormasPagamento = (formasPagamento) => {
    setFormasPagamentoSelecionadas([...formasPagamento]); // Garantir que é um novo array
  };

  const handleSelectNomesFantasia = (nomesFantasia) => {
    setNomesFantasiaSelecionados([...nomesFantasia]); // Garantir que é um novo array
  };

  // Função para exportar dados para Excel
  const handleExportExcel = () => {
    if (dadosProcessados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }

    try {
      // Preparar dados para exportação
      const dadosParaExportar = dadosProcessados.map((item, index) => {
        const key = String(item.cd_cliente || '').trim();
        const fantasia = infoPessoas[key]?.nm_fantasia || '';
        const estado = infoPessoas[key]?.ds_siglaest || '';
        const ehFranquia = fantasia.toUpperCase().includes(' - CROSBY');

        return {
          Cliente: item.cd_cliente || '',
          'Nome Cliente': item.nm_cliente || '',
          'Nome Fantasia': fantasia || '',
          'Tipo Cliente': ehFranquia ? 'FRANQUIA' : 'OUTRO',
          Estado: estado || '',
          Emissão:
            formatDateBR(item.dt_emissao) === '--'
              ? ''
              : formatDateBR(item.dt_emissao),
          Vencimento:
            formatDateBR(item.dt_vencimento) === '--'
              ? ''
              : formatDateBR(item.dt_vencimento),
          'Valor Fatura': parseFloat(item.vl_fatura) || 0,
          'Valor Pago': parseFloat(item.vl_pago) || 0,
          Desconto: parseFloat(item.vl_desconto) || 0,
          'Valor Corrigido': parseFloat(item.vl_corrigido) || 0,
          'Forma de Pagamento': converterTipoDocumento(item.tp_documento),
          Liquidação:
            formatDateBR(item.dt_liq) === '--' ? '' : formatDateBR(item.dt_liq),
          Cobrança: (() => {
            const tipo = item.tp_cobranca;
            if (tipo === '2') return 'DESCONTADA';
            if (tipo === '0') return 'NÃO ESTÁ EM COBRANÇA';
            if (tipo === '1') return 'SIMPLES';
            return tipo || '';
          })(),
          Empresa: item.cd_empresa || '',
          Parcela: item.nr_parcela || '',
          Cancelamento:
            formatDateBR(item.dt_cancelamento) === '--'
              ? ''
              : formatDateBR(item.dt_cancelamento),
          Faturamento: item.tp_faturamento || '',
          Inclusão: item.tp_inclusao || '',
          Baixa: item.tp_baixa || '',
          Situação: item.tp_situacao || '',
          'Valor Original': parseFloat(item.vl_original) || 0,
          Abatimento: parseFloat(item.vl_abatimento) || 0,
          'Valor Líquido': parseFloat(item.vl_liquido) || 0,
          Acréscimo: parseFloat(item.vl_acrescimo) || 0,
          Multa: parseFloat(item.vl_multa) || 0,
          Portador: item.nr_portador || '',
          Renegociação: parseFloat(item.vl_renegociacao) || 0,
          Juros: parseFloat(item.vl_juros) || 0,
          '% Juros/Mês': item.pr_juromes ? parseFloat(item.pr_juromes) : 0,
          '% Multa': item.pr_multa ? parseFloat(item.pr_multa) : 0,
        };
      });

      // Criar workbook e worksheet
      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contas a Receber');

      // Gerar arquivo
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Nome do arquivo com data
      const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `contas-a-receber-${hoje}.xlsx`;

      // Download
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
    const totalPaginas = Math.ceil(dados.length / itensPorPagina);
    if (paginaAtual < totalPaginas) {
      setPaginaAtual(paginaAtual + 1);
    }
  };

  // Cálculo do PMCR (média ponderada): diferença em dias entre emissão e liquidação (ou hoje se não pago), ponderado por valor
  const pmcrDias = useMemo(() => {
    if (!dadosProcessados || dadosProcessados.length === 0) return 0;
    let somaPonderadaDias = 0;
    let somaPesos = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dadosProcessados.forEach((item) => {
      const emissao = parseDateNoTZ(item.dt_emissao);
      const liquidacao = item.dt_liq ? parseDateNoTZ(item.dt_liq) : hoje;
      if (!emissao) return;
      const dias = Math.max(
        0,
        Math.floor((liquidacao - emissao) / (1000 * 60 * 60 * 24)),
      );
      const valorBase = parseFloat(item.vl_fatura) || 0;
      if (valorBase > 0) {
        somaPonderadaDias += dias * valorBase;
        somaPesos += valorBase;
      }
    });
    if (somaPesos === 0) return 0;
    return somaPonderadaDias / somaPesos;
  }, [dadosProcessados]);

  // Calcular totais para os cards
  const calcularTotais = () => {
    const totais = dadosProcessados.reduce(
      (acc, item) => {
        acc.valorFaturado += parseFloat(item.vl_fatura) || 0;
        acc.valorPago += parseFloat(item.vl_pago) || 0;
        acc.valorCorrigido += parseFloat(item.vl_corrigido) || 0;
        acc.valorDescontos += parseFloat(item.vl_desconto) || 0;
        return acc;
      },
      {
        valorFaturado: 0,
        valorPago: 0,
        valorCorrigido: 0,
        valorDescontos: 0,
      },
    );

    // Valor a receber = Valor faturado - Valor pago
    totais.valorAPagar = totais.valorFaturado - totais.valorPago;

    return totais;
  };

  const totais = calcularTotais();

  // Função para determinar status baseado nos dados
  const getStatusFromData = (item) => {
    if (parseFloat(item.vl_pago) > 0) return 'Pago';
    if (item.dt_vencimento) {
      const dv = parseDateNoTZ(item.dt_vencimento);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      // Vencido: data de vencimento menor que hoje (passou da data)
      if (dv && dv < hoje) return 'Vencido';
    }
    // A Vencer: data de vencimento maior ou igual a hoje (incluindo hoje)
    return 'A Vencer';
  };

  // Resetar página quando dados mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [dados]);

  // Resetar página quando ordenação mudar
  useEffect(() => {
    setPaginaAtual(1);
  }, [ordenacao]);

  // Resetar página quando filtro mensal mudar
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroMensal, filtroDia]);

  // Resetar página quando filtros adicionais mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [
    clientesSelecionados,
    filtroFatura,
    filtroPortador,
    formasPagamentoSelecionadas,
    nomesFantasiaSelecionados,
    filtroCobranca,
    filtroTipoCliente,
  ]);

  // Gerar array de páginas para exibição
  const gerarPaginas = () => {
    const totalPaginas = Math.ceil(dadosProcessados.length / itensPorPagina);
    const paginas = [];
    const maxPaginasVisiveis = 5;

    if (totalPaginas <= maxPaginasVisiveis) {
      // Mostrar todas as páginas se houver 5 ou menos
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i);
      }
    } else {
      // Lógica para mostrar páginas com elipses
      if (paginaAtual <= 3) {
        // Páginas iniciais
        for (let i = 1; i <= 4; i++) {
          paginas.push(i);
        }
        paginas.push('...');
        paginas.push(totalPaginas);
      } else if (paginaAtual >= totalPaginas - 2) {
        // Páginas finais
        paginas.push(1);
        paginas.push('...');
        for (let i = totalPaginas - 3; i <= totalPaginas; i++) {
          paginas.push(i);
        }
      } else {
        // Páginas do meio
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
    <div className="w-full max-w-4xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Contas a Receber"
        subtitle="Acompanhe e gerencie todas as contas a receber da empresa"
        icon={Receipt}
        iconColor="text-green-600"
      />

      {/* Formulário de Filtros */}
      <div className="mb-4">
        <form
          onSubmit={handleFiltrar}
          className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full max-w-4xl mx-auto border border-[#000638]/10"
        >
          <div className="mb-2">
            <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
              <Funnel size={18} weight="bold" />
              Filtros
            </span>
            <span className="text-xs text-gray-500 mt-1">
              Selecione o período e empresa para análise
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
            <div className="lg:col-span-2">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={handleSelectEmpresas}
                apenasEmpresa101={true}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="Todos">TODOS</option>
                <option value="Pago">PAGO</option>
                <option value="Vencido">VENCIDO</option>
                <option value="A Vencer">A VENCER</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 mb-3">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Situação
              </label>
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="NORMAIS">NORMAIS</option>
                <option value="CANCELADAS">CANCELADAS</option>
                <option value="TODAS">TODAS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Cobrança
              </label>
              <select
                value={filtroCobranca}
                onChange={(e) => setFiltroCobranca(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="TODOS">TODOS</option>
                <option value="DESCONTADA">DESCONTADA</option>
                <option value="NÃO ESTÁ EM COBRANÇA">
                  NÃO ESTÁ EM COBRANÇA
                </option>
                <option value="SIMPLES">SIMPLES</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Tipo Cliente
              </label>
              <select
                value={filtroTipoCliente}
                onChange={(e) => setFiltroTipoCliente(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="TODOS">TODOS</option>
                <option value="FRANQUIAS">FRANQUIAS</option>
                <option value="OUTROS">OUTROS</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Fatura
              </label>
              <input
                type="text"
                value={filtroFatura}
                onChange={(e) => setFiltroFatura(e.target.value)}
                placeholder="Buscar fatura..."
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Portador
              </label>
              <input
                type="text"
                value={filtroPortador}
                onChange={(e) => setFiltroPortador(e.target.value)}
                placeholder="Buscar portador..."
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
              />
            </div>
            <div className="lg:col-span-1">
              <FiltroCliente
                clientesSelecionados={clientesSelecionados}
                onSelectClientes={handleSelectClientes}
                dadosClientes={dadosClientes}
              />
            </div>
            <div className="lg:col-3">
              <FiltroFormaPagamento
                formasPagamentoSelecionadas={formasPagamentoSelecionadas}
                onSelectFormasPagamento={handleSelectFormasPagamento}
                dadosFormasPagamento={dadosFormasPagamento}
              />
            </div>
            <div className="lg:col-span-3">
              <FiltroNomeFantasia
                nomesFantasiaSelecionados={nomesFantasiaSelecionados}
                onSelectNomesFantasia={handleSelectNomesFantasia}
                dadosNomesFantasia={dadosNomesFantasia}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
                disabled={loading || !dataInicio || !dataFim}
              >
                {loading ? (
                  <>
                    <Spinner size={10} className="animate-spin" />
                    <span></span>
                  </>
                ) : (
                  <>
                    <Calendar size={10} />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Painel de Filtro Mensal */}
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={14} className="text-[#000638]" />
          <h3 className="font-bold text-xs text-[#000638] font-barlow">
            Filtro por Período (Data Vencimento)
          </h3>
        </div>

        <div className="flex flex-wrap gap-1">
          {/* Botão ANO */}
          <button
            onClick={() => handleFiltroMensalChange('ANO')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              filtroMensal === 'ANO'
                ? 'bg-[#000638] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ANO
          </button>

          {/* Botões dos Meses */}
          {[
            'JAN',
            'FEV',
            'MAR',
            'ABR',
            'MAI',
            'JUN',
            'JUL',
            'AGO',
            'SET',
            'OUT',
            'NOV',
            'DEZ',
          ].map((mes) => (
            <button
              key={mes}
              onClick={() => handleFiltroMensalChange(mes)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filtroMensal === mes
                  ? 'bg-[#000638] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {mes}
            </button>
          ))}
        </div>

        {/* Informação do filtro ativo */}
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium">Filtro ativo:</span> {filtroMensal}
          {filtroDia && <span className="ml-1">- Dia {filtroDia}</span>}
          <span className="ml-2">
            ({dadosProcessados.length} registro
            {dadosProcessados.length !== 1 ? 's' : ''})
          </span>
        </div>

        {/* Filtro por Dia - aparece apenas quando um mês está selecionado */}
        {filtroMensal !== 'ANO' && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={12} className="text-[#000638]" />
              <h4 className="font-bold text-xs text-[#000638] font-barlow">
                Filtro por Dia - {filtroMensal}
              </h4>
            </div>

            <div className="flex flex-wrap gap-0.5">
              {/* Botão "Todos os Dias" */}
              <button
                onClick={() => setFiltroDia(null)}
                className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                  filtroDia === null
                    ? 'bg-[#000638] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                TODOS
              </button>

              {/* Botões dos dias */}
              {Array.from(
                { length: obterDiasDoMes(filtroMensal) },
                (_, i) => i + 1,
              ).map((dia) => (
                <button
                  key={dia}
                  onClick={() => setFiltroDia(dia)}
                  className={`px-1.5 py-0.5 text-xs font-medium rounded-md transition-colors ${
                    filtroDia === dia
                      ? 'bg-[#000638] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  {dia}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cards de Resumo */}
      {dadosProcessados.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 mb-6 max-w-6xl mx-auto">
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
                {loading ? (
                  <Spinner size={18} className="animate-spin text-blue-600" />
                ) : (
                  totais.valorFaturado.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor total faturado{' '}
              </CardDescription>
            </CardContent>
          </Card>

          {/* Valor Pago */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-700">
                  Valor Recebido
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-green-600 mb-0.5 break-words">
                {loading ? (
                  <Spinner size={18} className="animate-spin text-green-600" />
                ) : (
                  totais.valorPago.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor total pago{' '}
              </CardDescription>
            </CardContent>
          </Card>

          {/* Valor Corrigido */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-purple-600" />
                <CardTitle className="text-xs font-bold text-purple-700">
                  Valor Corrigido
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-purple-600 mb-0.5 break-words">
                {loading ? (
                  <Spinner size={18} className="animate-spin text-purple-600" />
                ) : (
                  totais.valorCorrigido.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor total corrigido{' '}
              </CardDescription>
            </CardContent>
          </Card>

          {/* Valor a Receber */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Warning size={14} className="text-red-600" />
                <CardTitle className="text-xs font-bold text-red-700">
                  Valor a Receber
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-red-600 mb-0.5 break-words">
                {loading ? (
                  <Spinner size={18} className="animate-spin text-red-600" />
                ) : (
                  totais.valorAPagar.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor pendente a receber
              </CardDescription>
            </CardContent>
          </Card>

          {/* Valor de Descontos */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Percent size={14} className="text-orange-600" />
                <CardTitle className="text-xs font-bold text-orange-700">
                  Valor de Descontos
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-orange-600 mb-0.5 break-words">
                {loading ? (
                  <Spinner size={18} className="animate-spin text-orange-600" />
                ) : (
                  totais.valorDescontos.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Total de descontos aplicados
              </CardDescription>
            </CardContent>
          </Card>

          {/* Valor a Receber  */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-purple-600" />
                <CardTitle className="text-xs font-bold text-purple-700">
                  A Receber{' '}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-purple-600 mb-0.5 break-words">
                {loading ? (
                  <Spinner size={18} className="animate-spin text-purple-600" />
                ) : (
                  totais.valorFaturado.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">
                {filtroMensal === 'ANO'
                  ? 'Ano atual'
                  : `${filtroMensal}${filtroDia ? ` - Dia ${filtroDia}` : ''}`}
              </CardDescription>
            </CardContent>
          </Card>

          {/* Prazo Médio de Recebimento */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-700">
                  PMR
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-green-600 mb-0.5 break-words">
                {loading ? (
                  <Spinner size={18} className="animate-spin text-green-600" />
                ) : (
                  `${pmcrDias.toFixed(1)} dias`
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor entre emissão e recebimento
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 max-w-4xl mx-auto w-full">
        <div className="p-3 border-b border-[#000638]/10 flex justify-between items-center">
          <h2 className="text-sm font-bold text-[#000638] font-barlow">
            Detalhamento de Contas a Receber
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
                  Clique em "Buscar Dados" para carregar as informações
                </div>
                <div className="text-gray-400 text-xs">
                  Selecione o período e empresa desejados
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
                  Verifique o período selecionado ou tente novamente
                </div>
              </div>
            </div>
          ) : (
            <div className="table-container max-w-full mx-auto">
              <table
                className="border-collapse rounded-lg overflow-hidden shadow-lg extrato-table"
                style={{ minWidth: '1200px' }}
              >
                <thead className="bg-[#000638] text-white text-xs uppercase tracking-wider">
                  <tr>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('cd_cliente')}
                    >
                      <div className="flex items-center justify-center">
                        Cliente
                        {getSortIcon('cd_cliente')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-left text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('nm_cliente')}
                    >
                      <div className="flex items-center">
                        Nome Cliente
                        {getSortIcon('nm_cliente')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('nm_fantasia')}
                    >
                      <div className="flex items-center justify-center">
                        Nome Fantasia
                        {getSortIcon('nm_fantasia')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('ds_siglaest')}
                    >
                      <div className="flex items-center justify-center">
                        Estado
                        {getSortIcon('ds_siglaest')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('dt_emissao')}
                    >
                      <div className="flex items-center justify-center">
                        Emissão
                        {getSortIcon('dt_emissao')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('dt_vencimento')}
                    >
                      <div className="flex items-center justify-center">
                        Vencimento
                        {getSortIcon('dt_vencimento')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_fatura')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Fatura
                        {getSortIcon('vl_fatura')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_pago')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Pago
                        {getSortIcon('vl_pago')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_desconto')}
                    >
                      <div className="flex items-center justify-center">
                        Desconto
                        {getSortIcon('vl_desconto')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_corrigido')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Corrigido
                        {getSortIcon('vl_corrigido')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('tp_documento')}
                    >
                      <div className="flex items-center justify-center">
                        Formas de Pagamento
                        {getSortIcon('tp_documento')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('dt_liq')}
                    >
                      <div className="flex items-center justify-center">
                        Liquidação
                        {getSortIcon('dt_liq')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('tp_cobranca')}
                    >
                      <div className="flex items-center justify-center">
                        Cobrança
                        {getSortIcon('tp_cobranca')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('cd_empresa')}
                    >
                      <div className="flex items-center justify-center">
                        Empresa
                        {getSortIcon('cd_empresa')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('nr_parcela')}
                    >
                      <div className="flex items-center justify-center">
                        Parcela
                        {getSortIcon('nr_parcela')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('dt_cancelamento')}
                    >
                      <div className="flex items-center justify-center">
                        Cancelamento
                        {getSortIcon('dt_cancelamento')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('tp_faturamento')}
                    >
                      <div className="flex items-center justify-center">
                        Faturamento
                        {getSortIcon('tp_faturamento')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('tp_inclusao')}
                    >
                      <div className="flex items-center justify-center">
                        Inclusão
                        {getSortIcon('tp_inclusao')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('tp_baixa')}
                    >
                      <div className="flex items-center justify-center">
                        Baixa
                        {getSortIcon('tp_baixa')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('tp_situacao')}
                    >
                      <div className="flex items-center justify-center">
                        Situação
                        {getSortIcon('tp_situacao')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_original')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Original
                        {getSortIcon('vl_original')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_abatimento')}
                    >
                      <div className="flex items-center justify-center">
                        Abatimento
                        {getSortIcon('vl_abatimento')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_liquido')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Líquido
                        {getSortIcon('vl_liquido')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_acrescimo')}
                    >
                      <div className="flex items-center justify-center">
                        Acréscimo
                        {getSortIcon('vl_acrescimo')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_multa')}
                    >
                      <div className="flex items-center justify-center">
                        Multa
                        {getSortIcon('vl_multa')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('nr_portador')}
                    >
                      <div className="flex items-center justify-center">
                        Portador
                        {getSortIcon('nr_portador')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_renegociacao')}
                    >
                      <div className="flex items-center justify-center">
                        Renegociação
                        {getSortIcon('vl_renegociacao')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_juros')}
                    >
                      <div className="flex items-center justify-center">
                        Juros
                        {getSortIcon('vl_juros')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('pr_juromes')}
                    >
                      <div className="flex items-center justify-center">
                        % Juros/Mês
                        {getSortIcon('pr_juromes')}
                      </div>
                    </th>
                    <th
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('pr_multa')}
                    >
                      <div className="flex items-center justify-center">
                        % Multa
                        {getSortIcon('pr_multa')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dadosPaginados.map((item, index) => (
                    <tr key={index} className="text-[8px] transition-colors">
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.cd_cliente || '--'}
                      </td>
                      <td className="text-left text-gray-900 px-0.5 py-0.5">
                        {item.nm_cliente || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(() => {
                          const key = String(item.cd_cliente).trim();
                          const fantasia = infoPessoas[key]?.nm_fantasia || '';
                          const ehFranquia = fantasia
                            .toUpperCase()
                            .includes(' - CROSBY');
                          return (
                            <div className="flex items-center justify-center gap-2">
                              <span>{fantasia || '--'}</span>
                              {ehFranquia && (
                                <span className="px-1 py-0.5 text-[8px] font-bold rounded bg-blue-100 text-blue-700 border border-blue-300">
                                  FRANQUIA
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {infoPessoas[String(item.cd_cliente).trim()]
                          ?.ds_siglaest || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {formatDateBR(item.dt_emissao)}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {formatDateBR(item.dt_vencimento)}
                      </td>
                      <td className="text-center font-semibold text-green-600 px-0.5 py-0.5">
                        {(parseFloat(item.vl_fatura) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center font-semibold text-blue-600 px-0.5 py-0.5">
                        {(parseFloat(item.vl_pago) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(parseFloat(item.vl_desconto) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(parseFloat(item.vl_corrigido) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {converterTipoDocumento(item.tp_documento)}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {formatDateBR(item.dt_liq)}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(() => {
                          const tipo = item.tp_cobranca;
                          if (tipo === '2') return 'DESCONTADA';
                          if (tipo === '0') return 'NÃO ESTÁ EM COBRANÇA';
                          if (tipo === '1') return 'SIMPLES';
                          return tipo || '--';
                        })()}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.cd_empresa || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.nr_parcela || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {formatDateBR(item.dt_cancelamento)}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.tp_faturamento || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.tp_inclusao || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.tp_baixa || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.tp_situacao || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(parseFloat(item.vl_original) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(parseFloat(item.vl_abatimento) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(parseFloat(item.vl_liquido) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(parseFloat(item.vl_acrescimo) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(parseFloat(item.vl_multa) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.nr_portador || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(parseFloat(item.vl_renegociacao) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {(parseFloat(item.vl_juros) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.pr_juromes
                          ? `${parseFloat(item.pr_juromes).toFixed(2)}%`
                          : '--'}
                      </td>
                      <td className="text-center text-gray-900 px-0.5 py-0.5">
                        {item.pr_multa
                          ? `${parseFloat(item.pr_multa).toFixed(2)}%`
                          : '--'}
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
                      disabled={
                        paginaAtual ===
                        Math.ceil(dadosProcessados.length / itensPorPagina)
                      }
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
    </div>
  );
};

export default ContasAReceber;
