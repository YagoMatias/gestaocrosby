import React, { useEffect, useState, useCallback, useMemo } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import FiltroCliente from '../components/FiltroCliente';
import FiltroFormaPagamento from '../components/FiltroFormaPagamento';
import FiltroNomeFantasia from '../components/FiltroNomeFantasia';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
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
  ChartPie,
  ChartBar,
  Percent,
  FileArrowDown
} from '@phosphor-icons/react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const ContasAReceber = () => {
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

  // Estados para gráficos
  const [dadosGraficos, setDadosGraficos] = useState({
    distribuicaoStatus: [],
    analiseClientes: [],
    inadimplencia: [],
    tiposDocumento: [],
    clientesInadimplentes: []
  });

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

  // Estados para filtro mensal
  const [filtroMensal, setFiltroMensal] = useState('ANO');
  const [filtroDia, setFiltroDia] = useState(null);

  // Estados para filtros adicionais
  const [filtroFatura, setFiltroFatura] = useState('');
  const [filtroCobranca, setFiltroCobranca] = useState('TODOS');
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('TODOS');

  // Estados para os novos filtros de seleção múltipla
  const [clientesSelecionados, setClientesSelecionados] = useState([]);
  const [formasPagamentoSelecionadas, setFormasPagamentoSelecionadas] = useState([]);
  const [nomesFantasiaSelecionados, setNomesFantasiaSelecionados] = useState([]);
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
      const [y, m, d] = datePart.split('-').map(n => parseInt(n, 10));
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
        padding: 6px 8px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 11px;
        line-height: 1.3;
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
        font-size: 10px;
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
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Função para ícone de ordenação
  const getSortIcon = useCallback((campo) => {
    if (ordenacao.campo !== campo) {
      return <CaretUpDown size={12} className="opacity-50" />;
    }
    return ordenacao.direcao === 'asc' ? 
      <CaretUp size={12} /> : 
      <CaretDown size={12} />;
  }, [ordenacao]);

  // Função para obter número de dias do mês
  const obterDiasDoMes = (mes) => {
    const meses = {
      'JAN': 31, 'FEV': 28, 'MAR': 31, 'ABR': 30, 'MAI': 31, 'JUN': 30,
      'JUL': 31, 'AGO': 31, 'SET': 30, 'OUT': 31, 'NOV': 30, 'DEZ': 31
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
      '1': 'Fatura',
      '2': 'Cheque',
      '3': 'Dinheiro',
      '4': 'Cartão crédito',
      '5': 'Cartão débito',
      '6': 'Nota débito',
      '7': 'TEF',
      '8': 'Cheque TEF',
      '9': 'Troco',
      '10': 'Adiantamento (saída cx.)',
      '11': 'Desconto financeiro',
      '12': 'DOFNI',
      '13': 'Vale',
      '14': 'Nota promissória',
      '15': 'Cheque garantido',
      '16': 'TED/DOC',
      '17': 'Pré-Autorização TEF',
      '18': 'Cheque presente',
      '19': 'TEF/TECBAN - BANRISUL',
      '20': 'CREDEV',
      '21': 'Cartão próprio',
      '22': 'TEF/HYPERCARD',
      '23': 'Bônus desconto',
      '25': 'Voucher',
      '26': 'PIX',
      '27': 'PicPay',
      '28': 'Ame',
      '29': 'Mercado Pago',
      '30': 'Marketplace',
      '31': 'Outro documento'
    };
    
    return tiposDocumento[numero] || numero || 'Não informado';
  };

  // Função para aplicar filtro mensal e por dia
  const aplicarFiltroMensal = (dados, filtro, diaFiltro = null) => {
    return dados.filter((item) => {
      // Usar dt_vencimento como base para o filtro mensal (data de vencimento)
      const dataVencimento = item.dt_vencimento;
      if (!dataVencimento) return false;
      
      const data = parseDateNoTZ(dataVencimento);
      const ano = data.getFullYear();
      const mes = data.getMonth() + 1; // getMonth() retorna 0-11, então +1
      const dia = data.getDate();
      
      if (filtro === 'ANO') {
        // Mostrar dados do ano atual
        const anoAtual = new Date().getFullYear();
        return ano === anoAtual;
      }
      
      // Filtros por mês específico
      const mesesMap = {
        'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4,
        'MAI': 5, 'JUN': 6, 'JUL': 7, 'AGO': 8,
        'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12
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
        return dadosOriginais.filter(item => !item.dt_cancelamento);
      case 'CANCELADAS':
        // Mostra apenas itens que TÊM data de cancelamento
        return dadosOriginais.filter(item => item.dt_cancelamento);
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
        return dadosOriginais.filter(item => parseFloat(item.vl_pago) > 0);
      case 'Vencido':
        // Mostra apenas itens vencidos (data de vencimento menor que hoje)
        return dadosOriginais.filter(item => {
          const dv = parseDateNoTZ(item.dt_vencimento);
          const hoje = new Date();
          hoje.setHours(0,0,0,0);
          return dv && dv < hoje;
        });
      case 'A Vencer':
        // Mostra apenas itens a vencer (data de vencimento maior ou igual a hoje)
        return dadosOriginais.filter(item => {
          const dv = parseDateNoTZ(item.dt_vencimento);
          const hoje = new Date();
          hoje.setHours(0,0,0,0);
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
      const isSelected = clientesSelecionados.some(cliente => cliente.cd_cliente?.toString() === cdCliente);
      if (!isSelected) {
        return false;
      }
    }

    // Filtro por fatura
    if (filtroFatura) {
      const nrFatura = item.nr_fatura || '';
      if (!nrFatura.toString().toLowerCase().includes(filtroFatura.toLowerCase())) {
        return false;
      }
    }

    // Filtro por forma de pagamento (seleção múltipla)
    if (formasPagamentoSelecionadas.length > 0) {
      const tpDocumento = item.tp_documento?.toString();
      const isSelected = formasPagamentoSelecionadas.some(forma => forma.codigo?.toString() === tpDocumento);
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
        const isSelected = nomesFantasiaSelecionados.some(nome => nome.nm_fantasia === fantasia);
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
    dadosFiltrados = aplicarFiltroMensal(dadosFiltrados, filtroMensal, filtroDia);

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
        if (ordenacao.campo.includes('vl_') || ordenacao.campo.includes('pr_')) {
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
  }, [dadosComFiltrosAdicionais, ordenacao, filtroMensal, filtroDia, infoPessoas]);

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

      const results = await Promise.all(chunks.map(async (chunk) => {
        const queryParams = chunk.map(codigo => `cd_pessoa=${encodeURIComponent(codigo)}`).join('&');
        const url = `${BaseURL}infopessoa?${queryParams}`;
        try {
          const res = await fetch(url);
          if (!res.ok) {
            console.warn('Erro ao buscar informações de pessoas (lote):', res.status, res.statusText, url);
            return [];
          }
          const data = await res.json();
          // Formatos suportados:
          // 1) { success, data: { data: [ ... ] } }
          // 2) { success, data: [ ... ] }
          // 3) [ ... ]
          if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
          if (Array.isArray(data?.data)) return data.data;
          if (Array.isArray(data)) return data;
          return [];
        } catch (e) {
          console.warn('Falha ao buscar lote de pessoas:', e);
          return [];
        }
      }));

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
          const res = await fetch(`${BaseURL}contas-receber?dt_inicio=${inicio}&dt_fim=${fim}&cd_empresa=${empresa.cd_empresa}`);
          
          if (!res.ok) {
            console.warn(`Erro ao buscar empresa ${empresa.cd_empresa}: HTTP ${res.status}`);
            return [];
          }
          
          const data = await res.json();
          console.log(`Resposta da API para empresa ${empresa.cd_empresa}:`, data);
          
          let dadosArray = [];
          if (Array.isArray(data)) {
            dadosArray = data;
          } else if (data && typeof data === 'object') {
            if (data.dados && Array.isArray(data.dados)) {
              dadosArray = data.dados;
            } else if (data.data && Array.isArray(data.data)) {
              dadosArray = data.data;
            } else if (data.data && data.data.data && Array.isArray(data.data.data)) {
              dadosArray = data.data.data;
            } else if (data.result && Array.isArray(data.result)) {
              dadosArray = data.result;
            } else if (data.contas && Array.isArray(data.contas)) {
              dadosArray = data.contas;
            } else {
              dadosArray = Object.values(data);
            }
          }
          
          return dadosArray.filter(item => item && typeof item === 'object');
        } catch (err) {
          console.warn(`Erro ao buscar empresa ${empresa.cd_empresa}:`, err);
          return [];
        }
      });
      
      const resultados = await Promise.all(todasAsPromises);
      const todosOsDados = resultados.flat();
      
      console.log('📊 Total de dados:', todosOsDados.length);
      
      // Extrair códigos únicos de clientes para buscar informações de pessoas
      const codigosClientes = [...new Set(todosOsDados.map(item => item.cd_cliente).filter(Boolean))];
      console.log('👥 Códigos de clientes únicos:', codigosClientes);
      
      // Buscar informações de pessoas
      const infoPessoasData = await buscarInfoPessoas(codigosClientes);
      setInfoPessoas(infoPessoasData);

      // Extrair dados únicos de nomes fantasia das informações de pessoas
      const nomesFantasiaUnicos = Object.entries(infoPessoasData)
        .filter(([key, pessoa]) => pessoa.nm_fantasia)
        .map(([key, pessoa]) => ({
          cd_cliente: key,
          nm_fantasia: pessoa.nm_fantasia
        }))
        .filter((item, index, self) => 
          index === self.findIndex(t => t.nm_fantasia === item.nm_fantasia)
        );
      setDadosNomesFantasia(nomesFantasiaUnicos);
      
      setDados(todosOsDados);
      setDadosCarregados(true);

      // Extrair dados únicos de clientes
      const clientesUnicos = [...new Set(todosOsDados.map(item => JSON.stringify({
        cd_cliente: item.cd_cliente?.toString(),
        nm_cliente: item.nm_cliente
      })))].map(str => JSON.parse(str)).filter(cliente => cliente.cd_cliente && cliente.nm_cliente);
      setDadosClientes(clientesUnicos);

      // Extrair dados únicos de formas de pagamento
      const formasPagamentoUnicas = [...new Set(todosOsDados.map(item => JSON.stringify({
        codigo: item.tp_documento?.toString(),
        descricao: converterTipoDocumento(item.tp_documento)
      })))].map(str => JSON.parse(str)).filter(forma => forma.codigo && forma.descricao);
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
          'Cliente': item.cd_cliente || '',
          'Nome Cliente': item.nm_cliente || '',
          'Nome Fantasia': fantasia || '',
          'Tipo Cliente': ehFranquia ? 'FRANQUIA' : 'OUTRO',
          'Estado': estado || '',
          'Emissão': formatDateBR(item.dt_emissao) === '--' ? '' : formatDateBR(item.dt_emissao),
          'Vencimento': formatDateBR(item.dt_vencimento) === '--' ? '' : formatDateBR(item.dt_vencimento),
          'Valor Fatura': parseFloat(item.vl_fatura) || 0,
          'Valor Pago': parseFloat(item.vl_pago) || 0,
          'Desconto': parseFloat(item.vl_desconto) || 0,
          'Valor Corrigido': parseFloat(item.vl_corrigido) || 0,
          'Forma de Pagamento': converterTipoDocumento(item.tp_documento),
          'Liquidação': formatDateBR(item.dt_liq) === '--' ? '' : formatDateBR(item.dt_liq),
          'Cobrança': (() => {
            const tipo = item.tp_cobranca;
            if (tipo === '2') return 'DESCONTADA';
            if (tipo === '0') return 'NÃO ESTÁ EM COBRANÇA';
            if (tipo === '1') return 'SIMPLES';
            return tipo || '';
          })(),
          'Empresa': item.cd_empresa || '',
          'Parcela': item.nr_parcela || '',
          'Cancelamento': formatDateBR(item.dt_cancelamento) === '--' ? '' : formatDateBR(item.dt_cancelamento),
          'Faturamento': item.tp_faturamento || '',
          'Inclusão': item.tp_inclusao || '',
          'Baixa': item.tp_baixa || '',
          'Situação': item.tp_situacao || '',
          'Valor Original': parseFloat(item.vl_original) || 0,
          'Abatimento': parseFloat(item.vl_abatimento) || 0,
          'Valor Líquido': parseFloat(item.vl_liquido) || 0,
          'Acréscimo': parseFloat(item.vl_acrescimo) || 0,
          'Multa': parseFloat(item.vl_multa) || 0,
          'Portador': item.nr_portador || '',
          'Renegociação': parseFloat(item.vl_renegociacao) || 0,
          'Juros': parseFloat(item.vl_juros) || 0,
          '% Juros/Mês': item.pr_juromes ? parseFloat(item.pr_juromes) : 0,
          '% Multa': item.pr_multa ? parseFloat(item.pr_multa) : 0
        };
      });

      // Criar workbook e worksheet
      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contas a Receber');

      // Gerar arquivo
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

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

  // Calcular totais para os cards
  const calcularTotais = () => {
    const totais = dadosProcessados.reduce((acc, item) => {
      acc.valorFaturado += parseFloat(item.vl_fatura) || 0;
      acc.valorPago += parseFloat(item.vl_pago) || 0;
      acc.valorCorrigido += parseFloat(item.vl_corrigido) || 0;
      acc.valorDescontos += parseFloat(item.vl_desconto) || 0;
      return acc;
    }, {
      valorFaturado: 0,
      valorPago: 0,
      valorCorrigido: 0,
      valorDescontos: 0
    });

    // Valor a receber = Valor faturado - Valor pago
    totais.valorAPagar = totais.valorFaturado - totais.valorPago;

    return totais;
  };

  const totais = calcularTotais();

  // Funções para preparar dados dos gráficos
  const prepararDadosGraficos = () => {
    if (dadosProcessados.length === 0) return;



    // 3. Distribuição por Status
    const distribuicaoStatus = {};
    dadosProcessados.forEach(item => {
      const status = getStatusFromData(item);
      if (!distribuicaoStatus[status]) {
        distribuicaoStatus[status] = 0;
      }
      distribuicaoStatus[status] += parseFloat(item.vl_fatura) || 0;
    });

    // 4. Análise de Clientes (Top 10)
    const analiseClientes = {};
    dadosProcessados.forEach(item => {
      const cliente = item.nm_cliente || 'Cliente não identificado';
      if (!analiseClientes[cliente]) {
        analiseClientes[cliente] = { faturado: 0, pago: 0, vencido: 0 };
      }
      analiseClientes[cliente].faturado += parseFloat(item.vl_fatura) || 0;
      analiseClientes[cliente].pago += parseFloat(item.vl_pago) || 0;
      
      const status = getStatusFromData(item);
      if (status === 'Vencido') {
        analiseClientes[cliente].vencido += parseFloat(item.vl_fatura) || 0;
      }
    });

    // 5. Top 10 Clientes Inadimplentes
    const clientesInadimplentes = {};
    dadosProcessados.forEach(item => {
      const status = getStatusFromData(item);
      if (status === 'Vencido') {
        const cliente = item.nm_cliente || 'Cliente não identificado';
        if (!clientesInadimplentes[cliente]) {
          clientesInadimplentes[cliente] = 0;
        }
        clientesInadimplentes[cliente] += parseFloat(item.vl_fatura) || 0;
      }
    });



    // 6. Análise de Inadimplência
    const inadimplencia = {};
    dadosProcessados.forEach(item => {
      const status = getStatusFromData(item);
      if (status === 'Vencido') {
        const dv = parseDateNoTZ(item.dt_vencimento);
        const base = new Date(); base.setHours(0,0,0,0);
        const diasVencido = dv ? Math.floor((base - dv) / (1000 * 60 * 60 * 24)) : 0;
        let faixa = '';
        
        if (diasVencido === 1) faixa = 'Vencidos a 1 dia';
        else if (diasVencido <= 5) faixa = 'Vencidos a 5 dias';
        else if (diasVencido <= 15) faixa = 'Vencidos a 15 dias';
        else if (diasVencido <= 30) faixa = 'Vencidos a 30 dias';
        else faixa = 'Vencidos a mais de 30 dias';
        
        if (!inadimplencia[faixa]) {
          inadimplencia[faixa] = 0;
        }
        inadimplencia[faixa] += parseFloat(item.vl_fatura) || 0;
      }
    });

    // 7. Tipos de Documento
    const tiposDocumento = {};
    dadosProcessados.forEach(item => {
      const tipo = converterTipoDocumento(item.tp_documento);
      if (!tiposDocumento[tipo]) {
        tiposDocumento[tipo] = 0;
      }
      tiposDocumento[tipo] += parseFloat(item.vl_fatura) || 0;
    });

    setDadosGraficos({
      distribuicaoStatus: Object.entries(distribuicaoStatus).map(([status, valor]) => ({
        status,
        valor
      })),
      analiseClientes: Object.entries(analiseClientes)
        .map(([cliente, valores]) => ({
          cliente: cliente.length > 15 ? cliente.substring(0, 15) + '...' : cliente,
          clienteCompleto: cliente,
          ...valores
        }))
        .sort((a, b) => b.faturado - a.faturado)
        .slice(0, 10),
      inadimplencia: Object.entries(inadimplencia).map(([faixa, valor]) => ({
        faixa,
        valor
      })),
      clientesInadimplentes: Object.entries(clientesInadimplentes)
        .map(([cliente, valor]) => ({
          cliente: cliente.length > 15 ? cliente.substring(0, 15) + '...' : cliente,
          clienteCompleto: cliente,
          valor
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10),
      tiposDocumento: Object.entries(tiposDocumento)
        .map(([tipo, valor]) => ({ tipo, valor }))
        .sort((a, b) => a.valor - b.valor)
    });
  };

  // Função para determinar status baseado nos dados
  const getStatusFromData = (item) => {
    if (parseFloat(item.vl_pago) > 0) return 'Pago';
    if (item.dt_vencimento) {
      const dv = parseDateNoTZ(item.dt_vencimento);
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      // Vencido: data de vencimento menor que hoje (passou da data)
      if (dv && dv < hoje) return 'Vencido';
    }
    // A Vencer: data de vencimento maior ou igual a hoje (incluindo hoje)
    return 'A Vencer';
  };

  // Executar preparação dos dados quando dados, situação ou status mudarem
  useEffect(() => {
    prepararDadosGraficos();
  }, [dados, situacao, status]);

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
  }, [clientesSelecionados, filtroFatura, formasPagamentoSelecionadas, nomesFantasiaSelecionados, filtroCobranca, filtroTipoCliente]);



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

  // Componentes de Gráficos


  const GraficoDistribuicaoStatus = ({ dados }) => {
    const CORES = ['#000638', '#4750A5', '#252E81'];
    
    if (dados.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          Nenhum dado disponível para o gráfico
        </div>
      );
    }

    return (
      <Card className="w-full bg-white">
        <CardHeader className="bg-white">
          <div className="flex items-center gap-2">
            <ChartPie size={20} className="text-green-600" />
            <CardTitle className="text-lg font-bold text-[#000638]">
              Distribuição por Status
            </CardTitle>
          </div>
          <CardDescription>
            Proporção de títulos por situação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dados}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#000638"
                dataKey="valor"
              >
                {dados.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                ))}
              </Pie>
              <RechartsTooltip 
                formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const GraficoAnaliseClientes = ({ dados }) => {
    if (dados.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          Nenhum dado disponível para o gráfico
        </div>
      );
    }

    return (
      <Card className="w-full bg-white">
        <CardHeader className="bg-white">
          <div className="flex items-center gap-2">
            <ChartBar size={20} className="text-purple-600" />
            <CardTitle className="text-lg font-bold text-[#000638]">
              Top 10 Clientes por Valor Faturado
            </CardTitle>
          </div>
          <CardDescription>
            Maiores clientes e situação de recebimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="cliente" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                fontSize={10}
                tick={{ fontSize: 10 }}
              />
              <YAxis fontSize={10} />
              <RechartsTooltip 
                formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                labelFormatter={(label) => dados.find(d => d.cliente === label)?.clienteCompleto || label}
              />
              <Legend />
              <Bar dataKey="faturado" fill="#000638" name="Faturado" />
              <Bar dataKey="pago" fill="#4750A5" name="Pago" />
              <Bar dataKey="vencido" fill="#252E81" name="Vencido" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };



  const GraficoInadimplencia = ({ dados }) => {
    const CORES = ['#000638', '#4750A5', '#252E81', '#0D155D', '#AAB1EE'];
    
    if (dados.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          Nenhum dado disponível para o gráfico
        </div>
      );
    }

    return (
      <Card className="w-full bg-white">
        <CardHeader className="bg-white">
          <div className="flex items-center gap-2">
            <Warning size={20} className="text-red-600" />
            <CardTitle className="text-lg font-bold text-[#000638]">
              Análise de Inadimplência
            </CardTitle>
          </div>
          <CardDescription>
            Distribuição de valores vencidos por faixa de atraso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dados}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ faixa, percent }) => `${faixa} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#000638"
                dataKey="valor"
              >
                {dados.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                ))}
              </Pie>
              <RechartsTooltip 
                formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const GraficoTiposDocumento = ({ dados }) => {
    const CORES = ['#000638', '#4750A5', '#252E81', '#0D155D', '#AAB1EE', '#DBDEFF'];
    
    if (dados.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          Nenhum dado disponível para o gráfico
        </div>
      );
    }

    return (
      <Card className="w-full bg-white">
        <CardHeader className="bg-white">
          <div className="flex items-center gap-2">
            <Receipt size={20} className="text-blue-600" />
            <CardTitle className="text-lg font-bold text-[#000638]">
              Formas de Pagamento
            </CardTitle>
          </div>
          <CardDescription>
            Distribuição por forma de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dados} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="tipo" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                fontSize={10}
                tick={{ fontSize: 10 }}
              />
              <YAxis fontSize={10} />
              <RechartsTooltip 
                formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="valor" fill="#000638">
                {dados.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const GraficoClientesInadimplentes = ({ dados }) => {
    const CORES = ['#000638', '#4750A5', '#252E81', '#0D155D', '#AAB1EE', '#DBDEFF', '#737CCA', '#1E2A6B', '#3A4491', '#5B67B7'];
    
    if (dados.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          Nenhum dado disponível para o gráfico
        </div>
      );
    }

    return (
      <Card className="w-full bg-white">
        <CardHeader className="bg-white">
          <div className="flex items-center gap-2">
            <Warning size={20} className="text-red-600" />
            <CardTitle className="text-lg font-bold text-[#000638]">
              Top 10 Clientes Inadimplentes
            </CardTitle>
          </div>
          <CardDescription>
            Maiores valores vencidos por cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="cliente" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                fontSize={10}
                tick={{ fontSize: 10 }}
              />
              <YAxis fontSize={10} />
              <RechartsTooltip 
                formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                labelFormatter={(label) => dados.find(d => d.cliente === label)?.clienteCompleto || label}
              />
              <Bar dataKey="valor" fill="#000638">
                {dados.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638] font-barlow">Contas a Receber</h1>



        {/* Formulário de Filtros */}
        <div className="mb-8">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2">
                <Funnel size={22} weight="bold" />
                Filtros
              </span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período e empresa para análise</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="lg:col-span-2">
                <FiltroEmpresa
                  empresasSelecionadas={empresasSelecionadas}
                  onSelectEmpresas={handleSelectEmpresas}
                  apenasEmpresa101={true}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Data Início
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="Todos">TODOS</option>
                  <option value="Pago">PAGO</option>
                  <option value="Vencido">VENCIDO</option>
                  <option value="A Vencer">A VENCER</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Situação</label>
                <select
                  value={situacao}
                  onChange={(e) => setSituacao(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="NORMAIS">NORMAIS</option>
                  <option value="CANCELADAS">CANCELADAS</option>
                  <option value="TODAS">TODAS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Cobrança</label>
                <select
                  value={filtroCobranca}
                  onChange={(e) => setFiltroCobranca(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="TODOS">TODOS</option>
                  <option value="DESCONTADA">DESCONTADA</option>
                  <option value="NÃO ESTÁ EM COBRANÇA">NÃO ESTÁ EM COBRANÇA</option>
                  <option value="SIMPLES">SIMPLES</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Tipo Cliente</label>
                <select
                  value={filtroTipoCliente}
                  onChange={(e) => setFiltroTipoCliente(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="TODOS">TODOS</option>
                  <option value="FRANQUIAS">FRANQUIAS</option>
                  <option value="OUTROS">OUTROS</option>
                </select>
              </div>
            
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Fatura</label>
                <input
                  type="text"
                  value={filtroFatura}
                  onChange={(e) => setFiltroFatura(e.target.value)}
                  placeholder="Buscar fatura..."
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div className="lg:col-span-3">
                <FiltroCliente
                  clientesSelecionados={clientesSelecionados}
                  onSelectClientes={handleSelectClientes}
                  dadosClientes={dadosClientes}
                />
              </div>
              <div className="lg:col-span-3">
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
                  className="flex items-center gap-2 bg-[#000638] text-white px-6 py-4 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-10 text-sm font-bold shadow-md tracking-wide uppercase"
                  disabled={loading || !dataInicio || !dataFim}
                >
                  {loading ? (
                    <>
                      <Spinner size={18} className="animate-spin" />
                      <span></span>
                    </>
                  ) : (
                    <>
                      <Calendar size={18} />
                      <span>Buscar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

                  {/* Painel de Filtro Mensal */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={18} className="text-[#000638]" />
                              <h3 className="font-bold text-sm text-[#000638] font-barlow">Filtro por Período (Data Vencimento)</h3>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Botão ANO */}
              <button
                onClick={() => handleFiltroMensalChange('ANO')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filtroMensal === 'ANO'
                    ? 'bg-[#000638] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                ANO
              </button>

              {/* Botões dos Meses */}
              {['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].map((mes) => (
                <button
                  key={mes}
                  onClick={() => handleFiltroMensalChange(mes)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
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
            <div className="mt-3 text-xs text-gray-500">
              <span className="font-medium">Filtro ativo:</span> {filtroMensal} 
              {filtroDia && <span className="ml-1">- Dia {filtroDia}</span>}
              <span className="ml-2">({dadosProcessados.length} registro{dadosProcessados.length !== 1 ? 's' : ''})</span>
            </div>

            {/* Filtro por Dia - aparece apenas quando um mês está selecionado */}
            {filtroMensal !== 'ANO' && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-[#000638]" />
                  <h4 className="font-bold text-sm text-[#000638] font-barlow">Filtro por Dia - {filtroMensal}</h4>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {/* Botão "Todos os Dias" */}
                  <button
                    onClick={() => setFiltroDia(null)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filtroDia === null
                        ? 'bg-[#000638] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    TODOS
                  </button>

                  {/* Botões dos dias */}
                  {Array.from({ length: obterDiasDoMes(filtroMensal) }, (_, i) => i + 1).map((dia) => (
                    <button
                      key={dia}
                      onClick={() => setFiltroDia(dia)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8 max-w-7xl mx-auto">
            {/* Valor Total Faturado */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CurrencyDollar size={18} className="text-blue-600" />
                  <CardTitle className="text-sm font-bold text-blue-700">Valor Total</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-blue-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : 
                    totais.valorFaturado.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">Valor total faturado no período</CardDescription>
              </CardContent>
            </Card>

            {/* Valor Pago */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-600" />
                  <CardTitle className="text-sm font-bold text-green-700">Valor Recebido</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-green-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                    totais.valorPago.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">Valor total pago no período</CardDescription>
              </CardContent>
            </Card>

            {/* Valor Corrigido */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-700">Valor Corrigido</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-purple-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-purple-600" /> : 
                    totais.valorCorrigido.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">Valor total corrigido no período</CardDescription>
              </CardContent>
            </Card>

            {/* Valor a Receber */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Warning size={18} className="text-red-600" />
                  <CardTitle className="text-sm font-bold text-red-700">Valor a Receber</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-red-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : 
                    totais.valorAPagar.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">Valor pendente a receber</CardDescription>
              </CardContent>
            </Card>

            {/* Valor de Descontos */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Percent size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-700">Valor de Descontos</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-orange-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-orange-600" /> : 
                    totais.valorDescontos.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">Total de descontos aplicados</CardDescription>
              </CardContent>
            </Card>

            {/* Valor a Receber no Período */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-purple-600" />
                  <CardTitle className="text-sm font-bold text-purple-700">A Receber no Período</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-lg font-extrabold text-purple-600 mb-1 break-words">
                  {loading ? <Spinner size={24} className="animate-spin text-purple-600" /> : 
                    totais.valorFaturado.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  }
                </div>
                <CardDescription className="text-xs text-gray-500">
                  {filtroMensal === 'ANO' ? 'Ano atual' : `${filtroMensal}${filtroDia ? ` - Dia ${filtroDia}` : ''}`}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 max-w-6xl mx-auto w-full">
          <div className="p-6 border-b border-[#000638]/10 flex justify-between items-center">
            <h2 className="text-xl font-bold text-[#000638] font-barlow">Detalhamento de Contas a Receber</h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {dadosCarregados ? `${dadosProcessados.length} registros encontrados` : 'Nenhum dado carregado'}
              </div>
              {dadosProcessados.length > 0 && (
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                >
                  <FileArrowDown size={16} />
                  BAIXAR EXCEL
                </button>
              )}
            </div>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="flex items-center gap-3">
                  <Spinner size={32} className="animate-spin text-blue-600" />
                  <span className="text-gray-600">Carregando dados...</span>
                </div>
              </div>
            ) : !dadosCarregados ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">Clique em "Buscar Dados" para carregar as informações</div>
                  <div className="text-gray-400 text-sm">Selecione o período e empresa desejados</div>
                </div>
              </div>
            ) : dados.length === 0 ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">Nenhum dado encontrado</div>
                  <div className="text-gray-400 text-sm">Verifique o período selecionado ou tente novamente</div>
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
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('cd_cliente')}
                      >
                        <div className="flex items-center justify-center">
                          Cliente
                          {getSortIcon('cd_cliente')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-left text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('nm_cliente')}
                      >
                        <div className="flex items-center">
                          Nome Cliente
                          {getSortIcon('nm_cliente')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('nm_fantasia')}
                      >
                        <div className="flex items-center justify-center">
                          Nome Fantasia
                          {getSortIcon('nm_fantasia')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('ds_siglaest')}
                      >
                        <div className="flex items-center justify-center">
                          Estado
                          {getSortIcon('ds_siglaest')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('dt_emissao')}
                      >
                        <div className="flex items-center justify-center">
                          Emissão
                          {getSortIcon('dt_emissao')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('dt_vencimento')}
                      >
                        <div className="flex items-center justify-center">
                          Vencimento
                          {getSortIcon('dt_vencimento')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_fatura')}
                      >
                        <div className="flex items-center justify-center">
                          Valor Fatura
                          {getSortIcon('vl_fatura')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_pago')}
                      >
                        <div className="flex items-center justify-center">
                          Valor Pago
                          {getSortIcon('vl_pago')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_desconto')}
                      >
                        <div className="flex items-center justify-center">
                          Desconto
                          {getSortIcon('vl_desconto')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_corrigido')}
                      >
                        <div className="flex items-center justify-center">
                          Valor Corrigido
                          {getSortIcon('vl_corrigido')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('tp_documento')}
                      >
                        <div className="flex items-center justify-center">
                          Formas de Pagamento
                          {getSortIcon('tp_documento')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('dt_liq')}
                      >
                        <div className="flex items-center justify-center">
                          Liquidação
                          {getSortIcon('dt_liq')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('tp_cobranca')}
                      >
                        <div className="flex items-center justify-center">
                          Cobrança
                          {getSortIcon('tp_cobranca')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('cd_empresa')}
                      >
                        <div className="flex items-center justify-center">
                          Empresa
                          {getSortIcon('cd_empresa')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('nr_parcela')}
                      >
                        <div className="flex items-center justify-center">
                          Parcela
                          {getSortIcon('nr_parcela')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('dt_cancelamento')}
                      >
                        <div className="flex items-center justify-center">
                          Cancelamento
                          {getSortIcon('dt_cancelamento')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('tp_faturamento')}
                      >
                        <div className="flex items-center justify-center">
                          Faturamento
                          {getSortIcon('tp_faturamento')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('tp_inclusao')}
                      >
                        <div className="flex items-center justify-center">
                          Inclusão
                          {getSortIcon('tp_inclusao')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('tp_baixa')}
                      >
                        <div className="flex items-center justify-center">
                          Baixa
                          {getSortIcon('tp_baixa')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('tp_situacao')}
                      >
                        <div className="flex items-center justify-center">
                          Situação
                          {getSortIcon('tp_situacao')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_original')}
                      >
                        <div className="flex items-center justify-center">
                          Valor Original
                          {getSortIcon('vl_original')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_abatimento')}
                      >
                        <div className="flex items-center justify-center">
                          Abatimento
                          {getSortIcon('vl_abatimento')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_liquido')}
                      >
                        <div className="flex items-center justify-center">
                          Valor Líquido
                          {getSortIcon('vl_liquido')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_acrescimo')}
                      >
                        <div className="flex items-center justify-center">
                          Acréscimo
                          {getSortIcon('vl_acrescimo')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_multa')}
                      >
                        <div className="flex items-center justify-center">
                          Multa
                          {getSortIcon('vl_multa')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('nr_portador')}
                      >
                        <div className="flex items-center justify-center">
                          Portador
                          {getSortIcon('nr_portador')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_renegociacao')}
                      >
                        <div className="flex items-center justify-center">
                          Renegociação
                          {getSortIcon('vl_renegociacao')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('vl_juros')}
                      >
                        <div className="flex items-center justify-center">
                          Juros
                          {getSortIcon('vl_juros')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                        onClick={() => handleSort('pr_juromes')}
                      >
                        <div className="flex items-center justify-center">
                          % Juros/Mês
                          {getSortIcon('pr_juromes')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
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
                      <tr key={index} className="text-[10px] transition-colors">
                        <td className="text-center text-gray-900">
                          {item.cd_cliente || '--'}
                        </td>
                        <td className="text-left text-gray-900">
                          {item.nm_cliente || '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {(() => {
                            const key = String(item.cd_cliente).trim();
                            const fantasia = infoPessoas[key]?.nm_fantasia || '';
                            const ehFranquia = fantasia.toUpperCase().includes(' - CROSBY');
                            return (
                              <div className="flex items-center justify-center gap-2">
                                <span>{fantasia || '--'}</span>
                                {ehFranquia && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 border border-blue-300">
                                    FRANQUIA
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="text-center text-gray-900">
                          {infoPessoas[String(item.cd_cliente).trim()]?.ds_siglaest || '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {formatDateBR(item.dt_emissao)}
                        </td>
                        <td className="text-center text-gray-900">
                          {formatDateBR(item.dt_vencimento)}
                        </td>
                        <td className="text-center font-semibold text-green-600">
                          {(parseFloat(item.vl_fatura) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center font-semibold text-blue-600">
                          {(parseFloat(item.vl_pago) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {(parseFloat(item.vl_desconto) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {(parseFloat(item.vl_corrigido) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {converterTipoDocumento(item.tp_documento)}
                        </td>
                        <td className="text-center text-gray-900">
                          {formatDateBR(item.dt_liq)}
                        </td>
                        <td className="text-center text-gray-900">
                          {(() => {
                            const tipo = item.tp_cobranca;
                            if (tipo === '2') return 'DESCONTADA';
                            if (tipo === '0') return 'NÃO ESTÁ EM COBRANÇA';
                            if (tipo === '1') return 'SIMPLES';
                            return tipo || '--';
                          })()}
                        </td>
                        <td className="text-center text-gray-900">
                          {item.cd_empresa || '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {item.nr_parcela || '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {formatDateBR(item.dt_cancelamento)}
                        </td>
                        <td className="text-center text-gray-900">
                          {item.tp_faturamento || '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {item.tp_inclusao || '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {item.tp_baixa || '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {item.tp_situacao || '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {(parseFloat(item.vl_original) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {(parseFloat(item.vl_abatimento) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {(parseFloat(item.vl_liquido) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {(parseFloat(item.vl_acrescimo) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {(parseFloat(item.vl_multa) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {item.nr_portador || '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {(parseFloat(item.vl_renegociacao) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {(parseFloat(item.vl_juros) || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center text-gray-900">
                          {item.pr_juromes ? `${parseFloat(item.pr_juromes).toFixed(2)}%` : '--'}
                        </td>
                        <td className="text-center text-gray-900">
                          {item.pr_multa ? `${parseFloat(item.pr_multa).toFixed(2)}%` : '--'}
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
                       Mostrando {((paginaAtual - 1) * itensPorPagina) + 1} a {Math.min(paginaAtual * itensPorPagina, dadosProcessados.length)} de {dadosProcessados.length} registros
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
                             onClick={() => typeof pagina === 'number' && irParaPagina(pagina)}
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
                         disabled={paginaAtual === Math.ceil(dadosProcessados.length / itensPorPagina)}
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

        {/* Gráficos */}
        {dadosCarregados && dadosProcessados.length > 0 && (
          <div className="space-y-6 mb-8 mt-8">
            {/* Gráfico Top 10 Clientes - Tela completa */}
            <div className="w-full">
              <GraficoAnaliseClientes dados={dadosGraficos.analiseClientes} />
            </div>
            
            {/* Análise de Inadimplência e Distribuição por Status - Lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GraficoInadimplencia dados={dadosGraficos.inadimplencia} />
              <GraficoDistribuicaoStatus dados={dadosGraficos.distribuicaoStatus} />
            </div>
            
            {/* Tipos de Documento - Tela completa */}
            <div className="w-full">
              <GraficoTiposDocumento dados={dadosGraficos.tiposDocumento} />
            </div>
            
            {/* Top 10 Clientes Inadimplentes - Tela completa */}
            <div className="w-full">
              <GraficoClientesInadimplentes dados={dadosGraficos.clientesInadimplentes} />
            </div>
          </div>
        )}
      </div>
    );
};

export default ContasAReceber; 