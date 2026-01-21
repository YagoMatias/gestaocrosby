import React, { useEffect, useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import FiltroEmpresa from '../components/FiltroEmpresa';
import FiltroCliente from '../components/FiltroCliente';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import {
  Wallet,
  Funnel,
  Spinner,
  CaretUp,
  CaretDown,
  CaretUpDown,
  Calendar,
  UploadSimple,
  X,
  Bank,
  File,
  CheckCircle,
  WarningCircle,
  CheckSquare,
  XSquare,
  DownloadSimple,
  CurrencyCircleDollar,
} from '@phosphor-icons/react';

const BatidaCarteira = () => {
  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [status, setStatus] = useState('Todos');
  const [situacao, setSituacao] = useState('NORMAIS');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);

  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(50);

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });
  const [ordenacaoImportados, setOrdenacaoImportados] = useState({
    campo: null,
    direcao: 'asc',
  });

  // Estados para filtros adicionais
  const [filtroFatura, setFiltroFatura] = useState('');
  const [filtroPortador, setFiltroPortador] = useState('');
  const [filtroCobranca, setFiltroCobranca] = useState('TODOS');

  // Estados para os filtros de seleção múltipla
  const [clientesSelecionados, setClientesSelecionados] = useState([]);
  const [dadosClientes, setDadosClientes] = useState([]);

  // Estados para modal de importação
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [bancoSelecionado, setBancoSelecionado] = useState('');
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResultado, setUploadResultado] = useState(null);
  const [dadosImportados, setDadosImportados] = useState([]);
  const [bancoImportado, setBancoImportado] = useState(''); // Persiste após fechar modal

  // Estado para modal de detalhes dos cards
  const [modalDetalheAberto, setModalDetalheAberto] = useState(null); // null, 'batidos', 'soSistema', 'soArquivo', 'divergentes'

  const bancos = [
    { codigo: 'BRADESCO', nome: 'Bradesco' },
    { codigo: 'SANTANDER', nome: 'Santander' },
    { codigo: 'BB', nome: 'Banco do Brasil' },
    { codigo: 'CEF', nome: 'Caixa Econômica Federal' },
    { codigo: 'ITAU', nome: 'Itaú' },
    { codigo: 'SICREDI', nome: 'Sicredi' },
    { codigo: 'UNICRED', nome: 'Unicred' },
    { codigo: 'DAYCOVAL', nome: 'Daycoval' },
    { codigo: 'CONFIANCA', nome: 'Confiança' },
  ];

  const BaseURL = 'https://apigestaocrosby-bw2v.onrender.com/api/financial/';

  // Helpers de data
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

  // Função para converter tipo de cobrança
  const converterTipoCobranca = (numero) => {
    const tipos = {
      0: 'Não Cobrança',
      1: 'Simples',
      2: 'Descontada',
    };
    return tipos[numero] || '--';
  };

  // Função para formatar CPF/CNPJ
  const formatCpfCnpj = (valor) => {
    if (!valor) return '--';
    const numeros = String(valor).replace(/\D/g, '');
    if (numeros.length === 11) {
      // CPF: 000.000.000-00
      return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (numeros.length === 14) {
      // CNPJ: 00.000.000/0000-00
      return numeros.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        '$1.$2.$3/$4-$5',
      );
    }
    return valor;
  };

  // Função para converter tipo de documento
  const converterTipoDocumento = (numero) => {
    const tiposDocumento = {
      1: 'Fatura',
      2: 'Duplicata',
      3: 'Nota Promissória',
      4: 'Cheque',
      5: 'Recibo',
      6: 'Carnê',
      7: 'Boleto',
      8: 'Contrato',
      9: 'Transferência',
      10: 'Dinheiro',
      11: 'Cartão Crédito',
      12: 'Cartão Débito',
      13: 'PIX',
      14: 'Depósito',
      15: 'Outros',
    };
    return tiposDocumento[numero] || `Tipo ${numero}`;
  };

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

  // Função para ordenação dos dados importados
  const handleSortImportados = useCallback((campo) => {
    setOrdenacaoImportados((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Função para ícone de ordenação dos dados importados
  const getSortIconImportados = useCallback(
    (campo) => {
      if (ordenacaoImportados.campo !== campo) {
        return <CaretUpDown size={12} className="opacity-50" />;
      }
      return ordenacaoImportados.direcao === 'asc' ? (
        <CaretUp size={12} />
      ) : (
        <CaretDown size={12} />
      );
    },
    [ordenacaoImportados],
  );

  // Definir data inicial
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const formatarData = (data) => {
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const dia = String(data.getDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    };

    setDataInicio(formatarData(primeiroDia));
    setDataFim(formatarData(ultimoDia));
  }, []);

  const buscarDados = async (inicio = dataInicio, fim = dataFim) => {
    if (!inicio || !fim) return;

    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }

    setLoading(true);
    setPaginaAtual(1);
    try {
      const params = new URLSearchParams();
      params.append('dt_inicio', inicio);
      params.append('dt_fim', fim);

      // Adicionar todas as empresas selecionadas
      empresasSelecionadas.forEach((empresa) => {
        params.append('cd_empresa', empresa.cd_empresa);
      });

      // Adicionar filtro de status
      if (status && status !== 'Todos') {
        params.append('status', status);
      }

      // Adicionar filtro de situação
      if (situacao && situacao !== 'TODAS') {
        params.append('situacao', situacao);
      }

      // Adicionar filtro de cobrança
      if (filtroCobranca && filtroCobranca !== 'TODOS') {
        let cobrancaParam = filtroCobranca;
        if (filtroCobranca === 'NÃO ESTÁ EM COBRANÇA') {
          cobrancaParam = 'NAO_COBRANCA';
        }
        params.append('tp_cobranca', cobrancaParam);
      }

      // Adicionar filtro de clientes
      if (clientesSelecionados.length > 0) {
        clientesSelecionados.forEach((cliente) => {
          params.append('cd_cliente', cliente.cd_cliente);
        });
      }

      // Forma de pagamento fixo em 1 - FATURA
      params.append('tp_documento', '1');

      // Adicionar filtro de fatura
      if (filtroFatura && filtroFatura.trim() !== '') {
        params.append('nr_fatura', filtroFatura.trim());
      }

      // Adicionar filtro de portador (suporta múltiplos separados por vírgula)
      if (filtroPortador && filtroPortador.trim() !== '') {
        const portadores = filtroPortador
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p !== '');
        portadores.forEach((portador) => {
          params.append('nr_portador', portador);
        });
      }

      const url = `${BaseURL}contas-receber?${params.toString()}`;
      console.log('🔍 URL da requisição:', url);

      const res = await fetch(url);

      if (!res.ok) {
        console.warn(`Erro ao buscar dados: HTTP ${res.status}`);
        setDados([]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      console.log('📦 Resposta da API:', data);

      let todosOsDados = [];
      if (Array.isArray(data)) {
        todosOsDados = data;
      } else if (data && typeof data === 'object') {
        if (data.dados && Array.isArray(data.dados)) {
          todosOsDados = data.dados;
        } else if (data.data && Array.isArray(data.data)) {
          todosOsDados = data.data;
        } else if (
          data.data &&
          data.data.data &&
          Array.isArray(data.data.data)
        ) {
          todosOsDados = data.data.data;
        } else if (data.result && Array.isArray(data.result)) {
          todosOsDados = data.result;
        } else if (data.contas && Array.isArray(data.contas)) {
          todosOsDados = data.contas;
        } else {
          todosOsDados = Object.values(data);
        }
      }

      todosOsDados = todosOsDados.filter(
        (item) => item && typeof item === 'object',
      );

      console.log('📊 Total de dados:', todosOsDados.length);

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
    setClientesSelecionados([...clientes]);
  };

  // Função para fazer upload do arquivo bancário
  const handleUploadArquivo = async () => {
    if (!bancoSelecionado) {
      alert('Selecione um banco!');
      return;
    }
    if (!arquivoSelecionado) {
      alert('Selecione um arquivo!');
      return;
    }

    setUploadLoading(true);
    setUploadResultado(null);

    try {
      const formData = new FormData();
      formData.append('arquivo', arquivoSelecionado);
      formData.append('banco', bancoSelecionado);

      const response = await fetch(`${BaseURL}batida-carteira/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success !== false) {
        setUploadResultado({
          success: true,
          message: data.message || 'Arquivo processado com sucesso!',
          stats: data.data?.stats || data.stats,
        });
        setDadosImportados(data.data?.registros || data.registros || []);
        setBancoImportado(bancoSelecionado); // Salvar o banco importado
      } else {
        setUploadResultado({
          success: false,
          message: data.message || data.error || 'Erro ao processar arquivo',
        });
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadResultado({
        success: false,
        message: 'Erro ao enviar arquivo. Verifique sua conexão.',
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // Função para fechar o modal e limpar estados
  const fecharModalImportar = () => {
    setModalImportarAberto(false);
    setBancoSelecionado('');
    setArquivoSelecionado(null);
    setUploadResultado(null);
  };

  // Função para normalizar CPF/CNPJ (remover caracteres especiais e identificar corretamente)
  const normalizarCpfCnpj = (valor) => {
    if (!valor) return '';
    // Remove todos os caracteres não numéricos
    let numeros = String(valor).replace(/\D/g, '');

    // Se tiver 14 dígitos e os 3 primeiros forem zeros, pode ser um CPF com zeros à esquerda
    // CPF: 11 dígitos, CNPJ: 14 dígitos
    if (numeros.length === 14) {
      // Verifica se é um CPF disfarçado de CNPJ (3 zeros à esquerda + 11 dígitos de CPF)
      if (numeros.startsWith('000')) {
        // Remove os 3 zeros à esquerda para ficar como CPF de 11 dígitos
        numeros = numeros.substring(3);
      }
    }

    // Padronizar: CPF sempre com 11 dígitos, CNPJ sempre com 14 dígitos
    if (numeros.length <= 11) {
      // É um CPF - padroniza para 11 dígitos
      numeros = numeros.padStart(11, '0');
    } else if (numeros.length <= 14) {
      // É um CNPJ - padroniza para 14 dígitos
      numeros = numeros.padStart(14, '0');
    }

    return numeros;
  };

  // Função para normalizar data (formato YYYY-MM-DD)
  const normalizarData = (data) => {
    if (!data) return '';
    const d = parseDateNoTZ(data);
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Função para normalizar valor (arredondar para 2 casas decimais)
  const normalizarValor = (valor) => {
    return (parseFloat(valor) || 0).toFixed(2);
  };

  // Criar chave de comparação
  const criarChaveComparacao = (cpfcnpj, valor, dataVencimento) => {
    return `${normalizarCpfCnpj(cpfcnpj)}|${normalizarValor(
      valor,
    )}|${normalizarData(dataVencimento)}`;
  };

  // Set de chaves dos dados importados para comparação rápida
  const chavesImportados = useMemo(() => {
    const set = new Set();
    dadosImportados.forEach((item) => {
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        item.vl_original,
        item.dt_vencimento,
      );
      set.add(chave);
    });
    return set;
  }, [dadosImportados]);

  // Set de chaves dos dados do sistema para comparação rápida
  const chavesSistema = useMemo(() => {
    const set = new Set();
    dados.forEach((item) => {
      // Adicionar 0.98 ao valor da fatura do sistema para comparar
      const valorComTaxa = parseFloat(item.vl_fatura || 0) + 0.98;
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        valorComTaxa,
        item.dt_vencimento,
      );
      set.add(chave);
    });
    return set;
  }, [dados]);

  // Dados ordenados com batidos primeiro e alinhados
  const dadosOrdenados = useMemo(() => {
    if (dadosImportados.length === 0) {
      // Sem dados importados, ordenação normal
      if (!ordenacao.campo) return dados;
      return [...dados].sort((a, b) => {
        let valorA = a[ordenacao.campo];
        let valorB = b[ordenacao.campo];
        if (
          ordenacao.campo === 'dt_vencimento' ||
          ordenacao.campo === 'dt_emissao'
        ) {
          valorA = parseDateNoTZ(valorA)?.getTime() || 0;
          valorB = parseDateNoTZ(valorB)?.getTime() || 0;
        }
        if (ordenacao.campo === 'vl_fatura' || ordenacao.campo === 'nr_fat') {
          valorA = parseFloat(valorA) || 0;
          valorB = parseFloat(valorB) || 0;
        }
        if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
        if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Separar batidos e não batidos
    const batidos = [];
    const naoBatidos = [];

    dados.forEach((item) => {
      const valorComTaxa = parseFloat(item.vl_fatura || 0) + 0.98;
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        valorComTaxa,
        item.dt_vencimento,
      );
      if (chavesImportados.has(chave)) {
        batidos.push({ ...item, _chaveComparacao: chave });
      } else {
        naoBatidos.push(item);
      }
    });

    // Ordenar batidos pela chave de comparação para alinhar com importados
    batidos.sort((a, b) =>
      a._chaveComparacao.localeCompare(b._chaveComparacao),
    );

    // Retornar batidos primeiro, depois não batidos
    return [...batidos, ...naoBatidos];
  }, [dados, dadosImportados, chavesImportados, ordenacao]);

  // Dados importados ordenados com batidos primeiro e alinhados
  const dadosImportadosOrdenados = useMemo(() => {
    if (dados.length === 0) {
      // Sem dados do sistema, ordenação normal
      if (!ordenacaoImportados.campo) return dadosImportados;
      return [...dadosImportados].sort((a, b) => {
        let valorA = a[ordenacaoImportados.campo];
        let valorB = b[ordenacaoImportados.campo];
        if (
          ordenacaoImportados.campo === 'dt_vencimento' ||
          ordenacaoImportados.campo === 'dt_pagamento'
        ) {
          valorA = parseDateNoTZ(valorA)?.getTime() || 0;
          valorB = parseDateNoTZ(valorB)?.getTime() || 0;
        }
        if (
          ordenacaoImportados.campo === 'vl_original' ||
          ordenacaoImportados.campo === 'vl_pago' ||
          ordenacaoImportados.campo === 'nr_fatura'
        ) {
          valorA = parseFloat(valorA) || 0;
          valorB = parseFloat(valorB) || 0;
        }
        if (valorA < valorB)
          return ordenacaoImportados.direcao === 'asc' ? -1 : 1;
        if (valorA > valorB)
          return ordenacaoImportados.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Separar batidos e não batidos
    const batidos = [];
    const naoBatidos = [];

    dadosImportados.forEach((item) => {
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        item.vl_original,
        item.dt_vencimento,
      );
      if (chavesSistema.has(chave)) {
        batidos.push({ ...item, _chaveComparacao: chave });
      } else {
        naoBatidos.push(item);
      }
    });

    // Ordenar batidos pela chave de comparação para alinhar com sistema
    batidos.sort((a, b) =>
      a._chaveComparacao.localeCompare(b._chaveComparacao),
    );

    // Retornar batidos primeiro, depois não batidos
    return [...batidos, ...naoBatidos];
  }, [dadosImportados, dados, chavesSistema, ordenacaoImportados]);

  // Função para verificar se item do sistema está nos importados
  const itemSistemaEncontrado = useCallback(
    (item) => {
      const valorComTaxa = parseFloat(item.vl_fatura || 0) + 0.98;
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        valorComTaxa,
        item.dt_vencimento,
      );
      return chavesImportados.has(chave);
    },
    [chavesImportados],
  );

  // Função para verificar se item importado está no sistema
  const itemImportadoEncontrado = useCallback(
    (item) => {
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        item.vl_original,
        item.dt_vencimento,
      );
      return chavesSistema.has(chave);
    },
    [chavesSistema],
  );

  // Calcular totais para os cards
  const totaisBatida = useMemo(() => {
    if (dadosImportados.length === 0 || dados.length === 0) {
      return {
        batidosQtd: 0,
        batidosValor: 0,
        naoBatidosSistemaQtd: 0,
        naoBatidosSistemaValor: 0,
        naoBatidosImportadosQtd: 0,
        naoBatidosImportadosValor: 0,
      };
    }

    let batidosQtd = 0;
    let batidosValor = 0;
    let naoBatidosSistemaQtd = 0;
    let naoBatidosSistemaValor = 0;
    let naoBatidosImportadosQtd = 0;
    let naoBatidosImportadosValor = 0;

    // Verificar dados do sistema
    dados.forEach((item) => {
      const valorComTaxa = parseFloat(item.vl_fatura || 0) + 0.98;
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        valorComTaxa,
        item.dt_vencimento,
      );
      if (chavesImportados.has(chave)) {
        batidosQtd++;
        batidosValor += valorComTaxa;
      } else {
        naoBatidosSistemaQtd++;
        naoBatidosSistemaValor += valorComTaxa;
      }
    });

    // Verificar dados importados que não estão no sistema
    dadosImportados.forEach((item) => {
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        item.vl_original,
        item.dt_vencimento,
      );
      if (!chavesSistema.has(chave)) {
        naoBatidosImportadosQtd++;
        naoBatidosImportadosValor += parseFloat(item.vl_original || 0);
      }
    });

    return {
      batidosQtd,
      batidosValor,
      naoBatidosSistemaQtd,
      naoBatidosSistemaValor,
      naoBatidosImportadosQtd,
      naoBatidosImportadosValor,
    };
  }, [dados, dadosImportados, chavesImportados, chavesSistema]);

  // Listas filtradas para os modais
  const listaBatidosSistema = useMemo(() => {
    return dados.filter((item) => {
      const valorComTaxa = parseFloat(item.vl_fatura || 0) + 0.98;
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        valorComTaxa,
        item.dt_vencimento,
      );
      return chavesImportados.has(chave);
    });
  }, [dados, chavesImportados]);

  const listaNaoBatidosSistema = useMemo(() => {
    return dados.filter((item) => {
      const valorComTaxa = parseFloat(item.vl_fatura || 0) + 0.98;
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        valorComTaxa,
        item.dt_vencimento,
      );
      return !chavesImportados.has(chave);
    });
  }, [dados, chavesImportados]);

  const listaNaoBatidosImportados = useMemo(() => {
    return dadosImportados.filter((item) => {
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        item.vl_original,
        item.dt_vencimento,
      );
      return !chavesSistema.has(chave);
    });
  }, [dadosImportados, chavesSistema]);

  // Mapa para buscar dados do arquivo importado por chave (para pegar liquidação nos batidos)
  const mapaImportadosPorChave = useMemo(() => {
    const mapa = new Map();
    dadosImportados.forEach((item) => {
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        item.vl_original,
        item.dt_vencimento,
      );
      mapa.set(chave, item);
    });
    return mapa;
  }, [dadosImportados]);

  // Lista de registros com baixa "PGTO DE TITULO EFETUADO P/CEDENTE" ou "TITULO DEBITADO EM OPERACAO" (somente CONFIANCA)
  const listaPgtoCedente = useMemo(() => {
    if (bancoImportado !== 'CONFIANCA') return [];
    return dadosImportados.filter((item) => {
      const baixa = (item.descricao_baixa || '').toUpperCase();
      return (
        baixa.includes('PGTO DE TITULO EFETUADO P/CEDENTE') ||
        baixa.includes('TITULO DEBITADO EM OPERACAO')
      );
    });
  }, [dadosImportados, bancoImportado]);

  // Totais para o card PGTO Cedente
  const totaisPgtoCedente = useMemo(() => {
    const qtd = listaPgtoCedente.length;
    const valor = listaPgtoCedente.reduce(
      (acc, item) => acc + parseFloat(item.vl_original || 0),
      0,
    );
    const batidosQtd = listaPgtoCedente.filter((item) => {
      const chave = criarChaveComparacao(
        item.nr_cpfcnpj,
        item.vl_original,
        item.dt_vencimento,
      );
      return chavesSistema.has(chave);
    }).length;
    const naoBatidosQtd = qtd - batidosQtd;
    return { qtd, valor, batidosQtd, naoBatidosQtd };
  }, [listaPgtoCedente, chavesSistema]);

  // Função para buscar item do arquivo correspondente ao item do sistema
  const buscarItemImportadoCorrespondente = useCallback(
    (itemSistema) => {
      const valorComTaxa = parseFloat(itemSistema.vl_fatura || 0) + 0.98;
      const chave = criarChaveComparacao(
        itemSistema.nr_cpfcnpj,
        valorComTaxa,
        itemSistema.dt_vencimento,
      );
      return mapaImportadosPorChave.get(chave);
    },
    [mapaImportadosPorChave],
  );

  // Função para exportar dados para Excel
  const exportarParaExcel = useCallback(() => {
    if (!modalDetalheAberto) return;

    const dataAtual = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const nomeBanco = bancoImportado || 'SemBanco';

    const nomesCard = {
      batidos: 'FaturasBatidas',
      soSistema: 'SoNoSistema',
      soArquivo: 'SoNoArquivo',
      divergentes: 'TotalDivergentes',
      pgtoCedente: 'PgtoCedente',
    };
    const nomeCard = nomesCard[modalDetalheAberto];
    const nomeArquivo = `${nomeBanco}-${dataAtual}-${nomeCard}.xlsx`;

    const workbook = XLSX.utils.book_new();

    // Preparar dados do sistema (batidos ou só no sistema)
    if (
      modalDetalheAberto === 'batidos' ||
      modalDetalheAberto === 'soSistema' ||
      modalDetalheAberto === 'divergentes'
    ) {
      const listaSistema =
        modalDetalheAberto === 'batidos'
          ? listaBatidosSistema
          : listaNaoBatidosSistema;
      const dadosSistema = listaSistema.map((item) => {
        const itemImportado = buscarItemImportadoCorrespondente(item);
        return {
          Cód: item.cd_cliente || '',
          Fatura: item.nr_fat || '',
          Cliente: item.nm_cliente || '',
          'CPF/CNPJ': item.nr_cpfcnpj || '',
          Valor: parseFloat(item.vl_fatura || 0) + 0.98,
          Vencimento: formatDateBR(item.dt_vencimento),
          Empresa: item.cd_empresa || '',
          ...(modalDetalheAberto === 'batidos' && {
            Liquidação: formatDateBR(itemImportado?.dt_pagamento),
          }),
        };
      });
      const wsSistema = XLSX.utils.json_to_sheet(dadosSistema);
      XLSX.utils.book_append_sheet(
        workbook,
        wsSistema,
        modalDetalheAberto === 'divergentes' ? 'Só no Sistema' : 'Dados',
      );
    }

    // Preparar dados do arquivo (só no arquivo ou divergentes)
    if (
      modalDetalheAberto === 'soArquivo' ||
      modalDetalheAberto === 'divergentes'
    ) {
      const dadosArquivo = listaNaoBatidosImportados.map((item) => ({
        'Nosso Número': item.nosso_numero || '',
        Cliente: item.nm_cliente || '',
        'CPF/CNPJ': item.nr_cpfcnpj || '',
        Valor: parseFloat(item.vl_original || 0),
        'Vl.Pago': parseFloat(item.vl_pago || 0),
        Vencimento: formatDateBR(item.dt_vencimento),
        BAIXA: item.descricao_baixa || '',
        Liquidação: formatDateBR(item.dt_pagamento),
      }));
      const wsArquivo = XLSX.utils.json_to_sheet(dadosArquivo);
      XLSX.utils.book_append_sheet(
        workbook,
        wsArquivo,
        modalDetalheAberto === 'divergentes' ? 'Só no Arquivo' : 'Dados',
      );
    }

    // Preparar dados do modal PGTO Cedente (somente CONFIANCA)
    if (modalDetalheAberto === 'pgtoCedente') {
      const dadosPgtoCedente = listaPgtoCedente.map((item) => {
        const chave = criarChaveComparacao(
          item.nr_cpfcnpj,
          item.vl_original,
          item.dt_vencimento,
        );
        const batido = chavesSistema.has(chave);
        return {
          Status: batido ? 'BATIDO' : 'NÃO BATIDO',
          'Nosso Número': item.nosso_numero || '',
          Cliente: item.nm_cliente || '',
          'CPF/CNPJ': item.nr_cpfcnpj || '',
          Valor: parseFloat(item.vl_original || 0),
          'Vl.Pago': parseFloat(item.vl_pago || 0),
          Vencimento: formatDateBR(item.dt_vencimento),
          BAIXA: item.descricao_baixa || '',
          Liquidação: formatDateBR(item.dt_pagamento),
        };
      });
      const wsPgtoCedente = XLSX.utils.json_to_sheet(dadosPgtoCedente);
      XLSX.utils.book_append_sheet(workbook, wsPgtoCedente, 'Dados');
    }

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, nomeArquivo);
  }, [
    modalDetalheAberto,
    bancoImportado,
    listaBatidosSistema,
    listaNaoBatidosSistema,
    listaNaoBatidosImportados,
    listaPgtoCedente,
    chavesSistema,
    formatDateBR,
  ]);

  // Paginação
  const totalPaginas = Math.ceil(dadosOrdenados.length / itensPorPagina);
  const dadosPaginados = dadosOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina,
  );

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <div className="flex justify-between items-start mb-2">
        <PageTitle
          title="Batida de Carteira"
          subtitle="Acompanhe e gerencie a batida de carteira"
          icon={Wallet}
          iconColor="text-emerald-600"
        />
        <div className="flex gap-2">
          {dadosImportados.length > 0 && (
            <button
              onClick={() => {
                setDadosImportados([]);
                setBancoImportado('');
              }}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-bold shadow-md"
            >
              <X size={18} weight="bold" />
              Limpar Importação
            </button>
          )}
          <button
            onClick={() => setModalImportarAberto(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-bold shadow-md"
          >
            <UploadSimple size={18} weight="bold" />
            Importar Arquivo
          </button>
        </div>
      </div>

      {/* Modal de Importação */}
      {modalImportarAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="flex justify-between items-center p-4 border-b bg-[#000638] text-white rounded-t-lg">
              <div className="flex items-center gap-2">
                <Bank size={24} weight="bold" />
                <h2 className="text-lg font-bold">Importar Arquivo Bancário</h2>
              </div>
              <button
                onClick={fecharModalImportar}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-4 space-y-4">
              {/* Seleção do Banco */}
              <div>
                <label className="block text-sm font-semibold text-[#000638] mb-2">
                  Selecione o Banco
                </label>
                <select
                  value={bancoSelecionado}
                  onChange={(e) => setBancoSelecionado(e.target.value)}
                  className="w-full border border-[#000638]/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
                >
                  <option value="">Selecione um banco...</option>
                  {bancos.map((banco) => (
                    <option key={banco.codigo} value={banco.codigo}>
                      {banco.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload de Arquivo */}
              <div>
                <label className="block text-sm font-semibold text-[#000638] mb-2">
                  Selecione o Arquivo (CSV ou Excel)
                </label>
                <div className="border-2 border-dashed border-[#000638]/30 rounded-lg p-4 text-center hover:border-[#000638]/50 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.xls,.xlsx,.txt"
                    onChange={(e) => setArquivoSelecionado(e.target.files[0])}
                    className="hidden"
                    id="arquivo-upload"
                  />
                  <label
                    htmlFor="arquivo-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <File size={40} className="text-[#000638]/50" />
                    {arquivoSelecionado ? (
                      <span className="text-sm text-[#000638] font-medium">
                        {arquivoSelecionado.name}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">
                        Clique para selecionar um arquivo
                      </span>
                    )}
                  </label>
                </div>
              </div>

              {/* Resultado do Upload */}
              {uploadResultado && (
                <div
                  className={`p-4 rounded-lg ${
                    uploadResultado.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {uploadResultado.success ? (
                      <CheckCircle
                        size={24}
                        className="text-green-600"
                        weight="fill"
                      />
                    ) : (
                      <WarningCircle
                        size={24}
                        className="text-red-600"
                        weight="fill"
                      />
                    )}
                    <span
                      className={`font-semibold ${
                        uploadResultado.success
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      {uploadResultado.success ? 'Sucesso!' : 'Erro!'}
                    </span>
                  </div>
                  <p
                    className={`text-sm ${
                      uploadResultado.success
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {uploadResultado.message}
                  </p>
                  {uploadResultado.success && uploadResultado.stats && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2 rounded">
                        <span className="text-gray-500">Total Registros:</span>
                        <span className="font-bold text-[#000638] ml-1">
                          {uploadResultado.stats.totalRegistros}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <span className="text-gray-500">Valor Total:</span>
                        <span className="font-bold text-[#000638] ml-1">
                          {uploadResultado.stats.valorTotalPago?.toLocaleString(
                            'pt-BR',
                            { style: 'currency', currency: 'BRL' },
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={fecharModalImportar}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadArquivo}
                disabled={
                  uploadLoading || !bancoSelecionado || !arquivoSelecionado
                }
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadLoading ? (
                  <>
                    <Spinner size={16} className="animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <UploadSimple size={16} />
                    Processar Arquivo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <option value="Em Aberto">EM ABERTO</option>
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
                placeholder="Ex: 422, 1098, 1020..."
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
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Forma Pagamento
              </label>
              <input
                type="text"
                value="1 - FATURA"
                disabled
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full bg-gray-100 text-[#000638] text-xs cursor-not-allowed"
              />
            </div>
            <div className="flex items-center">
              <button
                type="submit"
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase"
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

      {/* Cards de Resumo da Batida */}
      {dadosImportados.length > 0 && dados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 max-w-5xl mx-auto">
          {/* Card Batidos (Encontrados nas duas tabelas) */}
          <button
            onClick={() => setModalDetalheAberto('batidos')}
            className="text-left w-full"
          >
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white border-l-4 border-l-green-500 cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckSquare
                    size={16}
                    className="text-green-600"
                    weight="fill"
                  />
                  <CardTitle className="text-xs font-bold text-green-700">
                    Faturas Batidas
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-green-600 mb-0.5">
                  {totaisBatida.batidosQtd} registros
                </div>
                <div className="text-sm font-bold text-green-700">
                  {totaisBatida.batidosValor.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </div>
                <CardDescription className="text-xs text-gray-500 mt-1">
                  Presentes em ambas tabelas
                </CardDescription>
              </CardContent>
            </Card>
          </button>

          {/* Card Não Batidos Sistema (Tem no sistema mas não tem no banco) */}
          <button
            onClick={() => setModalDetalheAberto('soSistema')}
            className="text-left w-full"
          >
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white border-l-4 border-l-red-500 cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <XSquare size={16} className="text-red-600" weight="fill" />
                  <CardTitle className="text-xs font-bold text-red-700">
                    Só no Sistema
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-red-600 mb-0.5">
                  {totaisBatida.naoBatidosSistemaQtd} registros
                </div>
                <div className="text-sm font-bold text-red-700">
                  {totaisBatida.naoBatidosSistemaValor.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </div>
                <CardDescription className="text-xs text-gray-500 mt-1">
                  Não encontrados no arquivo
                </CardDescription>
              </CardContent>
            </Card>
          </button>

          {/* Card Não Batidos Importados (Tem no banco mas não tem no sistema) */}
          <button
            onClick={() => setModalDetalheAberto('soArquivo')}
            className="text-left w-full"
          >
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white border-l-4 border-l-orange-500 cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <XSquare
                    size={16}
                    className="text-orange-600"
                    weight="fill"
                  />
                  <CardTitle className="text-xs font-bold text-orange-700">
                    Só no Arquivo
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-orange-600 mb-0.5">
                  {totaisBatida.naoBatidosImportadosQtd} registros
                </div>
                <div className="text-sm font-bold text-orange-700">
                  {totaisBatida.naoBatidosImportadosValor.toLocaleString(
                    'pt-BR',
                    {
                      style: 'currency',
                      currency: 'BRL',
                    },
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500 mt-1">
                  Não encontrados no sistema
                </CardDescription>
              </CardContent>
            </Card>
          </button>

          {/* Card Total Não Batidos */}
          <button
            onClick={() => setModalDetalheAberto('divergentes')}
            className="text-left w-full"
          >
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white border-l-4 border-l-purple-500 cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <WarningCircle
                    size={16}
                    className="text-purple-600"
                    weight="fill"
                  />
                  <CardTitle className="text-xs font-bold text-purple-700">
                    Total Divergentes
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-lg font-extrabold text-purple-600 mb-0.5">
                  {totaisBatida.naoBatidosSistemaQtd +
                    totaisBatida.naoBatidosImportadosQtd}{' '}
                  registros
                </div>
                <div className="text-sm font-bold text-purple-700">
                  {(
                    totaisBatida.naoBatidosSistemaValor +
                    totaisBatida.naoBatidosImportadosValor
                  ).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </div>
                <CardDescription className="text-xs text-gray-500 mt-1">
                  Soma das divergências
                </CardDescription>
              </CardContent>
            </Card>
          </button>

          {/* Card PGTO Cedente - Somente para CONFIANCA */}
          {bancoImportado === 'CONFIANCA' && listaPgtoCedente.length > 0 && (
            <button
              onClick={() => setModalDetalheAberto('pgtoCedente')}
              className="text-left w-full"
            >
              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white border-l-4 border-l-cyan-500 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CurrencyCircleDollar
                      size={16}
                      className="text-cyan-600"
                      weight="fill"
                    />
                    <CardTitle className="text-xs font-bold text-cyan-700">
                      PGTO Cedente
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  <div className="text-lg font-extrabold text-cyan-600 mb-0.5">
                    {totaisPgtoCedente.qtd} registros
                  </div>
                  <div className="text-sm font-bold text-cyan-700">
                    {totaisPgtoCedente.valor.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </div>
                  <CardDescription className="text-xs text-gray-500 mt-1">
                    <span className="text-green-600 font-bold">
                      {totaisPgtoCedente.batidosQtd} batidos
                    </span>
                    {' / '}
                    <span className="text-gray-600 font-bold">
                      {totaisPgtoCedente.naoBatidosQtd} não batidos
                    </span>
                  </CardDescription>
                </CardContent>
              </Card>
            </button>
          )}
        </div>
      )}

      {/* Modal de Detalhes dos Cards */}
      {modalDetalheAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header do Modal */}
            <div
              className={`flex justify-between items-center p-4 border-b text-white rounded-t-lg ${
                modalDetalheAberto === 'batidos'
                  ? 'bg-green-600'
                  : modalDetalheAberto === 'soSistema'
                  ? 'bg-red-600'
                  : modalDetalheAberto === 'soArquivo'
                  ? 'bg-orange-600'
                  : modalDetalheAberto === 'pgtoCedente'
                  ? 'bg-cyan-600'
                  : 'bg-purple-600'
              }`}
            >
              <div className="flex items-center gap-2">
                {modalDetalheAberto === 'batidos' && (
                  <CheckSquare size={24} weight="bold" />
                )}
                {modalDetalheAberto === 'soSistema' && (
                  <XSquare size={24} weight="bold" />
                )}
                {modalDetalheAberto === 'soArquivo' && (
                  <XSquare size={24} weight="bold" />
                )}
                {modalDetalheAberto === 'divergentes' && (
                  <WarningCircle size={24} weight="bold" />
                )}
                {modalDetalheAberto === 'pgtoCedente' && (
                  <CurrencyCircleDollar size={24} weight="bold" />
                )}
                <h2 className="text-lg font-bold">
                  {modalDetalheAberto === 'batidos' && 'Faturas Batidas'}
                  {modalDetalheAberto === 'soSistema' && 'Só no Sistema'}
                  {modalDetalheAberto === 'soArquivo' && 'Só no Arquivo'}
                  {modalDetalheAberto === 'divergentes' && 'Total Divergentes'}
                  {modalDetalheAberto === 'pgtoCedente' &&
                    'PGTO Cedente / Título Debitado'}
                </h2>
              </div>
              <button
                onClick={() => setModalDetalheAberto(null)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* Tabela Sistema (Batidos ou Só no Sistema ou Divergentes) */}
              {(modalDetalheAberto === 'batidos' ||
                modalDetalheAberto === 'soSistema' ||
                modalDetalheAberto === 'divergentes') && (
                <div className="mb-4">
                  {modalDetalheAberto === 'divergentes' && (
                    <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                      <XSquare
                        size={16}
                        weight="fill"
                        className="text-red-600"
                      />
                      Só no Sistema ({listaNaoBatidosSistema.length} registros)
                    </h3>
                  )}
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto bg-gray-50 rounded-lg border">
                    <table className="min-w-full text-[10px]">
                      <thead
                        className={`text-white sticky top-0 ${
                          modalDetalheAberto === 'batidos'
                            ? 'bg-green-600'
                            : modalDetalheAberto === 'soSistema'
                            ? 'bg-red-600'
                            : 'bg-red-600'
                        }`}
                      >
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            Cód
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            Fatura
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            Cliente
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            CPF/CNPJ
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                            Valor
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                            Vencimento
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            Empresa
                          </th>
                          {modalDetalheAberto === 'batidos' && (
                            <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                              Liquidação
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(modalDetalheAberto === 'batidos'
                          ? listaBatidosSistema
                          : listaNaoBatidosSistema
                        ).map((item, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-100">
                            <td className="px-2 py-1 whitespace-nowrap font-medium">
                              {item.cd_cliente || '--'}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.nr_fat || '--'}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.nm_cliente || '--'}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {formatCpfCnpj(item.nr_cpfcnpj)}
                            </td>
                            <td className="px-2 py-1 text-right whitespace-nowrap font-bold">
                              {(
                                parseFloat(item.vl_fatura || 0) + 0.98
                              ).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="px-2 py-1 text-center whitespace-nowrap">
                              {formatDateBR(item.dt_vencimento)}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.cd_empresa || '--'}
                            </td>
                            {modalDetalheAberto === 'batidos' && (
                              <td className="px-2 py-1 text-center whitespace-nowrap text-emerald-700 font-semibold">
                                {formatDateBR(
                                  buscarItemImportadoCorrespondente(item)
                                    ?.dt_pagamento,
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabela Arquivo (Só no Arquivo ou Divergentes) */}
              {(modalDetalheAberto === 'soArquivo' ||
                modalDetalheAberto === 'divergentes') && (
                <div>
                  {modalDetalheAberto === 'divergentes' && (
                    <h3 className="text-sm font-bold text-orange-700 mb-2 flex items-center gap-2 mt-4">
                      <XSquare
                        size={16}
                        weight="fill"
                        className="text-orange-600"
                      />
                      Só no Arquivo ({listaNaoBatidosImportados.length}{' '}
                      registros)
                    </h3>
                  )}
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto bg-gray-50 rounded-lg border">
                    <table className="min-w-full text-[10px]">
                      <thead
                        className={`text-white sticky top-0 ${
                          modalDetalheAberto === 'soArquivo'
                            ? 'bg-orange-600'
                            : 'bg-orange-600'
                        }`}
                      >
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            Nosso Número
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            Cliente
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            CPF/CNPJ
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                            Valor
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                            Vl.Pago
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                            Vencimento
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            BAIXA
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                            Liquidação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {listaNaoBatidosImportados.map((item, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-100">
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.nosso_numero || '--'}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.nm_cliente || '--'}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {formatCpfCnpj(item.nr_cpfcnpj)}
                            </td>
                            <td className="px-2 py-1 text-right whitespace-nowrap font-bold">
                              {parseFloat(item.vl_original || 0).toLocaleString(
                                'pt-BR',
                                { style: 'currency', currency: 'BRL' },
                              )}
                            </td>
                            <td className="px-2 py-1 text-right whitespace-nowrap font-bold text-emerald-700">
                              {parseFloat(item.vl_pago || 0).toLocaleString(
                                'pt-BR',
                                { style: 'currency', currency: 'BRL' },
                              )}
                            </td>
                            <td className="px-2 py-1 text-center whitespace-nowrap">
                              {formatDateBR(item.dt_vencimento)}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.descricao_baixa || '--'}
                            </td>
                            <td className="px-2 py-1 text-center whitespace-nowrap">
                              {formatDateBR(item.dt_pagamento)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabela PGTO Cedente (somente CONFIANCA) */}
              {modalDetalheAberto === 'pgtoCedente' && (
                <div>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto bg-gray-50 rounded-lg border">
                    <table className="min-w-full text-[10px]">
                      <thead className="bg-cyan-600 text-white sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                            Status
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            Nosso Número
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            Cliente
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            CPF/CNPJ
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                            Valor
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                            Vl.Pago
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                            Vencimento
                          </th>
                          <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                            BAIXA
                          </th>
                          <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                            Liquidação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {listaPgtoCedente.map((item, idx) => {
                          const chave = criarChaveComparacao(
                            item.nr_cpfcnpj,
                            item.vl_original,
                            item.dt_vencimento,
                          );
                          const batido = chavesSistema.has(chave);
                          return (
                            <tr
                              key={idx}
                              className={`border-b ${
                                batido
                                  ? 'bg-green-100 hover:bg-green-200'
                                  : 'bg-white hover:bg-gray-100'
                              }`}
                            >
                              <td className="px-2 py-1 text-center whitespace-nowrap">
                                {batido ? (
                                  <span className="inline-flex items-center gap-1 text-green-700 font-bold">
                                    <CheckCircle size={14} weight="fill" />
                                    Batido
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
                                    <XSquare size={14} weight="fill" />
                                    Não Batido
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1 whitespace-nowrap">
                                {item.nosso_numero || '--'}
                              </td>
                              <td className="px-2 py-1 whitespace-nowrap">
                                {item.nm_cliente || '--'}
                              </td>
                              <td className="px-2 py-1 whitespace-nowrap">
                                {formatCpfCnpj(item.nr_cpfcnpj)}
                              </td>
                              <td className="px-2 py-1 text-right whitespace-nowrap font-bold">
                                {parseFloat(
                                  item.vl_original || 0,
                                ).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </td>
                              <td className="px-2 py-1 text-right whitespace-nowrap font-bold text-emerald-700">
                                {parseFloat(item.vl_pago || 0).toLocaleString(
                                  'pt-BR',
                                  { style: 'currency', currency: 'BRL' },
                                )}
                              </td>
                              <td className="px-2 py-1 text-center whitespace-nowrap">
                                {formatDateBR(item.dt_vencimento)}
                              </td>
                              <td className="px-2 py-1 whitespace-nowrap">
                                {item.descricao_baixa || '--'}
                              </td>
                              <td className="px-2 py-1 text-center whitespace-nowrap">
                                {formatDateBR(item.dt_pagamento)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resumo */}
              <div
                className={`mt-4 p-3 rounded-lg ${
                  modalDetalheAberto === 'batidos'
                    ? 'bg-green-50 border border-green-200'
                    : modalDetalheAberto === 'soSistema'
                    ? 'bg-red-50 border border-red-200'
                    : modalDetalheAberto === 'soArquivo'
                    ? 'bg-orange-50 border border-orange-200'
                    : modalDetalheAberto === 'pgtoCedente'
                    ? 'bg-cyan-50 border border-cyan-200'
                    : 'bg-purple-50 border border-purple-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">Total:</span>
                  <span
                    className={`font-extrabold text-lg ${
                      modalDetalheAberto === 'batidos'
                        ? 'text-green-600'
                        : modalDetalheAberto === 'soSistema'
                        ? 'text-red-600'
                        : modalDetalheAberto === 'soArquivo'
                        ? 'text-orange-600'
                        : modalDetalheAberto === 'pgtoCedente'
                        ? 'text-cyan-600'
                        : 'text-purple-600'
                    }`}
                  >
                    {modalDetalheAberto === 'batidos' &&
                      `${
                        listaBatidosSistema.length
                      } registros - ${totaisBatida.batidosValor.toLocaleString(
                        'pt-BR',
                        { style: 'currency', currency: 'BRL' },
                      )}`}
                    {modalDetalheAberto === 'soSistema' &&
                      `${
                        listaNaoBatidosSistema.length
                      } registros - ${totaisBatida.naoBatidosSistemaValor.toLocaleString(
                        'pt-BR',
                        { style: 'currency', currency: 'BRL' },
                      )}`}
                    {modalDetalheAberto === 'soArquivo' &&
                      `${
                        listaNaoBatidosImportados.length
                      } registros - ${totaisBatida.naoBatidosImportadosValor.toLocaleString(
                        'pt-BR',
                        { style: 'currency', currency: 'BRL' },
                      )}`}
                    {modalDetalheAberto === 'divergentes' &&
                      `${
                        listaNaoBatidosSistema.length +
                        listaNaoBatidosImportados.length
                      } registros - ${(
                        totaisBatida.naoBatidosSistemaValor +
                        totaisBatida.naoBatidosImportadosValor
                      ).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}`}
                    {modalDetalheAberto === 'pgtoCedente' &&
                      `${
                        totaisPgtoCedente.qtd
                      } registros - ${totaisPgtoCedente.valor.toLocaleString(
                        'pt-BR',
                        { style: 'currency', currency: 'BRL' },
                      )} (${totaisPgtoCedente.batidosQtd} batidos / ${
                        totaisPgtoCedente.naoBatidosQtd
                      } não batidos)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t bg-gray-50 flex justify-between">
              <button
                onClick={() => exportarParaExcel()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold text-sm"
              >
                <DownloadSimple size={18} weight="bold" />
                Baixar Excel
              </button>
              <button
                onClick={() => setModalDetalheAberto(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-bold text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Container das Tabelas - Layout lado a lado quando há dados importados */}
      <div
        className={`grid gap-4 ${
          dadosImportados.length > 0
            ? 'grid-cols-1 lg:grid-cols-2'
            : 'grid-cols-1'
        }`}
      >
        {/* Tabela Contas a Receber (Sistema) */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#000638]"></div>
            <h3 className="text-sm font-bold text-[#000638]">
              Contas a Receber (Sistema)
            </h3>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-20 bg-white rounded-lg shadow-sm">
              <Spinner className="animate-spin text-emerald-600" size={48} />
            </div>
          ) : dadosCarregados && dados.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="min-w-full text-[10px]">
                  <thead className="bg-[#000638] text-white sticky top-0">
                    <tr>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-[#001050] whitespace-nowrap"
                        onClick={() => handleSort('cd_cliente')}
                      >
                        <div className="flex items-center gap-1">
                          Cód {getSortIcon('cd_cliente')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-[#001050] whitespace-nowrap"
                        onClick={() => handleSort('nm_cliente')}
                      >
                        <div className="flex items-center gap-1">
                          Cliente {getSortIcon('nm_cliente')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-[#001050] whitespace-nowrap"
                        onClick={() => handleSort('nr_cpfcnpj')}
                      >
                        <div className="flex items-center gap-1">
                          CPF/CNPJ {getSortIcon('nr_cpfcnpj')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-[#001050] whitespace-nowrap"
                        onClick={() => handleSort('nr_fat')}
                      >
                        <div className="flex items-center gap-1">
                          Fatura {getSortIcon('nr_fat')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-[#001050] whitespace-nowrap"
                        onClick={() => handleSort('dt_vencimento')}
                      >
                        <div className="flex items-center gap-1">
                          Venc. {getSortIcon('dt_vencimento')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-right cursor-pointer hover:bg-[#001050] whitespace-nowrap"
                        onClick={() => handleSort('vl_fatura')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Valor {getSortIcon('vl_fatura')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-right cursor-pointer hover:bg-[#001050] whitespace-nowrap"
                        onClick={() => handleSort('vl_pago')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Vl.Pago {getSortIcon('vl_pago')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-[#001050] whitespace-nowrap"
                        onClick={() => handleSort('dt_liquidacao')}
                      >
                        <div className="flex items-center gap-1">
                          Dt.Liq {getSortIcon('dt_liquidacao')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosOrdenados.map((item, index) => {
                      const encontrado =
                        dadosImportados.length > 0 &&
                        itemSistemaEncontrado(item);
                      return (
                        <tr
                          key={`${item.cd_cliente}-${item.nr_fat}-${index}`}
                          className={`border-b ${
                            encontrado
                              ? 'bg-emerald-300 hover:bg-emerald-400'
                              : index % 2 === 0
                              ? 'bg-white hover:bg-gray-50'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <td
                            className={`px-1 py-0.5 font-medium whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-bold'
                                : 'text-gray-900'
                            }`}
                          >
                            {item.cd_cliente}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {item.nm_cliente || '--'}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {formatCpfCnpj(item.nr_cpfcnpj)}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {item.nr_fat || '--'}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {formatDateBR(item.dt_vencimento)}
                          </td>
                          <td
                            className={`px-1 py-0.5 text-right font-medium whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-bold'
                                : 'text-gray-900'
                            }`}
                          >
                            {(
                              parseFloat(item.vl_fatura || 0) + 0.98
                            ).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td
                            className={`px-1 py-0.5 text-right font-medium whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-bold'
                                : 'text-emerald-700'
                            }`}
                          >
                            {item.vl_pago
                              ? parseFloat(item.vl_pago).toLocaleString(
                                  'pt-BR',
                                  {
                                    style: 'currency',
                                    currency: 'BRL',
                                  },
                                )
                              : '--'}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {formatDateBR(item.dt_liquidacao)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : dadosCarregados ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
              Nenhum registro encontrado.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
              Selecione os filtros e clique em "Buscar".
            </div>
          )}
        </div>

        {/* Tabela Dados Importados (Banco) */}
        {dadosImportados.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
              <h3 className="text-sm font-bold text-emerald-700">
                Dados Importados ({bancoSelecionado || 'Banco'}) -{' '}
                {dadosImportados.length} registros
              </h3>
            </div>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-emerald-200">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="min-w-full text-[10px]">
                  <thead className="bg-emerald-600 text-white sticky top-0">
                    <tr>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-emerald-700 whitespace-nowrap"
                        onClick={() => handleSortImportados('nr_cpfcnpj')}
                      >
                        <div className="flex items-center gap-1">
                          CPF/CNPJ {getSortIconImportados('nr_cpfcnpj')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-emerald-700 whitespace-nowrap"
                        onClick={() => handleSortImportados('nm_cliente')}
                      >
                        <div className="flex items-center gap-1">
                          Cliente {getSortIconImportados('nm_cliente')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-emerald-700 whitespace-nowrap"
                        onClick={() => handleSortImportados('nr_fatura')}
                      >
                        <div className="flex items-center gap-1">
                          Nº Doc {getSortIconImportados('nr_fatura')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-emerald-700 whitespace-nowrap"
                        onClick={() => handleSortImportados('dt_vencimento')}
                      >
                        <div className="flex items-center gap-1">
                          Venc. {getSortIconImportados('dt_vencimento')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-right cursor-pointer hover:bg-emerald-700 whitespace-nowrap"
                        onClick={() => handleSortImportados('vl_original')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Vl.Orig {getSortIconImportados('vl_original')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-right cursor-pointer hover:bg-emerald-700 whitespace-nowrap"
                        onClick={() => handleSortImportados('vl_pago')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Vl.Pago {getSortIconImportados('vl_pago')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-emerald-700 whitespace-nowrap"
                        onClick={() => handleSortImportados('descricao_baixa')}
                      >
                        <div className="flex items-center gap-1">
                          BAIXA {getSortIconImportados('descricao_baixa')}
                        </div>
                      </th>
                      <th
                        className="px-1 py-1 text-left cursor-pointer hover:bg-emerald-700 whitespace-nowrap"
                        onClick={() => handleSortImportados('dt_pagamento')}
                      >
                        <div className="flex items-center gap-1">
                          Dt.Pag {getSortIconImportados('dt_pagamento')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosImportadosOrdenados.map((item, index) => {
                      const encontrado =
                        dados.length > 0 && itemImportadoEncontrado(item);
                      return (
                        <tr
                          key={`imp-${item.titu_id || index}-${index}`}
                          className={`border-b ${
                            encontrado
                              ? 'bg-emerald-300 hover:bg-emerald-400'
                              : index % 2 === 0
                              ? 'bg-white hover:bg-emerald-50'
                              : 'bg-gray-50 hover:bg-emerald-50'
                          }`}
                        >
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {formatCpfCnpj(item.nr_cpfcnpj)}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {item.nm_cliente || '--'}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {item.nr_fatura || '--'}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {formatDateBR(item.dt_vencimento)}
                          </td>
                          <td
                            className={`px-1 py-0.5 text-right font-medium whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-bold'
                                : 'text-gray-900'
                            }`}
                          >
                            {(item.vl_original || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td
                            className={`px-1 py-0.5 text-right font-medium whitespace-nowrap ${
                              encontrado
                                ? 'text-emerald-900 font-bold'
                                : 'text-emerald-700'
                            }`}
                          >
                            {(item.vl_pago || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado ? 'text-green-800' : 'text-gray-700'
                            }`}
                          >
                            {item.descricao_baixa || '--'}
                          </td>
                          <td
                            className={`px-1 py-0.5 whitespace-nowrap ${
                              encontrado ? 'text-green-800' : 'text-gray-700'
                            }`}
                          >
                            {formatDateBR(item.dt_pagamento)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Totais dos dados importados */}
              <div className="px-4 py-3 border-t bg-emerald-50 flex justify-between text-xs">
                <span className="font-medium text-emerald-700">
                  Total Original:{' '}
                  {dadosImportados
                    .reduce((sum, i) => sum + (i.vl_original || 0), 0)
                    .toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                </span>
                <span className="font-bold text-emerald-700">
                  Total Pago:{' '}
                  {dadosImportados
                    .reduce((sum, i) => sum + (i.vl_pago || 0), 0)
                    .toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatidaCarteira;
