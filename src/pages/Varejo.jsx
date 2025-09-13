import React, { useState } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import custoProdutos from '../custoprodutos.json';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ArrowsClockwise, CaretDown, CaretRight, CaretUp, CurrencyDollar, ShoppingCart, Package, CaretLeft, Spinner, Percent, TrendUp, Truck, Storefront } from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import PageTitle from '../components/ui/PageTitle';




const Varejo = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: '',
    cd_empresa: ''
  });

  // Cria um Map para lookup rápido do custo pelo código
  const custoMap = React.useMemo(() => {
    const map = {};
    if (custoProdutos && Array.isArray(custoProdutos)) {
      custoProdutos.forEach(item => {
        if (item && item.Codigo && item.Custo !== undefined) {
          map[item.Codigo.trim()] = item.Custo;
        }
      });
    }
    return map;
  }, []);

  // Função para calcular margem do canal
  function calcularMargemCanal(fat, custo) {
    if (fat > 0 && custo > 0) return ((fat - custo) / fat) * 100;
    return null;
  }

  // Cálculos para os cards
  const faturamentoVarejo = React.useMemo(() => {
    const somaSaidas = dados.filter(row => row.tp_operacao === 'S').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
    const somaEntradas = dados.filter(row => row.tp_operacao === 'E').reduce((acc, row) => acc + ((Number(row.vl_unitliquido) || 0) * (Number(row.qt_faturado) || 1)), 0);
    return somaSaidas - somaEntradas;
  }, [dados]);

  const custoBrutoVarejo = React.useMemo(() => {
    let custoTotal = 0;
    dados.forEach(row => {
      if (row.tp_operacao === 'S') {
        const qtFaturado = Number(row.qt_faturado) || 1;
        const custoUnit = custoMap[row.cd_nivel?.trim()];
        if (custoUnit !== undefined) {
          custoTotal += qtFaturado * custoUnit;
        }
      }
    });
    return custoTotal;
  }, [dados, custoMap]);

  const precoTabelaVarejo = React.useMemo(() => {
    let total = 0;
    dados.forEach(row => {
      const q = Number(row.qt_faturado) || 1;
      const bruto = (Number(row.vl_unitbruto) || 0) * q;
      if (row.tp_operacao === 'S') total += bruto;
      if (row.tp_operacao === 'E') total -= bruto; // Compensação de entrada para varejo
    });
    return total;
  }, [dados]);

  // Frete Varejo (S - E)
  const freteVarejo = React.useMemo(() => {
    let total = 0;
    dados.forEach(row => {
      const frete = Number(row.vl_freterat) || 0;
      if (row.tp_operacao === 'S') total += frete;
      if (row.tp_operacao === 'E') total -= frete;
    });
    return total;
  }, [dados]);

  // Devoluções Varejo (entradas E)
  const devolucoesVarejo = React.useMemo(() => {
    let total = 0;
    dados.forEach(row => {
      if (row.tp_operacao === 'E') {
        const q = Number(row.qt_faturado) || 1;
        const valor = (Number(row.vl_unitliquido) || 0) * q;
        total += valor;
      }
    });
    return total;
  }, [dados]);

  // Injetar CSS customizado para as tabelas
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .varejo-table-container {
        overflow-x: auto;
        position: relative;
        max-width: 100%;
      }
      
      .varejo-table-container table {
        position: relative;
      }
      
      .varejo-table {
        border-collapse: collapse;
        width: 100%;
      }
      
      .varejo-table th,
      .varejo-table td {
        padding: 3px 4px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 9px;
        line-height: 1.2;
      }
      
      .varejo-table th:last-child,
      .varejo-table td:last-child {
        border-right: none;
      }
      
      .varejo-table th {
        background-color: #000638;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 8px;
        letter-spacing: 0.05em;
      }
      
      .varejo-table tbody tr:nth-child(odd) {
        background-color: white;
      }
      
      .varejo-table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      
      .varejo-table tbody tr:hover {
        background-color: #f0f9ff;
        transition: background-color 0.2s ease;
      }
      
      /* CSS para coluna fixa */
      .varejo-table thead th:first-child,
      .varejo-table tbody td:first-child {
        position: sticky !important;
        left: 0 !important;
        z-index: 10 !important;
        border-right: 2px solid #e5e7eb !important;
        box-shadow: 2px 0 4px rgba(0,0,0,0.1) !important;
      }
      
      .varejo-table thead th:first-child {
        background: #000638 !important;
        z-index: 20 !important;
      }
      
      .varejo-table tbody td:first-child {
        background: inherit !important;
      }
      
      .varejo-table tbody tr:nth-child(odd) td:first-child {
        background: white !important;
      }
      
      .varejo-table tbody tr:nth-child(even) td:first-child {
        background: #fafafa !important;
      }
      
      .varejo-table tbody tr:hover td:first-child {
        background: #f0f9ff !important;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  const [expandTabela, setExpandTabela] = useState(true);
  const [expandRankProdutos, setExpandRankProdutos] = useState(true);
  const [sortConfig, setSortConfig] = useState({
    key: 'valorTotal',
    direction: 'desc'
  });
  const [sortConfigTransacoes, setSortConfigTransacoes] = useState({
    key: 'dt_transacao',
    direction: 'desc'
  });
  // Seleção inicial igual à página de Franquias
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([
    { cd_empresa: '2' },
    { cd_empresa: '5' },
    { cd_empresa: '500' },
    { cd_empresa: '55' },
    { cd_empresa: '550' },
    { cd_empresa: '65' },
    { cd_empresa: '650' },
    { cd_empresa: '93' },
    { cd_empresa: '930' },
    { cd_empresa: '94' },
    { cd_empresa: '940' },
    { cd_empresa: '95' },
    { cd_empresa: '950' },
    { cd_empresa: '96' },
    { cd_empresa: '960' },
    { cd_empresa: '97' },
    { cd_empresa: '970' },
    { cd_empresa: '90' },
    { cd_empresa: '91' },
    { cd_empresa: '92' },
    { cd_empresa: '890' },
    { cd_empresa: '910' },
    { cd_empresa: '920' }
  ]);

  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  const fetchDados = async (empresasParam = empresasSelecionadas) => {
    setLoading(true);
    setErro('');
    try {
      console.log('🔍 Iniciando busca de faturamento varejo:', { 
        dt_inicio: filtros.dt_inicio, 
        dt_fim: filtros.dt_fim, 
        empresas: empresasParam.length 
      });

      const empresasFiltradas = empresasParam
        .filter(emp => emp.cd_empresa !== undefined && emp.cd_empresa !== null && emp.cd_empresa !== '')
        .map(emp => emp.cd_empresa);

      if (empresasFiltradas.length === 0) {
        throw new Error('Nenhuma empresa válida selecionada');
      }

      const params = {
        dt_inicio: filtros.dt_inicio || '2025-07-01',
        dt_fim: filtros.dt_fim || '2025-07-15',
        cd_empresa: empresasFiltradas
      };

      const result = await apiClient.sales.faturamento(params);
      
      if (result.success) {
        console.log('✅ Dados de varejo recebidos:', {
          total: result.data.length,
          estatisticas: result.metadata?.totals,
          periodo: result.metadata?.periodo,
          amostra: result.data.slice(0, 2)
        });
        setDados(result.data);
      } else {
        throw new Error(result.message || 'Erro ao buscar dados de faturamento');
      }
    } catch (err) {
      console.error('❌ Erro ao buscar dados de varejo:', err);
      setErro('Erro ao buscar dados do servidor.');
      setDados([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma loja para consultar!');
      return;
    }
    fetchDados(empresasSelecionadas);
  };

  function formatarDataBR(data) {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  // Função para exportar o ranking para Excel
  const exportarRankParaExcel = () => {
    const rankProdutos = dados.reduce((acc, row) => {
      const nivel = row.cd_nivel;
      if (!acc[nivel]) {
        acc[nivel] = {
          cd_nivel: nivel,
          modelo: row.ds_nivel,
          valorTotal: 0,
          valorBrutoTotal: 0,
          quantidade: 0
        };
      }
      const qtFaturado = Number(row.qt_faturado) || 1;
      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
      if (row.tp_operacao === 'S') {
        acc[nivel].valorTotal += valor;
        acc[nivel].valorBrutoTotal += valorBruto;
        acc[nivel].quantidade += qtFaturado;
      } else if (row.tp_operacao === 'E') {
        acc[nivel].valorTotal -= valor;
        acc[nivel].valorBrutoTotal -= valorBruto;
        acc[nivel].quantidade -= qtFaturado;
      }
      return acc;
    }, {});
    const custoMap = {};
    if (custoProdutos && Array.isArray(custoProdutos)) {
      custoProdutos.forEach(item => {
        if (item && item.Codigo && item.Custo !== undefined) {
          custoMap[item.Codigo.trim()] = item.Custo;
        }
      });
    }
    const rankArray = Object.values(rankProdutos)
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .map(produto => {
        const custoUnit = custoMap[produto.cd_nivel?.trim()];
        const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
        const markup = custoTotal && custoTotal !== 0 ? produto.valorTotal / custoTotal : undefined;
        const margem = (produto.valorTotal && custoTotal !== undefined && produto.valorTotal !== 0)
          ? ((produto.valorTotal - custoTotal) / produto.valorTotal) * 100 : undefined;
        const descontoTotal = produto.valorBrutoTotal - produto.valorTotal;
        return {
          'Código Modelo': produto.cd_nivel,
          'Modelo': produto.modelo,
          'Quantidade': produto.quantidade,
          'Valor': produto.valorTotal,
          'Valor Bruto': produto.valorBrutoTotal,
          'Desconto': descontoTotal,
          'Custo': custoTotal,
          'Markup': markup,
          'Margem %': margem
        };
      });
    const ws = XLSX.utils.json_to_sheet(rankArray);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RankProdutos');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'rank_produtos_varejo.xlsx');
  };

  // Função para calcular CMV (%)
  function calcularCMV(faturamento, custo) {
    if (faturamento > 0 && custo > 0) {
      return (custo / faturamento) * 100;
    }
    return null;
  }
  // Função para calcular Markup
  function calcularMarkup(faturamento, custo) {
    if (custo > 0) {
      return faturamento / custo;
    }
    return null;
  }

  // Função para ordenar os dados
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Função para obter o ícone de ordenação
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <CaretDown size={16} className="ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <CaretUp size={16} className="ml-1" />
      : <CaretDown size={16} className="ml-1" />;
  };

  // Função para obter o ícone de ordenação da tabela de transações
  const getSortIconTransacoes = (key) => {
    if (sortConfigTransacoes.key !== key) {
      return <CaretDown size={12} className="ml-1 opacity-50" />;
    }
    return sortConfigTransacoes.direction === 'asc' 
      ? <CaretUp size={12} className="ml-1" />
      : <CaretDown size={12} className="ml-1" />;
  };

  // Função para ordenar dados da tabela de transações
  const handleSortTransacoes = (key) => {
    let direction = 'asc';
    if (sortConfigTransacoes.key === key && sortConfigTransacoes.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfigTransacoes({ key, direction });
  };

  // Função para ordenar os dados de transações
  const sortDadosTransacoes = (dados) => {
    if (!dados || dados.length === 0) return dados;

    return [...dados].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfigTransacoes.key) {
        case 'nr_transacao':
          aValue = a.nr_transacao || '';
          bValue = b.nr_transacao || '';
          break;
        case 'nm_grupoempresa':
          aValue = a.nm_grupoempresa || '';
          bValue = b.nm_grupoempresa || '';
          break;
        case 'dt_transacao':
          aValue = a.dt_transacao ? new Date(a.dt_transacao) : new Date(0);
          bValue = b.dt_transacao ? new Date(b.dt_transacao) : new Date(0);
          break;
        case 'tp_situacao':
          aValue = a.tp_situacao || '';
          bValue = b.tp_situacao || '';
          break;
        case 'tp_operacao':
          aValue = a.tp_operacao || '';
          bValue = b.tp_operacao || '';
          break;
        case 'ds_nivel':
          aValue = a.ds_nivel || '';
          bValue = b.ds_nivel || '';
          break;
        case 'qt_faturado':
          aValue = parseFloat(a.qt_faturado) || 0;
          bValue = parseFloat(b.qt_faturado) || 0;
          break;
        case 'vl_unitliquido':
          aValue = parseFloat(a.vl_unitliquido) || 0;
          bValue = parseFloat(b.vl_unitliquido) || 0;
          break;
        case 'vl_unitbruto':
          aValue = parseFloat(a.vl_unitbruto) || 0;
          bValue = parseFloat(b.vl_unitbruto) || 0;
          break;
        case 'desconto':
          const aQtFaturado = parseFloat(a.qt_faturado) || 1;
          const bQtFaturado = parseFloat(b.qt_faturado) || 1;
          const aValorTotal = (parseFloat(a.vl_unitliquido) || 0) * aQtFaturado;
          const bValorTotal = (parseFloat(b.vl_unitliquido) || 0) * bQtFaturado;
          const aValorBrutoTotal = (parseFloat(a.vl_unitbruto) || 0) * aQtFaturado;
          const bValorBrutoTotal = (parseFloat(b.vl_unitbruto) || 0) * bQtFaturado;
          aValue = aValorBrutoTotal - aValorTotal;
          bValue = bValorBrutoTotal - bValorTotal;
          break;
        default:
          aValue = a[sortConfigTransacoes.key] || '';
          bValue = b[sortConfigTransacoes.key] || '';
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortConfigTransacoes.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  // Função para ordenar os dados do ranking
  const sortRankData = (data) => {
    if (!data || data.length === 0) return data;

    return [...data].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'rank':
          // Para ranking, mantém a ordem original por valor total
          aValue = a.valorTotal || 0;
          bValue = b.valorTotal || 0;
          break;
        case 'cd_nivel':
          aValue = a.cd_nivel || '';
          bValue = b.cd_nivel || '';
          break;
        case 'modelo':
          aValue = a.modelo || '';
          bValue = b.modelo || '';
          break;
        case 'quantidade':
          aValue = a.quantidade || 0;
          bValue = b.quantidade || 0;
          break;
        case 'valorTotal':
          aValue = a.valorTotal || 0;
          bValue = b.valorTotal || 0;
          break;
        case 'valorBrutoTotal':
          aValue = a.valorBrutoTotal || 0;
          bValue = b.valorBrutoTotal || 0;
          break;
        case 'desconto':
          aValue = (a.valorBrutoTotal || 0) - (a.valorTotal || 0);
          bValue = (b.valorBrutoTotal || 0) - (b.valorTotal || 0);
          break;
        case 'custo':
          aValue = custoMap[a.cd_nivel?.trim()] !== undefined ? (a.quantidade || 0) * custoMap[a.cd_nivel.trim()] : 0;
          bValue = custoMap[b.cd_nivel?.trim()] !== undefined ? (b.quantidade || 0) * custoMap[b.cd_nivel.trim()] : 0;
          break;
        case 'cmv':
          const aCustoUnit = custoMap[a.cd_nivel?.trim()];
          const bCustoUnit = custoMap[b.cd_nivel?.trim()];
          const aCustoTotal = aCustoUnit !== undefined ? (a.quantidade || 0) * aCustoUnit : 0;
          const bCustoTotal = bCustoUnit !== undefined ? (b.quantidade || 0) * bCustoUnit : 0;
          aValue = (a.valorTotal || 0) > 0 ? aCustoTotal / (a.valorTotal || 0) : 0;
          bValue = (b.valorTotal || 0) > 0 ? bCustoTotal / (b.valorTotal || 0) : 0;
          break;
        case 'markup':
          const aMarkupCustoUnit = custoMap[a.cd_nivel?.trim()];
          const bMarkupCustoUnit = custoMap[b.cd_nivel?.trim()];
          const aMarkupCustoTotal = aMarkupCustoUnit !== undefined ? (a.quantidade || 0) * aMarkupCustoUnit : 0;
          const bMarkupCustoTotal = bMarkupCustoUnit !== undefined ? (b.quantidade || 0) * bMarkupCustoUnit : 0;
          aValue = aMarkupCustoTotal > 0 ? (a.valorTotal || 0) / aMarkupCustoTotal : 0;
          bValue = bMarkupCustoTotal > 0 ? (b.valorTotal || 0) / bMarkupCustoTotal : 0;
          break;
        case 'margem':
          const aMargemCustoUnit = custoMap[a.cd_nivel?.trim()];
          const bMargemCustoUnit = custoMap[b.cd_nivel?.trim()];
          const aMargemCustoTotal = aMargemCustoUnit !== undefined ? (a.quantidade || 0) * aMargemCustoUnit : 0;
          const bMargemCustoTotal = bMargemCustoUnit !== undefined ? (b.quantidade || 0) * bMargemCustoUnit : 0;
          aValue = (a.valorTotal || 0) > 0 ? ((a.valorTotal || 0) - aMargemCustoTotal) / (a.valorTotal || 0) : 0;
          bValue = (b.valorTotal || 0) > 0 ? ((b.valorTotal || 0) - bMargemCustoTotal) / (b.valorTotal || 0) : 0;
          break;
        default:
          aValue = a[sortConfig.key] || 0;
          bValue = b[sortConfig.key] || 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };



  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
        <PageTitle 
          title="Faturamento - Varejo"
          subtitle="Análise detalhada do faturamento e performance do canal varejo"
          icon={Storefront}
          iconColor="text-blue-600"
        />
        {/* Filtros */}
        <div className="mb-4">
          <form onSubmit={handleFiltrar} className="bg-white p-3 rounded-lg shadow-md w-full max-w-4xl mx-auto border border-[#000638]/10">
            {/* Header do Filtro */}
            <div className="mb-2">
              <div className="flex items-center gap-1 mb-2">
                <CurrencyDollar size={10} className="text-[#000638]" />
                <h2 className="text-xs font-bold text-[#000638]">Filtros</h2>
              </div>
              <p className="text-sm text-gray-600">Selecione o período e empresas para análise</p>
            </div>

            {/* Campos do Filtro */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 mb-3">
              {/* Empresas */}
              <div className="lg:col-span-2">
                <FiltroEmpresa
                  empresasSelecionadas={empresasSelecionadas}
                  onSelectEmpresas={handleSelectEmpresas}
                />
              </div>

              {/* Data Inicial */}
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                  Data Inicial
                </label>
                <input 
                  type="date" 
                  name="dt_inicio" 
                  value={filtros.dt_inicio} 
                  onChange={e => setFiltros({ ...filtros, dt_inicio: e.target.value })} 
                  className="border border-gray-300 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] focus:border-[#000638] bg-white text-[#000638] placeholder:text-gray-400 transition-all duration-200 text-xs" 
                  placeholder="Data inicial"
                />
              </div>

              {/* Data Final */}
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                  Data Final
                </label>
                <input 
                  type="date" 
                  name="dt_fim" 
                  value={filtros.dt_fim} 
                  onChange={e => setFiltros({ ...filtros, dt_fim: e.target.value })} 
                  className="border border-gray-300 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] focus:border-[#000638] bg-white text-[#000638] placeholder:text-gray-400 transition-all duration-200 text-xs" 
                  placeholder="Data final"
                />
              </div>
            </div>

            {/* Botão de Ação */}
            <div className="flex justify-end">
              <button 
                type="submit" 
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#001060] transition-all duration-200 text-xs font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <ArrowsClockwise size={10} weight="bold" /> 
                Filtrar Dados
              </button>
            </div>
          </form>
          
          {/* Mensagem de Erro */}
          {erro && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-2">
                <span className="text-red-500">⚠️</span>
                {erro}
              </div>
            </div>
          )}
        </div>

        {/* Cards de Resumo */}
        <div className="flex flex-wrap gap-3 mb-6 justify-center">
          {/* Vendas após Desconto Varejo */}
          <Card className="shadow-lg rounded-xl w-45 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={14} className="text-green-700" />
                <CardTitle className="text-xs font-bold text-green-700">Vendas após Desconto Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-green-600 mb-0.5">
                {loading ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamentoVarejo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Total Varejo</CardDescription>
            </CardContent>
          </Card>

          {/* CMV Varejo */}
          <Card className="shadow-lg rounded-xl w-45 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={14} className="text-red-700" />
                <CardTitle className="text-xs font-bold text-red-700">CMV Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-red-700 mb-0.5">
                {loading ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoVarejo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">CMV do Varejo</CardDescription>
            </CardContent>
          </Card>

          {/* CMV Varejo (%) */}
          <Card className="shadow-lg rounded-xl w-45 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Percent size={14} className="text-orange-600" />
                <CardTitle className="text-xs font-bold text-orange-600">CMV Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-orange-700 mb-0.5">
                {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                  (faturamentoVarejo > 0 && custoBrutoVarejo > 0)
                    ? ((custoBrutoVarejo / faturamentoVarejo) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                    : '--'
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">CMV Varejo (%)</CardDescription>
            </CardContent>
          </Card>

          {/* Margem Varejo */}
          <Card className="shadow-lg rounded-xl w-45 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Percent size={14} className="text-yellow-700" />
                <CardTitle className="text-xs font-bold text-yellow-700">Margem Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-yellow-700 mb-0.5">
                {loading ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
                  (() => {
                    const margem = calcularMargemCanal(faturamentoVarejo, custoBrutoVarejo);
                    return margem !== null ? margem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                  })()
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">Margem do Varejo</CardDescription>
            </CardContent>
          </Card>

          {/* Markup Varejo */}
          <Card className="shadow-lg rounded-xl w-45 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <TrendUp size={14} className="text-blue-600" />
                <CardTitle className="text-xs font-bold text-blue-600">Markup Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-blue-700 mb-0.5">
                {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                  custoBrutoVarejo > 0 ? (faturamentoVarejo / custoBrutoVarejo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">Markup Varejo</CardDescription>
            </CardContent>
          </Card>

          {/* Preço de Tabela Varejo */}
          <Card className="shadow-lg rounded-xl w-45 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={14} className="text-purple-600" />
                <CardTitle className="text-xs font-bold text-purple-600">Preço de Tabela Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-purple-700 mb-0.5">
                {loading ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (precoTabelaVarejo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Preço de Tabela do Varejo</CardDescription>
            </CardContent>
          </Card>

          {/* Desconto Varejo */}
          <Card className="shadow-lg rounded-xl w-45 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={14} className="text-orange-600" />
                <CardTitle className="text-xs font-bold text-orange-600">Desconto Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-orange-700 mb-0.5">
                {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : ((precoTabelaVarejo - faturamentoVarejo) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Desconto do Varejo</CardDescription>
            </CardContent>
          </Card>

          {/* Devoluções Varejo */}
          <Card className="shadow-lg rounded-xl w-45 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={14} className="text-gray-800" />
                <CardTitle className="text-xs font-bold text-gray-800">Devoluções Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-gray-900 mb-0.5">
                {loading ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (devolucoesVarejo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Entradas (E) no Varejo</CardDescription>
            </CardContent>
          </Card>

          {/* Frete Varejo */}
          <Card className="shadow-lg rounded-xl w-45 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={14} className="text-gray-700" />
                <CardTitle className="text-xs font-bold text-gray-700">Frete Varejo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-lg font-extrabold text-gray-800 mb-0.5">
                {loading ? <Spinner size={24} className="text-gray-600 animate-spin" /> : (freteVarejo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Frete rateado (S - E)</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Transações */}
        <div className="rounded-lg shadow-md bg-white mt-4 border border-[#000638]/10">
          <div className="p-3 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandTabela(e => !e)}>
            <h2 className="text-xs font-bold text-[#000638]">Transações</h2>
            <span className="flex items-center">
              {expandTabela ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
            </span>
          </div>
          {expandTabela && (
            <div className="varejo-table-container overflow-y-auto max-h-[500px]">
              <table className="varejo-table min-w-full text-sm">
                <thead>
                  <tr>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('nr_transacao')}
                    >
                      <div className="flex items-center justify-center">
                        Transação
                        {getSortIconTransacoes('nr_transacao')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('nm_grupoempresa')}
                    >
                      <div className="flex items-center justify-center">
                        Grupo Empresa
                        {getSortIconTransacoes('nm_grupoempresa')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('dt_transacao')}
                    >
                      <div className="flex items-center justify-center">
                        Data Transação
                        {getSortIconTransacoes('dt_transacao')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('tp_situacao')}
                    >
                      <div className="flex items-center justify-center">
                        Situação
                        {getSortIconTransacoes('tp_situacao')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('tp_operacao')}
                    >
                      <div className="flex items-center justify-center">
                        Operação
                        {getSortIconTransacoes('tp_operacao')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('ds_nivel')}
                    >
                      <div className="flex items-center justify-center">
                        Modelo
                        {getSortIconTransacoes('ds_nivel')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('qt_faturado')}
                    >
                      <div className="flex items-center justify-center">
                        Qt. Faturado
                        {getSortIconTransacoes('qt_faturado')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('vl_unitliquido')}
                    >
                      <div className="flex items-center justify-center">
                        Valor
                        {getSortIconTransacoes('vl_unitliquido')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('vl_unitbruto')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Bruto
                        {getSortIconTransacoes('vl_unitbruto')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('desconto')}
                    >
                      <div className="flex items-center justify-center">
                        Desconto
                        {getSortIconTransacoes('desconto')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="overflow-y-auto">
                  {loading ? (
                    <tr><td colSpan={10} className="text-center py-8"><Spinner size={32} className="animate-spin text-blue-600" /></td></tr>
                  ) : dados.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                  ) : (
                    sortDadosTransacoes(dados).map((row, i) => {
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valorTotal = (Number(row.vl_unitliquido) || 0) * qtFaturado;
                      const valorBrutoTotal = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                      const desconto = valorBrutoTotal - valorTotal;
                      return (
                        <tr key={i} className="border-b hover:bg-[#f8f9fb]">
                          <td className="px-0.5 py-0.5 text-center text-[8px]">{row.nr_transacao || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center text-[8px]">{row.nm_grupoempresa || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center text-[8px]">{formatarDataBR(row.dt_transacao)}</td>
                          <td className="px-0.5 py-0.5 text-center text-[8px]">{row.tp_situacao || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center text-[8px]">{row.tp_operacao || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center text-[8px]">{row.ds_nivel || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center text-[8px]">{qtFaturado.toLocaleString('pt-BR')}</td>
                          <td className={`px-0.5 py-0.5 text-right font-semibold ${row.tp_operacao === 'E' ? 'text-[#fe0000]' : row.tp_operacao === 'S' ? 'text-green-600' : ''}`}>{valorTotal !== null && valorTotal !== undefined ? valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                          <td className={`px-0.5 py-0.5 text-right font-semibold ${row.tp_operacao === 'E' ? 'text-[#fe0000]' : row.tp_operacao === 'S' ? 'text-green-600' : ''}`}>{valorBrutoTotal !== null && valorBrutoTotal !== undefined ? valorBrutoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                          <td className="px-0.5 py-0.5 text-right font-semibold text-orange-600">{desconto !== null && desconto !== undefined ? desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Card Rank Produtos */}
        <div className="mt-4 rounded-lg shadow-md bg-white border border-[#000638]/10">
          <div className="flex items-center justify-between p-3 border-b border-[#000638]/10">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-[#000638]" />
              <h2 className="text-xs font-bold text-[#000638]">Rank Produtos</h2>
            </div>
            <button
              className="px-2 py-1 bg-[#000638] text-white rounded-lg text-xs font-semibold hover:bg-[#001060] transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-1"
              onClick={exportarRankParaExcel}
              type="button"
            >
              <ArrowsClockwise size={12} />
              Baixar Excel
            </button>
          </div>
          <div className="p-3">
            <div className="varejo-table-container overflow-x-auto rounded-lg border border-gray-200">
              <table className="varejo-table min-w-full text-sm">
                <thead>
                  <tr>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('rank')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Rank {getSortIcon('rank')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('cd_nivel')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Código {getSortIcon('cd_nivel')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-left text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('modelo')}
                    >
                      <div className="flex items-center gap-1">
                        Modelo {getSortIcon('modelo')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-0.5 text-center text-[8px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('quantidade')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Qtd {getSortIcon('quantidade')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('valorTotal')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Valor {getSortIcon('valorTotal')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('valorBrutoTotal')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        V. Bruto {getSortIcon('valorBrutoTotal')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('desconto')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Desc. {getSortIcon('desconto')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('custo')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Custo {getSortIcon('custo')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('cmv')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        CMV % {getSortIcon('cmv')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('markup')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Markup {getSortIcon('markup')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('margem')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Margem % {getSortIcon('margem')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Agrupa por cd_nivel e soma os valores
                    const rankProdutos = dados.reduce((acc, row) => {
                      const nivel = row.cd_nivel;
                      if (!acc[nivel]) {
                        acc[nivel] = {
                          cd_nivel: nivel,
                          modelo: row.ds_nivel,
                          valorTotal: 0,
                          valorBrutoTotal: 0,
                          quantidade: 0
                        };
                      }
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                      if (row.tp_operacao === 'S') {
                        acc[nivel].valorTotal += valor;
                        acc[nivel].valorBrutoTotal += valorBruto;
                        acc[nivel].quantidade += qtFaturado;
                      } else if (row.tp_operacao === 'E') {
                        acc[nivel].valorTotal -= valor;
                        acc[nivel].valorBrutoTotal -= valorBruto;
                        acc[nivel].quantidade -= qtFaturado;
                      }
                      return acc;
                    }, {});
                    // Converte para array e aplica ordenação
                    const rankArray = sortRankData(Object.values(rankProdutos));
                    if (loading) {
                      return (
                        <tr>
                          <td colSpan={11} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <Spinner size={32} className="animate-spin text-blue-600" />
                              <span className="text-gray-500 text-sm">Carregando produtos...</span>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return rankArray.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <Package size={32} className="text-gray-400" />
                            <span className="text-gray-500 text-sm font-medium">Nenhum produto encontrado</span>
                            <span className="text-gray-400 text-xs">Tente ajustar os filtros de busca</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      rankArray.map((produto, index) => {
                        const descontoTotal = produto.valorBrutoTotal - produto.valorTotal;
                        return (
                          <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-0.5 py-0.5 text-center text-blue-600 font-semibold">#{index + 1}</td>
                            <td className="px-0.5 py-0.5 text-center text-[8px]">{produto.cd_nivel || 'N/A'}</td>
                            <td className="px-0.5 py-0.5 text-center text-[8px]">{produto.modelo || 'N/A'}</td>
                            <td className="px-0.5 py-0.5 text-center text-[8px]">{produto.quantidade.toLocaleString('pt-BR')}</td>
                            <td className="px-0.5 py-0.5 text-right font-semibold">{produto.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-0.5 py-0.5 text-right font-semibold">{produto.valorBrutoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-0.5 py-0.5 text-right font-semibold text-orange-600">{descontoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-0.5 py-0.5 text-right font-semibold">
                              {custoMap[produto.cd_nivel?.trim()] !== undefined
                                ? (produto.quantidade * custoMap[produto.cd_nivel.trim()]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : '-'}
                            </td>
                          {/* CMV: custo / valor */}
                          <td className="px-0.5 py-0.5 text-right font-semibold">
                            {(() => {
                              const custoUnit = custoMap[produto.cd_nivel?.trim()];
                              const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
                              if (custoTotal !== undefined && produto.valorTotal > 0) {
                                const cmv = custoTotal / produto.valorTotal;
                                return (cmv * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                              }
                              return '-';
                            })()}
                          </td>
                          <td className="px-0.5 py-0.5 text-right font-semibold">
                            {(() => {
                              const custoUnit = custoMap[produto.cd_nivel?.trim()];
                              const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
                              if (custoTotal && custoTotal !== 0) {
                                const markup = produto.valorTotal / custoTotal;
                                return markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                              }
                              return '-';
                            })()}
                          </td>
                          <td className="px-0.5 py-0.5 text-right font-semibold">
                            {(() => {
                              const custoUnit = custoMap[produto.cd_nivel?.trim()];
                              const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
                              if (produto.valorTotal && custoTotal !== undefined && produto.valorTotal !== 0) {
                                const margem = ((produto.valorTotal - custoTotal) / produto.valorTotal) * 100;
                                return margem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                              }
                              return '-';
                            })()}
                          </td>
                        </tr>
                      );
                    })
                  );
                })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
};

export default Varejo; 