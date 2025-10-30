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
  ShoppingCart,
  Funnel,
  Spinner,
  CurrencyDollar,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
  CaretUpDown,
  FileArrowDown,
  Package,
  Eye,
  X,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const MeusPedidos = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [periodo, setPeriodo] = useState({
    dt_inicio: '',
    dt_fim: '',
  });

  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(20);

  // Estados para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

  // Estados para modal DANFE
  const [modalAberto, setModalAberto] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [danfeLoading, setDanfeLoading] = useState(false);
  const [danfeBase64, setDanfeBase64] = useState('');
  const [danfeError, setDanfeError] = useState('');

  const BaseURL = 'https://apigestaocrosby-bw2v.onrender.com/api/franchise/';
  const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';

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

  // Inicializar período padrão (mês atual)
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    setPeriodo({
      dt_inicio: primeiroDia,
      dt_fim: ultimoDia,
    });
  }, []);

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

  const buscarDados = async () => {
    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }

    if (!periodo.dt_inicio || !periodo.dt_fim) {
      alert('Selecione o período inicial e final!');
      return;
    }

    setLoading(true);
    setPaginaAtual(1);
    try {
      const todasAsPromises = empresasSelecionadas.map(async (empresa) => {
        try {
          // Usar cd_pessoa do FiltroEmpresa como cd_pessoa na rota
          const cdPessoa = empresa.cd_pessoa;

          console.log(
            `🔍 Buscando pedidos para cd_pessoa: ${cdPessoa} (empresa: ${empresa.cd_empresa}), período: ${periodo.dt_inicio} a ${periodo.dt_fim}`,
          );

          const res = await fetch(
            `${BaseURL}meuspedidos?cd_pessoa=${cdPessoa}&dt_inicio=${periodo.dt_inicio}&dt_fim=${periodo.dt_fim}`,
          );

          if (!res.ok) {
            console.warn(
              `Erro ao buscar pessoa ${cdPessoa}: HTTP ${res.status}`,
            );
            return [];
          }

          const data = await res.json();
          console.log(`✅ Resposta da API para pessoa ${cdPessoa}:`, data);

          let dadosArray = [];
          if (Array.isArray(data)) {
            dadosArray = data;
          } else if (data && typeof data === 'object') {
            if (data.data && Array.isArray(data.data)) {
              dadosArray = data.data;
            } else if (
              data.data &&
              data.data.data &&
              Array.isArray(data.data.data)
            ) {
              dadosArray = data.data.data;
            } else {
              dadosArray = Object.values(data);
            }
          }

          console.log(
            `📦 ${dadosArray.length} registros encontrados para pessoa ${cdPessoa}`,
          );

          return dadosArray.filter((item) => item && typeof item === 'object');
        } catch (err) {
          console.warn(`Erro ao buscar pessoa ${empresa.cd_pessoa}:`, err);
          return [];
        }
      });

      const resultados = await Promise.all(todasAsPromises);
      const todosOsDados = resultados.flat();

      console.log('📊 Total de dados consolidados:', todosOsDados.length);

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

  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  // Função para abrir modal e buscar DANFE
  const abrirModalDanfe = async (pedido) => {
    try {
      setModalAberto(true);
      setPedidoSelecionado(pedido);
      setDanfeLoading(true);
      setDanfeBase64('');
      setDanfeError('');

      console.log('🔍 Buscando DANFE do pedido:', pedido);

      // Formatar a data no formato esperado pela API (YYYY-MM-DD)
      const dataTransacao = pedido.dt_transacao
        ? pedido.dt_transacao.split('T')[0]
        : '';

      const payload = {
        filter: {
          branchCodeList: [parseInt(pedido.cd_grupoempresa)],
          personCodeList: [pedido.cd_pessoa],
          transactionBranchCode: parseInt(pedido.cd_grupoempresa),
          transactionCode: parseInt(pedido.nr_transacao),
          transactionDate: dataTransacao,
        },
      };

      console.log('📤 Payload enviado:', payload);

      const response = await fetch(`${TotvsURL}danfe-from-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar DANFE do pedido');
      }

      const data = await response.json();
      console.log('✅ DANFE recebida:', data);

      // Extrair base64 da resposta
      let base64 = '';
      if (data.success && data.data) {
        base64 = data.data.danfePdfBase64 || data.data.base64 || '';
      } else if (data.danfePdfBase64) {
        base64 = data.danfePdfBase64;
      }

      if (base64) {
        setDanfeBase64(base64);
        abrirPDFDanfe(base64);
      } else {
        throw new Error('DANFE não retornada pela API');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar DANFE:', error);
      setDanfeError(error.message || 'Erro ao buscar DANFE');
    } finally {
      setDanfeLoading(false);
    }
  };

  // Função para abrir PDF da DANFE em nova aba
  const abrirPDFDanfe = (base64String) => {
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
        console.log('✅ DANFE aberta em nova aba');
        // Libera a URL após um tempo
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 1000);
      } else {
        console.warn('⚠️ Popup bloqueado, iniciando download...');
        baixarPDFDanfe(blob);
      }
    } catch (error) {
      console.error('❌ Erro ao abrir DANFE:', error);
      alert('Erro ao abrir a DANFE. Tente novamente.');
    }
  };

  // Função para baixar o PDF da DANFE
  const baixarPDFDanfe = (blob) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `danfe-pedido-${
      pedidoSelecionado?.nr_transacao || 'pedido'
    }.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    console.log('✅ Download da DANFE iniciado');
  };

  // Função para exportar dados para Excel
  const handleExportExcel = () => {
    if (dadosProcessados.length === 0) {
      alert('Não há dados para exportar!');
      return;
    }

    try {
      const dadosParaExportar = dadosProcessados.map((item) => ({
        Empresa: item.cd_grupoempresa || '',
        'Data Transação':
          formatDateBR(item.dt_transacao) === '--'
            ? ''
            : formatDateBR(item.dt_transacao),
        'Nº Transação': item.nr_transacao || '',
        Cliente: item.cd_pessoa || '',
        'Nome Fantasia': item.nm_fantasia || '',
        'Valor Total': parseFloat(item.vl_total) || 0,
      }));

      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Meus Pedidos');

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `meus-pedidos-${hoje}.xlsx`;

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
        acc.valorTotal += parseFloat(item.vl_total) || 0;
        acc.quantidadePedidos += 1;
        return acc;
      },
      {
        valorTotal: 0,
        quantidadePedidos: 0,
      },
    );

    totais.ticketMedio =
      totais.quantidadePedidos > 0
        ? totais.valorTotal / totais.quantidadePedidos
        : 0;

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
        title="Meus Pedidos"
        subtitle="Consulta de pedidos/transações por cliente"
        icon={ShoppingCart}
        iconColor="text-blue-600"
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
              Selecione a empresa e o período para análise
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <div className="lg:col-span-1">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={handleSelectEmpresas}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Início
              </label>
              <input
                type="date"
                value={periodo.dt_inicio}
                onChange={(e) =>
                  setPeriodo((prev) => ({ ...prev, dt_inicio: e.target.value }))
                }
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Fim
              </label>
              <input
                type="date"
                value={periodo.dt_fim}
                onChange={(e) =>
                  setPeriodo((prev) => ({ ...prev, dt_fim: e.target.value }))
                }
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
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
                    <ShoppingCart size={10} />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Cards de Resumo */}
      {dadosProcessados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-2 mb-6 max-w-7xl mx-auto">
          {/* Valor Total */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={14} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-700">
                  Valor Total
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-green-600 mb-0.5 break-words">
                {totais.valorTotal.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Soma de todos os pedidos
              </CardDescription>
            </CardContent>
          </Card>

          {/* Quantidade de Pedidos */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-blue-600" />
                <CardTitle className="text-xs font-bold text-blue-700">
                  Quantidade
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-blue-600 mb-0.5 break-words">
                {totais.quantidadePedidos}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Total de pedidos
              </CardDescription>
            </CardContent>
          </Card>

          {/* Ticket Médio */}
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart size={14} className="text-purple-600" />
                <CardTitle className="text-xs font-bold text-purple-700">
                  Ticket Médio
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="text-sm font-extrabold text-purple-600 mb-0.5 break-words">
                {totais.ticketMedio.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Valor médio por pedido
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 max-w-7xl mx-auto w-full">
        <div className="p-3 border-b border-[#000638]/10 flex justify-between items-center">
          <h2 className="text-sm font-bold text-[#000638] font-barlow">
            Meus Pedidos
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
                  Selecione a empresa e o período desejados
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
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('cd_grupoempresa')}
                    >
                      <div className="flex items-center justify-center">
                        Empresa
                        {getSortIcon('cd_grupoempresa')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('dt_transacao')}
                    >
                      <div className="flex items-center justify-center">
                        Data Transação
                        {getSortIcon('dt_transacao')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('nr_transacao')}
                    >
                      <div className="flex items-center justify-center">
                        Nº Transação
                        {getSortIcon('nr_transacao')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('cd_pessoa')}
                    >
                      <div className="flex items-center justify-center">
                        Cliente
                        {getSortIcon('cd_pessoa')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-left cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('nm_fantasia')}
                    >
                      <div className="flex items-center">
                        Nome Fantasia
                        {getSortIcon('nm_fantasia')}
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('vl_total')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Total
                        {getSortIcon('vl_total')}
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
                      <td className="text-center text-gray-900 px-2 py-2">
                        {item.cd_grupoempresa || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {formatDateBR(item.dt_transacao)}
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {item.nr_transacao || '--'}
                      </td>
                      <td className="text-center text-gray-900 px-2 py-2">
                        {item.cd_pessoa || '--'}
                      </td>
                      <td className="text-left text-gray-900 px-2 py-2">
                        {item.nm_fantasia || '--'}
                      </td>
                      <td className="text-center font-semibold text-green-600 px-2 py-2">
                        {(parseFloat(item.vl_total) || 0).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                          },
                        )}
                      </td>
                      <td className="text-center px-2 py-2">
                        <button
                          onClick={() => abrirModalDanfe(item)}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs mx-auto font-medium"
                          title="Ver DANFE do pedido"
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

      {/* Modal DANFE */}
      {modalAberto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          style={{ zIndex: 99999 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Detalhes do Pedido - DANFE
              </h2>
              <button
                onClick={() => setModalAberto(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} weight="bold" />
              </button>
            </div>

            {/* Informações do Pedido */}
            {pedidoSelecionado && (
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Informações do Pedido
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Empresa:</span>
                    <p className="font-medium">
                      {pedidoSelecionado.cd_grupoempresa}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nº Transação:</span>
                    <p className="font-medium">
                      {pedidoSelecionado.nr_transacao}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Cliente:</span>
                    <p className="font-medium">{pedidoSelecionado.cd_pessoa}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Data:</span>
                    <p className="font-medium">
                      {formatDateBR(pedidoSelecionado.dt_transacao)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Nome Fantasia:</span>
                    <p className="font-medium">
                      {pedidoSelecionado.nm_fantasia}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Valor Total:</span>
                    <p className="font-medium text-green-600">
                      {(
                        parseFloat(pedidoSelecionado.vl_total) || 0
                      ).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Seção DANFE */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileArrowDown size={20} className="text-blue-600" />
                DANFE - Nota Fiscal Eletrônica
              </h3>

              <div className="min-h-[200px]">
                {!danfeBase64 && !danfeLoading && !danfeError && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm text-gray-500 mb-4 text-center">
                      Clique no botão abaixo para gerar a DANFE do pedido
                    </p>
                    <button
                      onClick={() => abrirModalDanfe(pedidoSelecionado)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                    >
                      <FileArrowDown size={18} weight="bold" />
                      Gerar DANFE
                    </button>
                  </div>
                )}

                {danfeLoading && (
                  <div className="flex items-center justify-center py-6">
                    <LoadingSpinner size="sm" text="Gerando DANFE..." />
                  </div>
                )}

                {danfeError && (
                  <div className="bg-red-50 border border-red-200 rounded p-4">
                    <p className="text-sm text-red-600 font-medium mb-2">
                      Erro ao gerar DANFE:
                    </p>
                    <p className="text-sm text-red-500">{danfeError}</p>
                    <button
                      onClick={() => abrirModalDanfe(pedidoSelecionado)}
                      className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}

                {danfeBase64 && (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                        <Eye size={16} className="text-green-600" />
                        DANFE gerada e aberta em nova aba!
                      </p>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => abrirPDFDanfe(danfeBase64)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                      >
                        <Eye size={18} weight="bold" />
                        Visualizar DANFE Novamente
                      </button>

                      <button
                        onClick={() => {
                          const base64 = danfeBase64.replace(
                            /^data:application\/pdf;base64,/,
                            '',
                          );
                          const binaryString = window.atob(base64);
                          const bytes = new Uint8Array(binaryString.length);
                          for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                          }
                          const blob = new Blob([bytes], {
                            type: 'application/pdf',
                          });
                          baixarPDFDanfe(blob);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium"
                      >
                        <FileArrowDown size={18} weight="bold" />
                        Baixar DANFE
                      </button>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Informações técnicas:
                      </p>
                      <p className="text-xs text-gray-500">
                        Tamanho do arquivo:{' '}
                        {typeof danfeBase64 === 'string'
                          ? `${((danfeBase64.length * 0.75) / 1024).toFixed(
                              2,
                            )} KB`
                          : '0 KB'}
                      </p>
                      <p className="text-xs text-gray-500">Formato: PDF</p>
                    </div>

                    <button
                      onClick={() => abrirModalDanfe(pedidoSelecionado)}
                      className="w-full text-sm text-gray-600 hover:text-gray-700 font-medium"
                    >
                      Gerar novamente
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setModalAberto(false)}
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

export default MeusPedidos;
