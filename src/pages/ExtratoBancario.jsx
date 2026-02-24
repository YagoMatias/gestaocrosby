import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Bank,
  UploadSimple,
  Spinner,
  File,
  CheckCircle,
  WarningCircle,
  DownloadSimple,
  CaretUp,
  CaretDown,
  CaretUpDown,
  X,
  Funnel,
  CurrencyCircleDollar,
  ArrowUp,
  ArrowDown,
  Calendar,
} from '@phosphor-icons/react';

const ExtratoBancario = () => {
  // Estados para seleção de banco
  const [bancoSelecionado, setBancoSelecionado] = useState('');

  // Estados para modal de importação
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [arquivosSelecionados, setArquivosSelecionados] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResultado, setUploadResultado] = useState(null);

  // Estados para dados importados
  const [dadosImportados, setDadosImportados] = useState([]);
  const [infoExtrato, setInfoExtrato] = useState(null);
  const [bancoImportado, setBancoImportado] = useState('');

  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(50);

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

  // Estados para filtros do extrato importado
  const [filtroDescricao, setFiltroDescricao] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');

  // Estados para filtros do contas a receber (TOTVS)
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [status, setStatus] = useState('Todos');
  const [situacao, setSituacao] = useState('NORMAIS');
  const [filtroCobranca, setFiltroCobranca] = useState([]);
  const [dropdownCobrancaAberto, setDropdownCobrancaAberto] = useState(false);
  const [filtroFatura, setFiltroFatura] = useState('');
  const [filtroPortador, setFiltroPortador] = useState('');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [clientesSelecionados, setClientesSelecionados] = useState([]);
  const [dadosClientes, setDadosClientes] = useState([]);
  const [formasPagamentoSelecionadas, setFormasPagamentoSelecionadas] =
    useState([{ codigo: 1, nome: 'Fatura' }]);
  const [dropdownFormaPgtoAberto, setDropdownFormaPgtoAberto] = useState(false);

  // Lista de tipos de documento (formas de pagamento)
  const tiposDocumento = [
    { codigo: 1, nome: 'Fatura' },
    { codigo: 2, nome: 'Duplicata' },
    { codigo: 3, nome: 'Nota Promissória' },
    { codigo: 4, nome: 'Cheque' },
    { codigo: 5, nome: 'Recibo' },
    { codigo: 6, nome: 'Carnê' },
    { codigo: 7, nome: 'Boleto' },
    { codigo: 8, nome: 'Contrato' },
    { codigo: 9, nome: 'Transferência' },
    { codigo: 10, nome: 'Dinheiro' },
    { codigo: 11, nome: 'Cartão Crédito' },
    { codigo: 12, nome: 'Cartão Débito' },
    { codigo: 26, nome: 'PIX' },
    { codigo: 14, nome: 'Depósito' },
    { codigo: 15, nome: 'Outros' },
  ];

  // Lista de tipos de cobrança
  const tiposCobranca = [
    { codigo: 0, nome: 'Não está em cobrança' },
    { codigo: 1, nome: 'Simples' },
    { codigo: 2, nome: 'Descontada' },
    { codigo: 3, nome: 'Caucionada' },
    { codigo: 4, nome: 'Vinculada' },
    { codigo: 5, nome: 'Sem registro' },
    { codigo: 6, nome: 'Vendor' },
    { codigo: 8, nome: 'Protestado' },
    { codigo: 9, nome: 'Custódia' },
    { codigo: 11, nome: 'Retirado para renegociação' },
    { codigo: 12, nome: 'Fora de negociação' },
    { codigo: 13, nome: 'Endossado' },
    { codigo: 14, nome: 'Operadora de crédito' },
    { codigo: 15, nome: 'Em cartório' },
    { codigo: 16, nome: 'Cobrança na loja/empresa' },
    { codigo: 17, nome: 'Aguardando recebimento' },
    { codigo: 18, nome: 'Direto para boleto' },
    { codigo: 19, nome: 'Abatimento total' },
    { codigo: 20, nome: 'Custódia cheque recusado' },
    { codigo: 21, nome: 'Custódia cheque baixa/retirada' },
    { codigo: 22, nome: 'Custódia cheque devolução' },
    { codigo: 23, nome: 'Desconto cheque recusado' },
    { codigo: 24, nome: 'Desconto cheque baixa/retirada' },
    { codigo: 25, nome: 'Desconto cheque devolução' },
    { codigo: 26, nome: 'Cobrança terceirizada' },
    { codigo: 27, nome: 'SCPC' },
    { codigo: 28, nome: 'Exportação' },
    { codigo: 29, nome: 'Cessão direito/crédito' },
    { codigo: 30, nome: 'Compra para terceiros' },
    { codigo: 31, nome: 'Convênio' },
    { codigo: 32, nome: 'Cobrança Judicial' },
    { codigo: 33, nome: 'Negativado' },
    { codigo: 34, nome: 'Sustado em cartório' },
    { codigo: 35, nome: 'Protesto cancelado' },
    { codigo: 36, nome: 'Disponível para cartório' },
    { codigo: 37, nome: 'Carteira digital' },
    { codigo: 38, nome: 'Bolepix' },
    { codigo: 51, nome: 'Reserva cobrança simples' },
    { codigo: 52, nome: 'Reserva cobrança desconto faturado' },
    { codigo: 53, nome: 'Reserva cobrança desconto cheque' },
    { codigo: 54, nome: 'Reserva cobrança caucionada' },
    { codigo: 56, nome: 'Reserva cobrança vinculada' },
    { codigo: 59, nome: 'Reserva cobrança vendor' },
    { codigo: 60, nome: 'Reserva cobrança custódia' },
    { codigo: 70, nome: 'Reserva para endosso' },
    { codigo: 80, nome: 'Reserva cheque' },
    { codigo: 85, nome: 'Reserva desconto custódia' },
    { codigo: 90, nome: 'Reserva desconto compror' },
    { codigo: 98, nome: 'Perdas' },
    { codigo: 99, nome: 'PDD - Fundo perdido' },
  ];

  // Estados para modal de detalhes
  const [modalDetalhes, setModalDetalhes] = useState(null); // 'creditos' | 'debitos' | null

  // Estado para subcard expandido dentro do modal
  const [subcardExpandido, setSubcardExpandido] = useState(null); // 'pix' | 'rede' | 'getnet' | 'antec' | 'dep' | 'liq' | 'outros' | null

  const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';

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

  // Definir data inicial (mês atual)
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

  // Função para buscar informações de pessoas (nomes) via API TOTVS
  const buscarInfoPessoas = async (codigosPessoa) => {
    if (!codigosPessoa || codigosPessoa.length === 0) return {};

    try {
      const codigosUnicos = [
        ...new Set(
          codigosPessoa
            .filter(Boolean)
            .map(Number)
            .filter((c) => c > 0),
        ),
      ];

      const response = await fetch(`${TotvsURL}persons/batch-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personCodes: codigosUnicos }),
      });

      if (!response.ok) return {};

      const data = await response.json();
      const pessoasMap = data?.data || data || {};

      const infoPessoasObj = {};
      for (const [code, pessoa] of Object.entries(pessoasMap)) {
        infoPessoasObj[String(code).trim()] = {
          cd_pessoa: code,
          nm_pessoa: pessoa.name || '',
          nm_fantasia: pessoa.fantasyName || '',
          nr_telefone: pessoa.phone || '',
        };
      }
      return infoPessoasObj;
    } catch (err) {
      console.error('Erro ao buscar informações de pessoas:', err);
      return {};
    }
  };

  // Buscar dados do contas a receber via TOTVS
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
      params.append('modo', 'vencimento');

      if (status && status !== 'Todos') {
        params.append('status', status);
      }

      if (situacao && situacao !== 'TODAS') {
        if (situacao === 'NORMAIS') params.append('situacao', '1');
        else if (situacao === 'CANCELADAS') params.append('situacao', '3');
      }

      if (filtroCobranca.length > 0) {
        params.append(
          'tp_cobranca',
          filtroCobranca.map((c) => c.codigo).join(','),
        );
      }

      if (clientesSelecionados.length > 0) {
        params.append(
          'cd_cliente',
          clientesSelecionados.map((c) => c.cd_cliente).join(','),
        );
      }

      // Formas de pagamento selecionadas
      if (formasPagamentoSelecionadas.length > 0) {
        params.append(
          'tp_documento',
          formasPagamentoSelecionadas.map((f) => f.codigo).join(','),
        );
      }

      if (filtroFatura && filtroFatura.trim() !== '') {
        params.append('nr_fatura', filtroFatura.trim());
      }

      if (filtroPortador && filtroPortador.trim() !== '') {
        const portadores = filtroPortador
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p !== '');
        params.append('cd_portador', portadores.join(','));
      }

      if (empresasSelecionadas.length > 0) {
        params.append(
          'branches',
          empresasSelecionadas.map((e) => e.cd_empresa).join(','),
        );
      }

      const url = `${TotvsURL}accounts-receivable/filter?${params.toString()}`;
      console.log('🔍 Buscando contas a receber via TOTVS:', url);

      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const result = await res.json();
      let todosOsDados = result.data?.items || [];

      todosOsDados = todosOsDados.map((item) => ({
        ...item,
        nr_portador: item.cd_portador || item.nm_portador || '',
      }));

      // Buscar nomes dos clientes
      const codigosClientes = [
        ...new Set(todosOsDados.map((item) => item.cd_cliente).filter(Boolean)),
      ];

      if (codigosClientes.length > 0) {
        const info = await buscarInfoPessoas(codigosClientes);
        if (info && Object.keys(info).length > 0) {
          todosOsDados = todosOsDados.map((item) => {
            const key = String(item.cd_cliente).trim();
            const pessoa = info[key];
            if (pessoa) {
              return {
                ...item,
                nm_cliente: pessoa.nm_pessoa || item.nm_cliente,
                nm_fantasia: pessoa.nm_fantasia || '',
              };
            }
            return item;
          });
        }
      }

      setDados(todosOsDados);
      setDadosCarregados(true);

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

      console.log(`📊 ${todosOsDados.length} títulos carregados do TOTVS`);
    } catch (err) {
      console.error('❌ Erro ao buscar dados:', err);
      alert(`Erro ao buscar dados: ${err.message}`);
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

  // Função para parsear valor monetário brasileiro (ex: "R$ 13.386,37" ou "-R$ 1,40")
  const parseMonetaryValue = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;

    const str = String(value).trim();
    // Verificar se é negativo
    const isNegative = str.includes('-') || str.startsWith('(');
    // Remover R$, espaços, parênteses
    let cleanStr = str.replace(/R\$|\s|\(|\)/g, '');
    // Remover pontos de milhar e substituir vírgula por ponto
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.').replace('-', '');

    const num = parseFloat(cleanStr);
    if (isNaN(num)) return 0;
    return isNegative ? -Math.abs(num) : num;
  };

  // Função para formatar valor monetário
  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '-';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Função para normalizar datas para formato DD/MM/YYYY (para comparação)
  const normalizarDataParaComparacao = (dataStr) => {
    if (!dataStr) return '';
    const str = String(dataStr).trim();
    // Formato ISO: 2026-02-15 ou 2026-02-15T00:00:00
    if (str.includes('-') && str.length >= 10) {
      const [ano, mes, diaRest] = str.split('-');
      const dia = diaRest?.substring(0, 2);
      if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
    }
    // Já no formato DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
    // Formato DD/MM (sem ano)
    if (/^\d{2}\/\d{2}$/.test(str)) {
      const anoAtual = new Date().getFullYear();
      return `${str}/${anoAtual}`;
    }
    return str;
  };

  // Parser específico para Sicredi
  const parseSicrediExtrato = (workbook) => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Extrair informações do cabeçalho
    let associado = '';
    let cooperativa = '';
    let conta = '';
    let periodo = '';

    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row[0] === 'Associado:') associado = row[1] || '';
      if (row[0] === 'Cooperativa:') cooperativa = row[1] || '';
      if (row[0] === 'Conta:') conta = row[1] || '';
      if (row[0]?.includes('Dados referentes ao período')) {
        periodo = row[0].replace('Dados referentes ao período de ', '');
      }
    }

    // Encontrar linha do cabeçalho da tabela
    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      if (rawData[i][0] === 'Data' && rawData[i][1] === 'Descrição') {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Formato do arquivo não reconhecido para Sicredi');
    }

    // Processar dados
    const dados = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      // Pular linha de saldo anterior se não tiver data
      const data = row[0];
      const descricao = row[1] || '';
      const documento = row[2] || '';
      const valorRaw = row[3];
      const saldoRaw = row[4];

      // Parsear valores monetários
      const valor = parseMonetaryValue(valorRaw);
      const saldo = parseMonetaryValue(saldoRaw);

      // Verificar se é uma linha válida de transação
      if (descricao === 'Saldo Anterior' || (!data && !descricao)) {
        // Adicionar saldo anterior como primeira linha
        if (descricao === 'Saldo Anterior') {
          dados.push({
            id: `sicredi-${i}`,
            data: '-',
            descricao: 'Saldo Anterior',
            documento: '-',
            valor: null,
            saldo: saldo,
            tipo: 'saldo',
          });
        }
        continue;
      }

      // Só adicionar se tiver data válida ou descrição válida
      if (!data && !descricao) continue;

      dados.push({
        id: `sicredi-${i}`,
        data: data || '',
        descricao: descricao,
        documento: documento,
        valor: valor,
        saldo: saldo,
        tipo: valor > 0 ? 'credito' : valor < 0 ? 'debito' : 'neutro',
      });
    }

    // Debug: log para ver último item
    console.log('Último item do extrato:', dados[dados.length - 1]);

    return {
      info: {
        associado,
        cooperativa,
        conta,
        periodo,
        banco: 'SICREDI',
      },
      dados,
    };
  };

  // Função genérica para outros bancos (placeholder)
  const parseGenericoExtrato = (workbook, banco) => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const row = rawData[i];
      if (
        row &&
        row.some(
          (cell) =>
            typeof cell === 'string' &&
            (cell.toLowerCase().includes('data') ||
              cell.toLowerCase().includes('descrição')),
        )
      ) {
        headerRowIndex = i;
        break;
      }
    }

    const dados = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const valor = parseMonetaryValue(row[3]);
      const saldo = parseMonetaryValue(row[4]);
      dados.push({
        id: `${banco}-${i}`,
        data: row[0] || '',
        descricao: row[1] || '',
        documento: row[2] || '',
        valor: valor,
        saldo: saldo,
        tipo: valor > 0 ? 'credito' : valor < 0 ? 'debito' : 'neutro',
      });
    }

    return {
      info: {
        banco,
        associado: 'N/A',
        cooperativa: 'N/A',
        conta: 'N/A',
        periodo: 'N/A',
      },
      dados,
    };
  };

  // Função para importar arquivo
  const handleUploadArquivo = async () => {
    if (!bancoSelecionado) {
      setUploadResultado({ success: false, message: 'Selecione um banco' });
      return;
    }

    if (arquivosSelecionados.length === 0) {
      setUploadResultado({ success: false, message: 'Selecione um arquivo' });
      return;
    }

    setUploadLoading(true);
    setUploadResultado(null);

    try {
      const todosResultados = [];

      for (const arquivo of arquivosSelecionados) {
        const reader = new FileReader();

        const resultado = await new Promise((resolve, reject) => {
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: 'array' });

              let parsed;
              switch (bancoSelecionado) {
                case 'SICREDI':
                  parsed = parseSicrediExtrato(workbook);
                  break;
                default:
                  parsed = parseGenericoExtrato(workbook, bancoSelecionado);
              }

              resolve(parsed);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(arquivo);
        });

        todosResultados.push(resultado);
      }

      // Combinar resultados
      const dadosCombinados = todosResultados.flatMap((r) => r.dados);
      const infoFinal = todosResultados[0]?.info;

      setDadosImportados(dadosCombinados);
      setInfoExtrato(infoFinal);
      setBancoImportado(bancoSelecionado);
      setUploadResultado({
        success: true,
        message: `${dadosCombinados.length} registros importados com sucesso!`,
        stats: {
          totalRegistros: dadosCombinados.length,
          arquivosProcessados: arquivosSelecionados.map((a) => ({
            arquivo: a.name,
            registros: dadosCombinados.length,
          })),
        },
      });
      setPaginaAtual(1);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      setUploadResultado({
        success: false,
        message: `Erro ao processar arquivo: ${error.message}`,
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // Fechar modal
  const fecharModalImportar = () => {
    setModalImportarAberto(false);
    setArquivosSelecionados([]);
    setUploadResultado(null);
    setBancoSelecionado('');
  };

  // Limpar dados importados
  const handleLimpar = () => {
    setDadosImportados([]);
    setInfoExtrato(null);
    setBancoImportado('');
    setPaginaAtual(1);
    setFiltroDescricao('');
    setFiltroTipo('TODOS');
  };

  // Função para ordenação
  const handleSort = useCallback((campo) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Ícone de ordenação
  const getSortIcon = useCallback(
    (campo) => {
      if (ordenacao.campo !== campo) {
        return <CaretUpDown size={12} className="text-gray-400" />;
      }
      return ordenacao.direcao === 'asc' ? (
        <CaretUp size={12} className="text-white" />
      ) : (
        <CaretDown size={12} className="text-white" />
      );
    },
    [ordenacao],
  );

  // Dados filtrados
  const dadosFiltrados = useMemo(() => {
    return dadosImportados.filter((item) => {
      if (
        filtroDescricao &&
        !item.descricao.toLowerCase().includes(filtroDescricao.toLowerCase())
      ) {
        return false;
      }
      if (filtroTipo !== 'TODOS') {
        if (filtroTipo === 'CREDITO' && item.tipo !== 'credito') return false;
        if (filtroTipo === 'DEBITO' && item.tipo !== 'debito') return false;
      }
      return true;
    });
  }, [dadosImportados, filtroDescricao, filtroTipo]);

  // Dados ordenados
  const dadosOrdenados = useMemo(() => {
    if (!ordenacao.campo) return dadosFiltrados;

    return [...dadosFiltrados].sort((a, b) => {
      let valA = a[ordenacao.campo];
      let valB = b[ordenacao.campo];

      if (ordenacao.campo === 'valor' || ordenacao.campo === 'saldo') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      }

      if (valA < valB) return ordenacao.direcao === 'asc' ? -1 : 1;
      if (valA > valB) return ordenacao.direcao === 'asc' ? 1 : -1;
      return 0;
    });
  }, [dadosFiltrados, ordenacao]);

  // Paginação
  const totalPaginas = Math.ceil(dadosOrdenados.length / itensPorPagina);
  const dadosPaginados = dadosOrdenados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina,
  );

  // Calcular totais
  const totais = useMemo(() => {
    const creditos = dadosFiltrados
      .filter((d) => d.valor > 0)
      .reduce((acc, d) => acc + d.valor, 0);
    const debitos = dadosFiltrados
      .filter((d) => d.valor < 0)
      .reduce((acc, d) => acc + Math.abs(d.valor), 0);

    // Pegar o último saldo válido (diferente de 0/null/undefined)
    let saldoFinal = 0;
    if (dadosImportados.length > 0) {
      // Procurar do fim para o início o primeiro saldo válido
      for (let i = dadosImportados.length - 1; i >= 0; i--) {
        const saldo = dadosImportados[i]?.saldo;
        if (saldo !== null && saldo !== undefined && saldo !== 0) {
          saldoFinal = saldo;
          break;
        }
      }
    }

    const qtdCreditos = dadosFiltrados.filter((d) => d.valor > 0).length;
    const qtdDebitos = dadosFiltrados.filter((d) => d.valor < 0).length;

    return { creditos, debitos, saldoFinal, qtdCreditos, qtdDebitos };
  }, [dadosFiltrados, dadosImportados]);

  // Agrupar créditos por descrição
  const creditosPorDescricao = useMemo(() => {
    const grupos = {};
    dadosFiltrados
      .filter((d) => d.valor > 0)
      .forEach((d) => {
        const desc = d.descricao || 'Sem descrição';
        if (!grupos[desc]) {
          grupos[desc] = { descricao: desc, total: 0, quantidade: 0 };
        }
        grupos[desc].total += d.valor;
        grupos[desc].quantidade += 1;
      });
    return Object.values(grupos).sort((a, b) => b.total - a.total);
  }, [dadosFiltrados]);

  // Calcular total de PIX em créditos
  const totalPixCreditos = useMemo(() => {
    const pixItems = dadosFiltrados.filter(
      (d) => d.valor > 0 && d.descricao?.toUpperCase().includes('PIX'),
    );
    return {
      total: pixItems.reduce((acc, d) => acc + d.valor, 0),
      quantidade: pixItems.length,
      itens: pixItems,
    };
  }, [dadosFiltrados]);

  // Reconciliar PIX TOTVS com extrato bancário
  const pixTotvsReconciliado = useMemo(() => {
    if (!dados.length)
      return {
        total: 0,
        totalExtrato: 0,
        quantidade: 0,
        qtdConciliados: 0,
        itens: [],
      };

    // Filtrar dados TOTVS que são PIX (tp_baixa === 20 = baixa por PIX)
    const pixTotvsItems = dados.filter((item) => Number(item.tp_baixa) === 20);
    if (pixTotvsItems.length === 0)
      return {
        total: 0,
        totalExtrato: 0,
        quantidade: 0,
        qtdConciliados: 0,
        itens: [],
      };

    // Itens PIX do extrato bancário (créditos com 'PIX' na descrição)
    const pixExtrato = dadosFiltrados.filter(
      (d) => d.valor > 0 && d.descricao?.toUpperCase().includes('PIX'),
    );

    const extratoUsados = new Set();
    const reconciliados = [];

    for (const totvs of pixTotvsItems) {
      const dtTotvs = normalizarDataParaComparacao(
        totvs.dt_liq || totvs.dt_vencimento,
      );
      const valorFatura = parseFloat(totvs.vl_fatura) || 0;
      // vl_pago/vl_liquido é o valor que efetivamente entra no banco (vl_fatura - desconto PIX)
      const valorPago =
        parseFloat(totvs.vl_pago) || parseFloat(totvs.vl_liquido) || 0;

      let matchFound = null;
      for (let i = 0; i < pixExtrato.length; i++) {
        if (extratoUsados.has(i)) continue;
        const extrato = pixExtrato[i];
        const dtExtrato = normalizarDataParaComparacao(extrato.data);

        if (
          dtExtrato === dtTotvs &&
          Math.abs(extrato.valor - valorPago) < 0.02
        ) {
          matchFound = extrato;
          extratoUsados.add(i);
          break;
        }
      }

      reconciliados.push({
        ...totvs,
        dataFormatada: dtTotvs,
        valorTOTVS: valorFatura,
        valorExtrato: matchFound ? matchFound.valor : null,
        diferenca: matchFound ? matchFound.valor - valorFatura : null,
        conciliado: !!matchFound,
        extratoMatch: matchFound,
      });
    }

    return {
      total: reconciliados.reduce((acc, item) => acc + item.valorTOTVS, 0),
      totalExtrato: reconciliados
        .filter((i) => i.conciliado)
        .reduce((acc, item) => acc + (item.valorExtrato || 0), 0),
      quantidade: reconciliados.length,
      qtdConciliados: reconciliados.filter((i) => i.conciliado).length,
      itens: reconciliados,
    };
  }, [dados, dadosFiltrados]);

  // Calcular total de REDE DEBITO em créditos
  const totalRedeDebitoCreditos = useMemo(() => {
    const redeItems = dadosFiltrados.filter(
      (d) => d.valor > 0 && d.descricao?.toUpperCase().includes('REDE DEBITO'),
    );
    return {
      total: redeItems.reduce((acc, d) => acc + d.valor, 0),
      quantidade: redeItems.length,
      itens: redeItems,
    };
  }, [dadosFiltrados]);

  // Calcular total de GETNET DEBITO em créditos
  const totalGetnetDebitoCreditos = useMemo(() => {
    const getnetItems = dadosFiltrados.filter(
      (d) =>
        d.valor > 0 && d.descricao?.toUpperCase().includes('GETNET DEBITO'),
    );
    return {
      total: getnetItems.reduce((acc, d) => acc + d.valor, 0),
      quantidade: getnetItems.length,
      itens: getnetItems,
    };
  }, [dadosFiltrados]);

  // Calcular total de REDE ANTECIPAÇÃO / REDE ANTEC em créditos
  const totalRedeAntecipacaoCreditos = useMemo(() => {
    const redeAntecItems = dadosFiltrados.filter(
      (d) =>
        d.valor > 0 &&
        (d.descricao?.toUpperCase().includes('REDE ANTECIPAÇÃO') ||
          d.descricao?.toUpperCase().includes('REDE ANTECIPACAO') ||
          d.descricao?.toUpperCase().includes('REDE ANTEC')),
    );
    return {
      total: redeAntecItems.reduce((acc, d) => acc + d.valor, 0),
      quantidade: redeAntecItems.length,
      itens: redeAntecItems,
    };
  }, [dadosFiltrados]);

  // Calcular total de DEP DINHEIRO em créditos
  const totalDepDinheiroCreditos = useMemo(() => {
    const depItems = dadosFiltrados.filter(
      (d) => d.valor > 0 && d.descricao?.toUpperCase().includes('DEP DINHEIRO'),
    );
    return {
      total: depItems.reduce((acc, d) => acc + d.valor, 0),
      quantidade: depItems.length,
      itens: depItems,
    };
  }, [dadosFiltrados]);

  // Calcular total de LIQ.COBRANCA SIMPLES em créditos
  const totalLiqCobrancaCreditos = useMemo(() => {
    const liqItems = dadosFiltrados.filter(
      (d) =>
        d.valor > 0 &&
        d.descricao?.toUpperCase().includes('LIQ.COBRANCA SIMPLES'),
    );
    return {
      total: liqItems.reduce((acc, d) => acc + d.valor, 0),
      quantidade: liqItems.length,
      itens: liqItems,
    };
  }, [dadosFiltrados]);

  // Calcular total de GETNET CRÉDITO (TED SANTANDER CESSAO) em créditos
  const totalGetnetCreditoCreditos = useMemo(() => {
    const getnetCreditoItems = dadosFiltrados.filter(
      (d) =>
        d.valor > 0 &&
        d.descricao?.toUpperCase().includes('TED') &&
        d.descricao?.toUpperCase().includes('BANCO SANTANDER') &&
        d.descricao?.toUpperCase().includes('CESSAO DE C'),
    );
    return {
      total: getnetCreditoItems.reduce((acc, d) => acc + d.valor, 0),
      quantidade: getnetCreditoItems.length,
      itens: getnetCreditoItems,
    };
  }, [dadosFiltrados]);

  // Calcular total de OUTROS créditos (que não se encaixam nas categorias acima)
  const totalOutrosCreditos = useMemo(() => {
    const outrosItems = dadosFiltrados.filter((d) => {
      if (d.valor <= 0) return false;
      const desc = d.descricao?.toUpperCase() || '';
      // Excluir as categorias já contabilizadas
      if (desc.includes('PIX')) return false;
      if (desc.includes('REDE DEBITO')) return false;
      if (desc.includes('GETNET DEBITO')) return false;
      if (
        desc.includes('REDE ANTECIPAÇÃO') ||
        desc.includes('REDE ANTECIPACAO') ||
        desc.includes('REDE ANTEC')
      )
        return false;
      if (desc.includes('DEP DINHEIRO')) return false;
      if (desc.includes('LIQ.COBRANCA SIMPLES')) return false;
      if (
        desc.includes('TED') &&
        desc.includes('BANCO SANTANDER') &&
        desc.includes('CESSAO DE C')
      )
        return false;
      return true;
    });
    return {
      total: outrosItems.reduce((acc, d) => acc + d.valor, 0),
      quantidade: outrosItems.length,
      itens: outrosItems,
    };
  }, [dadosFiltrados]);

  // Agrupar débitos por descrição
  const debitosPorDescricao = useMemo(() => {
    const grupos = {};
    dadosFiltrados
      .filter((d) => d.valor < 0)
      .forEach((d) => {
        const desc = d.descricao || 'Sem descrição';
        if (!grupos[desc]) {
          grupos[desc] = { descricao: desc, total: 0, quantidade: 0 };
        }
        grupos[desc].total += Math.abs(d.valor);
        grupos[desc].quantidade += 1;
      });
    return Object.values(grupos).sort((a, b) => b.total - a.total);
  }, [dadosFiltrados]);

  // Exportar para Excel
  const handleExportar = () => {
    if (dadosOrdenados.length === 0) return;

    const dadosExcel = dadosOrdenados.map((d) => ({
      Data: d.data,
      Descrição: d.descricao,
      Documento: d.documento,
      'Valor (R$)': d.valor,
      'Saldo (R$)': d.saldo,
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(
      blob,
      `extrato_${bancoImportado || 'banco'}_${new Date().toISOString().split('T')[0]}.xlsx`,
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <PageTitle
          title="Extrato Bancário"
          subtitle="Importe e visualize extratos bancários"
          icon={Bank}
          iconColor="text-teal-600"
        />
        <div className="flex gap-2">
          {dadosImportados.length > 0 && (
            <>
              <button
                onClick={handleExportar}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-bold shadow-md"
              >
                <DownloadSimple size={18} weight="bold" />
                Exportar Excel
              </button>
              <button
                onClick={handleLimpar}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-bold shadow-md"
              >
                <X size={18} weight="bold" />
                Limpar Importação
              </button>
            </>
          )}
          <button
            onClick={() => setModalImportarAberto(true)}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors text-sm font-bold shadow-md"
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
                <h2 className="text-lg font-bold">Importar Extrato Bancário</h2>
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

              {/* Dica para Sicredi */}
              {bancoSelecionado === 'SICREDI' && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-800">
                  <strong>💡 Dica:</strong> Exporte o extrato do Sicredi no
                  formato XLS ou XLSX para melhor compatibilidade.
                </div>
              )}

              {/* Upload de Arquivo */}
              <div>
                <label className="block text-sm font-semibold text-[#000638] mb-2">
                  Selecione o Arquivo (XLS ou XLSX)
                </label>
                <div className="border-2 border-dashed border-[#000638]/30 rounded-lg p-4 text-center hover:border-[#000638]/50 transition-colors">
                  <input
                    type="file"
                    accept=".xls,.xlsx"
                    multiple
                    onChange={(e) =>
                      setArquivosSelecionados(Array.from(e.target.files))
                    }
                    className="hidden"
                    id="arquivo-upload"
                  />
                  <label
                    htmlFor="arquivo-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <File size={40} className="text-[#000638]/50" />
                    {arquivosSelecionados.length > 0 ? (
                      <div className="text-sm text-[#000638]">
                        <span className="font-bold">
                          {arquivosSelecionados.length} arquivo(s)
                          selecionado(s):
                        </span>
                        <ul className="mt-1 text-xs text-gray-600">
                          {arquivosSelecionados.map((arq, idx) => (
                            <li
                              key={idx}
                              className="flex items-center gap-1 justify-center"
                            >
                              <CheckCircle
                                size={12}
                                className="text-green-600"
                              />
                              {arq.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">
                        Clique para selecionar arquivo(s)
                        <br />
                        <span className="text-xs">
                          (Formatos aceitos: .xls, .xlsx)
                        </span>
                      </span>
                    )}
                  </label>
                </div>
              </div>

              {/* Resultado do Upload */}
              {uploadResultado && (
                <div
                  className={`p-4 rounded-lg ${uploadResultado.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
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
                      className={`font-semibold ${uploadResultado.success ? 'text-green-700' : 'text-red-700'}`}
                    >
                      {uploadResultado.success ? 'Sucesso!' : 'Erro!'}
                    </span>
                  </div>
                  <p
                    className={`text-sm ${uploadResultado.success ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {uploadResultado.message}
                  </p>
                  {uploadResultado.success && uploadResultado.stats && (
                    <div className="mt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2 rounded">
                          <span className="text-gray-500">
                            Total Registros:
                          </span>
                          <span className="font-bold text-[#000638] ml-1">
                            {uploadResultado.stats.totalRegistros}
                          </span>
                        </div>
                      </div>
                      {uploadResultado.stats.arquivosProcessados && (
                        <div className="bg-white p-2 rounded text-xs">
                          <span className="text-gray-500 font-semibold">
                            Arquivos processados:
                          </span>
                          <ul className="mt-1 space-y-1">
                            {uploadResultado.stats.arquivosProcessados.map(
                              (arq, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-center gap-2"
                                >
                                  <CheckCircle
                                    size={12}
                                    className="text-green-600"
                                  />
                                  <span className="font-medium">
                                    {arq.arquivo}
                                  </span>
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
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
                  uploadLoading ||
                  !bancoSelecionado ||
                  arquivosSelecionados.length === 0
                }
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Formulário de Filtros do Contas a Receber */}
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
            <div className="relative">
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Cobrança
              </label>
              <div
                onClick={() =>
                  setDropdownCobrancaAberto(!dropdownCobrancaAberto)
                }
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full bg-[#f8f9fb] text-[#000638] text-xs cursor-pointer flex items-center justify-between min-h-[30px] hover:border-[#000638]/50 transition-colors"
              >
                <span className="truncate">
                  {filtroCobranca.length === 0
                    ? 'Todos'
                    : filtroCobranca.length === 1
                      ? filtroCobranca[0].nome
                      : `${filtroCobranca.length} selecionados`}
                </span>
                <CaretDown
                  size={12}
                  className={`transition-transform ${dropdownCobrancaAberto ? 'rotate-180' : ''}`}
                />
              </div>
              {dropdownCobrancaAberto && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-[#000638]/20 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setFiltroCobranca([...tiposCobranca])}
                      className="text-[10px] px-2 py-0.5 bg-[#000638] text-white rounded hover:bg-[#000638]/80 transition-colors"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroCobranca([])}
                      className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      Limpar
                    </button>
                  </div>
                  {tiposCobranca.map((tipo) => {
                    const selecionado = filtroCobranca.some(
                      (c) => c.codigo === tipo.codigo,
                    );
                    return (
                      <div
                        key={tipo.codigo}
                        onClick={() => {
                          if (selecionado) {
                            setFiltroCobranca(
                              filtroCobranca.filter(
                                (c) => c.codigo !== tipo.codigo,
                              ),
                            );
                          } else {
                            setFiltroCobranca([...filtroCobranca, tipo]);
                          }
                        }}
                        className={`px-3 py-1.5 cursor-pointer text-xs flex items-center gap-2 hover:bg-[#000638]/5 transition-colors ${
                          selecionado ? 'bg-[#000638]/10 font-semibold' : ''
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                            selecionado
                              ? 'bg-[#000638] border-[#000638]'
                              : 'border-gray-300'
                          }`}
                        >
                          {selecionado && (
                            <CheckCircle
                              size={10}
                              className="text-white"
                              weight="fill"
                            />
                          )}
                        </div>
                        <span className="text-[#000638]">
                          {tipo.codigo} - {tipo.nome}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
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
            <div className="lg:col-span-1 relative">
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Forma Pagamento
              </label>
              <div
                onClick={() =>
                  setDropdownFormaPgtoAberto(!dropdownFormaPgtoAberto)
                }
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full bg-[#f8f9fb] text-[#000638] text-xs cursor-pointer flex items-center justify-between min-h-[30px] hover:border-[#000638]/50 transition-colors"
              >
                <span className="truncate">
                  {formasPagamentoSelecionadas.length === 0
                    ? 'Selecione...'
                    : formasPagamentoSelecionadas.length === 1
                      ? `${formasPagamentoSelecionadas[0].codigo} - ${formasPagamentoSelecionadas[0].nome}`
                      : `${formasPagamentoSelecionadas.length} selecionados`}
                </span>
                <CaretDown
                  size={12}
                  className={`transition-transform ${dropdownFormaPgtoAberto ? 'rotate-180' : ''}`}
                />
              </div>
              {dropdownFormaPgtoAberto && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-[#000638]/20 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100 flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setFormasPagamentoSelecionadas([...tiposDocumento])
                      }
                      className="text-[10px] px-2 py-0.5 bg-[#000638] text-white rounded hover:bg-[#000638]/80 transition-colors"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormasPagamentoSelecionadas([])}
                      className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      Limpar
                    </button>
                  </div>
                  {tiposDocumento.map((tipo) => {
                    const selecionado = formasPagamentoSelecionadas.some(
                      (f) => f.codigo === tipo.codigo,
                    );
                    return (
                      <div
                        key={tipo.codigo}
                        onClick={() => {
                          if (selecionado) {
                            setFormasPagamentoSelecionadas(
                              formasPagamentoSelecionadas.filter(
                                (f) => f.codigo !== tipo.codigo,
                              ),
                            );
                          } else {
                            setFormasPagamentoSelecionadas([
                              ...formasPagamentoSelecionadas,
                              tipo,
                            ]);
                          }
                        }}
                        className={`px-3 py-1.5 cursor-pointer text-xs flex items-center gap-2 hover:bg-[#000638]/5 transition-colors ${
                          selecionado ? 'bg-[#000638]/10 font-semibold' : ''
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                            selecionado
                              ? 'bg-[#000638] border-[#000638]'
                              : 'border-gray-300'
                          }`}
                        >
                          {selecionado && (
                            <CheckCircle
                              size={10}
                              className="text-white"
                              weight="fill"
                            />
                          )}
                        </div>
                        <span className="text-[#000638]">
                          {tipo.codigo} - {tipo.nome}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
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

      {/* Cards de Resumo */}
      {dadosImportados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 max-w-4xl mx-auto">
          {/* Card Créditos - Clicável */}
          <Card
            onClick={() => setModalDetalhes('creditos')}
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] rounded-xl bg-white border-l-4 border-l-green-500 cursor-pointer"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ArrowUp size={16} className="text-green-600" weight="bold" />
                <CardTitle className="text-xs font-bold text-green-700">
                  Total Créditos
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-green-600 mb-0.5">
                {totais.qtdCreditos} registros
              </div>
              <div className="text-sm font-bold text-green-700">
                {formatCurrency(totais.creditos)}
              </div>
              <CardDescription className="text-xs text-gray-500 mt-1">
                Clique para ver detalhes
              </CardDescription>
            </CardContent>
          </Card>

          {/* Card Débitos - Clicável */}
          <Card
            onClick={() => setModalDetalhes('debitos')}
            className="shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] rounded-xl bg-white border-l-4 border-l-red-500 cursor-pointer"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ArrowDown size={16} className="text-red-600" weight="bold" />
                <CardTitle className="text-xs font-bold text-red-700">
                  Total Débitos
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-red-600 mb-0.5">
                {totais.qtdDebitos} registros
              </div>
              <div className="text-sm font-bold text-red-700">
                {formatCurrency(totais.debitos)}
              </div>
              <CardDescription className="text-xs text-gray-500 mt-1">
                Clique para ver detalhes
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl rounded-xl bg-white border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyCircleDollar
                  size={16}
                  className="text-blue-600"
                  weight="fill"
                />
                <CardTitle className="text-xs font-bold text-blue-700">
                  Saldo Final
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-blue-600 mb-0.5">
                {formatCurrency(totais.saldoFinal)}
              </div>
              <CardDescription className="text-xs text-gray-500 mt-1">
                Saldo ao final do período
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Dados */}
      {dadosImportados.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
            <span className="text-sm font-bold text-[#000638]">
              Movimentações ({dadosOrdenados.length} registros)
            </span>
            <span className="text-xs text-gray-500">
              Página {paginaAtual} de {totalPaginas || 1}
            </span>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-[11px]">
              <thead className="bg-[#000638] text-white sticky top-0">
                <tr>
                  <th
                    onClick={() => handleSort('data')}
                    className="px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#000638]/80"
                  >
                    <div className="flex items-center gap-1">
                      Data {getSortIcon('data')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('descricao')}
                    className="px-3 py-2 text-left font-semibold cursor-pointer hover:bg-[#000638]/80"
                  >
                    <div className="flex items-center gap-1">
                      Descrição {getSortIcon('descricao')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('documento')}
                    className="px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#000638]/80"
                  >
                    <div className="flex items-center gap-1">
                      Documento {getSortIcon('documento')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('valor')}
                    className="px-3 py-2 text-right font-semibold whitespace-nowrap cursor-pointer hover:bg-[#000638]/80"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Valor {getSortIcon('valor')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('saldo')}
                    className="px-3 py-2 text-right font-semibold whitespace-nowrap cursor-pointer hover:bg-[#000638]/80"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Saldo {getSortIcon('saldo')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dadosPaginados.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-gray-50 ${item.tipo === 'saldo' ? 'bg-gray-100 font-semibold' : ''}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.data || '-'}
                    </td>
                    <td
                      className="px-3 py-2 max-w-xs truncate"
                      title={item.descricao}
                    >
                      {item.descricao}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.documento || '-'}
                    </td>
                    <td
                      className={`px-3 py-2 text-right whitespace-nowrap font-bold ${item.valor > 0 ? 'text-green-600' : item.valor < 0 ? 'text-red-600' : ''}`}
                    >
                      {item.valor !== null ? formatCurrency(item.valor) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-bold text-blue-600">
                      {formatCurrency(item.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <div className="text-xs text-gray-500">
                Mostrando {(paginaAtual - 1) * itensPorPagina + 1} a{' '}
                {Math.min(paginaAtual * itensPorPagina, dadosOrdenados.length)}{' '}
                de {dadosOrdenados.length} registros
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaginaAtual(1)}
                  disabled={paginaAtual === 1}
                  className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Primeira
                </button>
                <button
                  onClick={() =>
                    setPaginaAtual((prev) => Math.max(1, prev - 1))
                  }
                  disabled={paginaAtual === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Anterior
                </button>
                <span className="px-3 py-1 bg-[#000638] text-white rounded text-xs font-bold">
                  {paginaAtual}
                </span>
                <button
                  onClick={() =>
                    setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))
                  }
                  disabled={paginaAtual === totalPaginas}
                  className="px-3 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Próxima
                </button>
                <button
                  onClick={() => setPaginaAtual(totalPaginas)}
                  disabled={paginaAtual === totalPaginas}
                  className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mensagem quando não há dados */}
      {dadosImportados.length === 0 && (
        <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-12">
          <div className="text-center text-gray-500">
            <Bank size={64} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-bold text-[#000638]">
              Nenhum extrato importado
            </p>
            <p className="text-sm mt-1">
              Clique em{' '}
              <span className="font-semibold text-teal-600">
                "Importar Arquivo"
              </span>{' '}
              para começar
            </p>
          </div>
        </div>
      )}

      {/* Modal de Detalhes por Descrição */}
      {modalDetalhes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header do Modal */}
            <div
              className={`flex items-center justify-between px-6 py-4 border-b ${modalDetalhes === 'creditos' ? 'bg-green-50' : 'bg-red-50'}`}
            >
              <div className="flex items-center gap-3">
                {modalDetalhes === 'creditos' ? (
                  <ArrowUp size={24} className="text-green-600" weight="bold" />
                ) : (
                  <ArrowDown size={24} className="text-red-600" weight="bold" />
                )}
                <div>
                  <h2
                    className={`text-lg font-bold ${modalDetalhes === 'creditos' ? 'text-green-700' : 'text-red-700'}`}
                  >
                    {modalDetalhes === 'creditos'
                      ? 'Detalhes dos Créditos'
                      : 'Detalhes dos Débitos'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {modalDetalhes === 'creditos'
                      ? `${creditosPorDescricao.length} tipos de créditos • Total: ${formatCurrency(totais.creditos)}`
                      : `${debitosPorDescricao.length} tipos de débitos • Total: ${formatCurrency(totais.debitos)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalDetalhes(null);
                  setSubcardExpandido(null);
                }}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Card destacado de PIX - apenas para créditos */}
              {modalDetalhes === 'creditos' &&
                (totalPixCreditos.quantidade > 0 ||
                  pixTotvsReconciliado.quantidade > 0) && (
                  <div className="mb-4">
                    <div
                      onClick={() =>
                        setSubcardExpandido(
                          subcardExpandido === 'pix' ? null : 'pix',
                        )
                      }
                      className="p-4 bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl shadow-lg text-white cursor-pointer hover:from-teal-600 hover:to-teal-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 rounded-lg p-2">
                            <CurrencyCircleDollar size={28} weight="fill" />
                          </div>
                          <div>
                            <div className="text-sm font-medium opacity-90">
                              Total PIX Recebidos
                            </div>
                            <div className="text-2xl font-bold">
                              {formatCurrency(totalPixCreditos.total)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {totalPixCreditos.quantidade}
                            </div>
                            <div className="text-xs opacity-80">transações</div>
                          </div>
                          <CaretDown
                            size={20}
                            className={`transition-transform ${subcardExpandido === 'pix' ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                    {(subcardExpandido === 'pix' ||
                      subcardExpandido === 'pixextrato' ||
                      subcardExpandido === 'pixtotvs') && (
                      <div className="mt-2 space-y-3">
                        {/* Sub-card PIX Extrato */}
                        {totalPixCreditos.quantidade > 0 && (
                          <div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubcardExpandido(
                                  subcardExpandido === 'pixextrato'
                                    ? 'pix'
                                    : 'pixextrato',
                                );
                              }}
                              className="p-3 bg-teal-100 rounded-lg border border-teal-200 cursor-pointer hover:bg-teal-200 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-semibold text-teal-700 uppercase">
                                    PIX Extrato
                                  </div>
                                  <div className="text-lg font-bold text-teal-800">
                                    {formatCurrency(totalPixCreditos.total)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-teal-700">
                                    {totalPixCreditos.quantidade} transações
                                  </span>
                                  <CaretDown
                                    size={16}
                                    className={`text-teal-600 transition-transform ${subcardExpandido === 'pixextrato' ? 'rotate-180' : ''}`}
                                  />
                                </div>
                              </div>
                            </div>
                            {subcardExpandido === 'pixextrato' && (
                              <div className="mt-1 bg-teal-50 rounded-lg border border-teal-200 max-h-60 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-teal-100 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold text-teal-800">
                                        Data
                                      </th>
                                      <th className="px-3 py-2 text-left font-semibold text-teal-800">
                                        Descrição
                                      </th>
                                      <th className="px-3 py-2 text-right font-semibold text-teal-800">
                                        Valor
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {totalPixCreditos.itens.map((item, idx) => (
                                      <tr
                                        key={idx}
                                        className="border-b border-teal-100 hover:bg-teal-100/50"
                                      >
                                        <td className="px-3 py-2 text-gray-700">
                                          {item.data}
                                        </td>
                                        <td className="px-3 py-2 text-gray-700">
                                          {item.descricao}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium text-teal-700">
                                          {formatCurrency(item.valor)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub-card PIX TOTVS (conciliação) */}
                        {pixTotvsReconciliado.quantidade > 0 && (
                          <div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubcardExpandido(
                                  subcardExpandido === 'pixtotvs'
                                    ? 'pix'
                                    : 'pixtotvs',
                                );
                              }}
                              className="p-3 bg-emerald-100 rounded-lg border border-emerald-200 cursor-pointer hover:bg-emerald-200 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-semibold text-emerald-700 uppercase">
                                    PIX TOTVS
                                  </div>
                                  <div className="text-lg font-bold text-emerald-800">
                                    {formatCurrency(pixTotvsReconciliado.total)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-emerald-600">
                                    {pixTotvsReconciliado.qtdConciliados}/
                                    {pixTotvsReconciliado.quantidade}{' '}
                                    conciliados
                                  </span>
                                  <span className="text-sm font-bold text-emerald-700">
                                    {pixTotvsReconciliado.quantidade} títulos
                                  </span>
                                  <CaretDown
                                    size={16}
                                    className={`text-emerald-600 transition-transform ${subcardExpandido === 'pixtotvs' ? 'rotate-180' : ''}`}
                                  />
                                </div>
                              </div>
                            </div>
                            {subcardExpandido === 'pixtotvs' && (
                              <div className="mt-1 bg-emerald-50 rounded-lg border border-emerald-200 max-h-80 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-emerald-100 sticky top-0">
                                    <tr>
                                      <th className="px-2 py-2 text-left font-semibold text-emerald-800">
                                        Status
                                      </th>
                                      <th className="px-2 py-2 text-left font-semibold text-emerald-800">
                                        Data
                                      </th>
                                      <th className="px-2 py-2 text-left font-semibold text-emerald-800">
                                        Cliente
                                      </th>
                                      <th className="px-2 py-2 text-left font-semibold text-emerald-800">
                                        Fatura
                                      </th>
                                      <th className="px-2 py-2 text-right font-semibold text-emerald-800">
                                        Valor TOTVS
                                      </th>
                                      <th className="px-2 py-2 text-right font-semibold text-emerald-800">
                                        Valor Extrato
                                      </th>
                                      <th className="px-2 py-2 text-right font-semibold text-emerald-800">
                                        Diferença
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pixTotvsReconciliado.itens.map(
                                      (item, idx) => (
                                        <tr
                                          key={idx}
                                          className={`border-b border-emerald-100 ${item.conciliado ? 'bg-green-50 hover:bg-green-100/50' : 'bg-red-50 hover:bg-red-100/50'}`}
                                        >
                                          <td className="px-2 py-2">
                                            {item.conciliado ? (
                                              <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                                <CheckCircle
                                                  size={14}
                                                  weight="fill"
                                                  className="text-green-600"
                                                />
                                                OK
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                                                <WarningCircle
                                                  size={14}
                                                  weight="fill"
                                                  className="text-red-600"
                                                />
                                                Não
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-2 py-2 text-gray-700">
                                            {item.dataFormatada}
                                          </td>
                                          <td
                                            className="px-2 py-2 text-gray-700 truncate max-w-[150px]"
                                            title={item.nm_cliente}
                                          >
                                            {item.nm_cliente}
                                          </td>
                                          <td className="px-2 py-2 text-gray-700">
                                            {item.nr_fatura}
                                          </td>
                                          <td className="px-2 py-2 text-right font-medium text-emerald-700">
                                            {formatCurrency(item.valorTOTVS)}
                                          </td>
                                          <td className="px-2 py-2 text-right font-medium text-teal-700">
                                            {item.valorExtrato !== null
                                              ? formatCurrency(
                                                  item.valorExtrato,
                                                )
                                              : '-'}
                                          </td>
                                          <td
                                            className={`px-2 py-2 text-right font-medium ${item.conciliado ? 'text-orange-600' : 'text-red-600'}`}
                                          >
                                            {item.diferenca !== null
                                              ? formatCurrency(item.diferenca)
                                              : '-'}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                                {/* Resumo da conciliação */}
                                <div className="p-3 bg-emerald-100 border-t border-emerald-200 flex justify-between text-xs font-semibold text-emerald-800">
                                  <span>
                                    Total TOTVS:{' '}
                                    {formatCurrency(pixTotvsReconciliado.total)}
                                  </span>
                                  <span>
                                    Total Extrato (conciliados):{' '}
                                    {formatCurrency(
                                      pixTotvsReconciliado.totalExtrato,
                                    )}
                                  </span>
                                  <span>
                                    Taxa total:{' '}
                                    {formatCurrency(
                                      pixTotvsReconciliado.totalExtrato -
                                        pixTotvsReconciliado.total,
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              {modalDetalhes === 'creditos' &&
                (totalRedeDebitoCreditos.quantidade > 0 ||
                  totalGetnetDebitoCreditos.quantidade > 0) && (
                  <div className="mb-4">
                    <div
                      onClick={() =>
                        setSubcardExpandido(
                          subcardExpandido === 'cartaodebito'
                            ? null
                            : 'cartaodebito',
                        )
                      }
                      className="p-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg text-white cursor-pointer hover:from-purple-600 hover:to-purple-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 rounded-lg p-2">
                            <CurrencyCircleDollar size={28} weight="fill" />
                          </div>
                          <div>
                            <div className="text-sm font-medium opacity-90">
                              Cartão de Débito
                            </div>
                            <div className="text-2xl font-bold">
                              {formatCurrency(
                                (totalRedeDebitoCreditos.total || 0) +
                                  (totalGetnetDebitoCreditos.total || 0),
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {(totalRedeDebitoCreditos.quantidade || 0) +
                                (totalGetnetDebitoCreditos.quantidade || 0)}
                            </div>
                            <div className="text-xs opacity-80">transações</div>
                          </div>
                          <CaretDown
                            size={20}
                            className={`transition-transform ${subcardExpandido === 'cartaodebito' ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                    {subcardExpandido === 'cartaodebito' && (
                      <div className="mt-2 space-y-3">
                        {/* Sub-card Rede Débito */}
                        {totalRedeDebitoCreditos.quantidade > 0 && (
                          <div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubcardExpandido(
                                  subcardExpandido === 'rede'
                                    ? 'cartaodebito'
                                    : 'rede',
                                );
                              }}
                              className="p-3 bg-purple-100 rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-200 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-semibold text-purple-700 uppercase">
                                    Rede Débito
                                  </div>
                                  <div className="text-lg font-bold text-purple-800">
                                    {formatCurrency(
                                      totalRedeDebitoCreditos.total,
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-purple-700">
                                    {totalRedeDebitoCreditos.quantidade}{' '}
                                    transações
                                  </span>
                                  <CaretDown
                                    size={16}
                                    className={`text-purple-600 transition-transform ${subcardExpandido === 'rede' ? 'rotate-180' : ''}`}
                                  />
                                </div>
                              </div>
                            </div>
                            {subcardExpandido === 'rede' && (
                              <div className="mt-1 bg-purple-50 rounded-lg border border-purple-200 max-h-60 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-purple-100 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold text-purple-800">
                                        Data
                                      </th>
                                      <th className="px-3 py-2 text-left font-semibold text-purple-800">
                                        Descrição
                                      </th>
                                      <th className="px-3 py-2 text-right font-semibold text-purple-800">
                                        Valor
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {totalRedeDebitoCreditos.itens.map(
                                      (item, idx) => (
                                        <tr
                                          key={idx}
                                          className="border-b border-purple-100 hover:bg-purple-100/50"
                                        >
                                          <td className="px-3 py-2 text-gray-700">
                                            {item.data}
                                          </td>
                                          <td className="px-3 py-2 text-gray-700">
                                            {item.descricao}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-purple-700">
                                            {formatCurrency(item.valor)}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub-card Getnet Débito */}
                        {totalGetnetDebitoCreditos.quantidade > 0 && (
                          <div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubcardExpandido(
                                  subcardExpandido === 'getnet'
                                    ? 'cartaodebito'
                                    : 'getnet',
                                );
                              }}
                              className="p-3 bg-orange-100 rounded-lg border border-orange-200 cursor-pointer hover:bg-orange-200 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-semibold text-orange-700 uppercase">
                                    Getnet Débito
                                  </div>
                                  <div className="text-lg font-bold text-orange-800">
                                    {formatCurrency(
                                      totalGetnetDebitoCreditos.total,
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-orange-700">
                                    {totalGetnetDebitoCreditos.quantidade}{' '}
                                    transações
                                  </span>
                                  <CaretDown
                                    size={16}
                                    className={`text-orange-600 transition-transform ${subcardExpandido === 'getnet' ? 'rotate-180' : ''}`}
                                  />
                                </div>
                              </div>
                            </div>
                            {subcardExpandido === 'getnet' && (
                              <div className="mt-1 bg-orange-50 rounded-lg border border-orange-200 max-h-60 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-orange-100 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold text-orange-800">
                                        Data
                                      </th>
                                      <th className="px-3 py-2 text-left font-semibold text-orange-800">
                                        Descrição
                                      </th>
                                      <th className="px-3 py-2 text-right font-semibold text-orange-800">
                                        Valor
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {totalGetnetDebitoCreditos.itens.map(
                                      (item, idx) => (
                                        <tr
                                          key={idx}
                                          className="border-b border-orange-100 hover:bg-orange-100/50"
                                        >
                                          <td className="px-3 py-2 text-gray-700">
                                            {item.data}
                                          </td>
                                          <td className="px-3 py-2 text-gray-700">
                                            {item.descricao}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-orange-700">
                                            {formatCurrency(item.valor)}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              {modalDetalhes === 'creditos' &&
                (totalRedeAntecipacaoCreditos.quantidade > 0 ||
                  totalGetnetCreditoCreditos.quantidade > 0) && (
                  <div className="mb-4">
                    <div
                      onClick={() =>
                        setSubcardExpandido(
                          subcardExpandido === 'cartaocredito'
                            ? null
                            : 'cartaocredito',
                        )
                      }
                      className="p-4 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl shadow-lg text-white cursor-pointer hover:from-pink-600 hover:to-pink-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 rounded-lg p-2">
                            <CurrencyCircleDollar size={28} weight="fill" />
                          </div>
                          <div>
                            <div className="text-sm font-medium opacity-90">
                              Cartão de Crédito
                            </div>
                            <div className="text-2xl font-bold">
                              {formatCurrency(
                                (totalRedeAntecipacaoCreditos.total || 0) +
                                  (totalGetnetCreditoCreditos.total || 0),
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {(totalRedeAntecipacaoCreditos.quantidade || 0) +
                                (totalGetnetCreditoCreditos.quantidade || 0)}
                            </div>
                            <div className="text-xs opacity-80">transações</div>
                          </div>
                          <CaretDown
                            size={20}
                            className={`transition-transform ${subcardExpandido === 'cartaocredito' ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                    {subcardExpandido === 'cartaocredito' && (
                      <div className="mt-2 space-y-3">
                        {/* Sub-card Rede Antecipação */}
                        {totalRedeAntecipacaoCreditos.quantidade > 0 && (
                          <div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubcardExpandido(
                                  subcardExpandido === 'antec'
                                    ? 'cartaocredito'
                                    : 'antec',
                                );
                              }}
                              className="p-3 bg-pink-100 rounded-lg border border-pink-200 cursor-pointer hover:bg-pink-200 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-semibold text-pink-700 uppercase">
                                    Rede Antecipação
                                  </div>
                                  <div className="text-lg font-bold text-pink-800">
                                    {formatCurrency(
                                      totalRedeAntecipacaoCreditos.total,
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-pink-700">
                                    {totalRedeAntecipacaoCreditos.quantidade}{' '}
                                    transações
                                  </span>
                                  <CaretDown
                                    size={16}
                                    className={`text-pink-600 transition-transform ${subcardExpandido === 'antec' ? 'rotate-180' : ''}`}
                                  />
                                </div>
                              </div>
                            </div>
                            {subcardExpandido === 'antec' && (
                              <div className="mt-1 bg-pink-50 rounded-lg border border-pink-200 max-h-60 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-pink-100 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold text-pink-800">
                                        Data
                                      </th>
                                      <th className="px-3 py-2 text-left font-semibold text-pink-800">
                                        Descrição
                                      </th>
                                      <th className="px-3 py-2 text-right font-semibold text-pink-800">
                                        Valor
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {totalRedeAntecipacaoCreditos.itens.map(
                                      (item, idx) => (
                                        <tr
                                          key={idx}
                                          className="border-b border-pink-100 hover:bg-pink-100/50"
                                        >
                                          <td className="px-3 py-2 text-gray-700">
                                            {item.data}
                                          </td>
                                          <td className="px-3 py-2 text-gray-700">
                                            {item.descricao}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-pink-700">
                                            {formatCurrency(item.valor)}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub-card Getnet Crédito */}
                        {totalGetnetCreditoCreditos.quantidade > 0 && (
                          <div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubcardExpandido(
                                  subcardExpandido === 'getnetcred'
                                    ? 'cartaocredito'
                                    : 'getnetcred',
                                );
                              }}
                              className="p-3 bg-amber-100 rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-200 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-semibold text-amber-700 uppercase">
                                    Getnet Crédito
                                  </div>
                                  <div className="text-lg font-bold text-amber-800">
                                    {formatCurrency(
                                      totalGetnetCreditoCreditos.total,
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-amber-700">
                                    {totalGetnetCreditoCreditos.quantidade}{' '}
                                    transações
                                  </span>
                                  <CaretDown
                                    size={16}
                                    className={`text-amber-600 transition-transform ${subcardExpandido === 'getnetcred' ? 'rotate-180' : ''}`}
                                  />
                                </div>
                              </div>
                            </div>
                            {subcardExpandido === 'getnetcred' && (
                              <div className="mt-1 bg-amber-50 rounded-lg border border-amber-200 max-h-60 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-amber-100 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold text-amber-800">
                                        Data
                                      </th>
                                      <th className="px-3 py-2 text-left font-semibold text-amber-800">
                                        Descrição
                                      </th>
                                      <th className="px-3 py-2 text-right font-semibold text-amber-800">
                                        Valor
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {totalGetnetCreditoCreditos.itens.map(
                                      (item, idx) => (
                                        <tr
                                          key={idx}
                                          className="border-b border-amber-100 hover:bg-amber-100/50"
                                        >
                                          <td className="px-3 py-2 text-gray-700">
                                            {item.data}
                                          </td>
                                          <td className="px-3 py-2 text-gray-700">
                                            {item.descricao}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-amber-700">
                                            {formatCurrency(item.valor)}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              {modalDetalhes === 'creditos' &&
                totalDepDinheiroCreditos.quantidade > 0 && (
                  <div className="mb-4">
                    <div
                      onClick={() =>
                        setSubcardExpandido(
                          subcardExpandido === 'dep' ? null : 'dep',
                        )
                      }
                      className="p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-lg text-white cursor-pointer hover:from-emerald-600 hover:to-emerald-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 rounded-lg p-2">
                            <CurrencyCircleDollar size={28} weight="fill" />
                          </div>
                          <div>
                            <div className="text-sm font-medium opacity-90">
                              Total Depósito Dinheiro
                            </div>
                            <div className="text-2xl font-bold">
                              {formatCurrency(totalDepDinheiroCreditos.total)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {totalDepDinheiroCreditos.quantidade}
                            </div>
                            <div className="text-xs opacity-80">transações</div>
                          </div>
                          <CaretDown
                            size={20}
                            className={`transition-transform ${subcardExpandido === 'dep' ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                    {subcardExpandido === 'dep' && (
                      <div className="mt-2 bg-emerald-50 rounded-lg border border-emerald-200 max-h-60 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-emerald-100 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-emerald-800">
                                Data
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-emerald-800">
                                Descrição
                              </th>
                              <th className="px-3 py-2 text-right font-semibold text-emerald-800">
                                Valor
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {totalDepDinheiroCreditos.itens.map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-emerald-100 hover:bg-emerald-100/50"
                              >
                                <td className="px-3 py-2 text-gray-700">
                                  {item.data}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {item.descricao}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-emerald-700">
                                  {formatCurrency(item.valor)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              {modalDetalhes === 'creditos' &&
                totalLiqCobrancaCreditos.quantidade > 0 && (
                  <div className="mb-4">
                    <div
                      onClick={() =>
                        setSubcardExpandido(
                          subcardExpandido === 'liq' ? null : 'liq',
                        )
                      }
                      className="p-4 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl shadow-lg text-white cursor-pointer hover:from-cyan-600 hover:to-cyan-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 rounded-lg p-2">
                            <CurrencyCircleDollar size={28} weight="fill" />
                          </div>
                          <div>
                            <div className="text-sm font-medium opacity-90">
                              Total Liq. Cobrança Simples
                            </div>
                            <div className="text-2xl font-bold">
                              {formatCurrency(totalLiqCobrancaCreditos.total)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {totalLiqCobrancaCreditos.quantidade}
                            </div>
                            <div className="text-xs opacity-80">transações</div>
                          </div>
                          <CaretDown
                            size={20}
                            className={`transition-transform ${subcardExpandido === 'liq' ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                    {subcardExpandido === 'liq' && (
                      <div className="mt-2 bg-cyan-50 rounded-lg border border-cyan-200 max-h-60 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-cyan-100 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-cyan-800">
                                Data
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-cyan-800">
                                Descrição
                              </th>
                              <th className="px-3 py-2 text-right font-semibold text-cyan-800">
                                Valor
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {totalLiqCobrancaCreditos.itens.map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-cyan-100 hover:bg-cyan-100/50"
                              >
                                <td className="px-3 py-2 text-gray-700">
                                  {item.data}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {item.descricao}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-cyan-700">
                                  {formatCurrency(item.valor)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              {modalDetalhes === 'creditos' &&
                totalOutrosCreditos.quantidade > 0 && (
                  <div className="mb-4">
                    <div
                      onClick={() =>
                        setSubcardExpandido(
                          subcardExpandido === 'outros' ? null : 'outros',
                        )
                      }
                      className="p-4 bg-gradient-to-r from-gray-500 to-gray-600 rounded-xl shadow-lg text-white cursor-pointer hover:from-gray-600 hover:to-gray-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 rounded-lg p-2">
                            <CurrencyCircleDollar size={28} weight="fill" />
                          </div>
                          <div>
                            <div className="text-sm font-medium opacity-90">
                              Outros
                            </div>
                            <div className="text-2xl font-bold">
                              {formatCurrency(totalOutrosCreditos.total)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-3xl font-bold">
                              {totalOutrosCreditos.quantidade}
                            </div>
                            <div className="text-xs opacity-80">transações</div>
                          </div>
                          <CaretDown
                            size={20}
                            className={`transition-transform ${subcardExpandido === 'outros' ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                    {subcardExpandido === 'outros' && (
                      <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-800">
                                Data
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-800">
                                Descrição
                              </th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-800">
                                Valor
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {totalOutrosCreditos.itens.map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-gray-100 hover:bg-gray-100/50"
                              >
                                <td className="px-3 py-2 text-gray-700">
                                  {item.data}
                                </td>
                                <td className="px-3 py-2 text-gray-700">
                                  {item.descricao}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-gray-700">
                                  {formatCurrency(item.valor)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              {/* Mensagem quando não há débitos */}
              {modalDetalhes === 'debitos' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {debitosPorDescricao.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-3 shadow-sm bg-red-50 border-red-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-medium text-gray-800 break-words"
                            title={item.descricao}
                          >
                            {item.descricao}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.quantidade}{' '}
                            {item.quantidade === 1 ? 'registro' : 'registros'}
                          </div>
                        </div>
                        <div className="text-sm font-bold whitespace-nowrap text-red-600">
                          {formatCurrency(item.total)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => {
                  setModalDetalhes(null);
                  setSubcardExpandido(null);
                }}
                className="px-4 py-2 bg-[#000638] text-white rounded-lg text-sm font-semibold hover:bg-[#000638]/90 transition-colors"
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

export default ExtratoBancario;
