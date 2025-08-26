import React, { useState } from 'react';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import custoProdutos from '../custoprodutos.json';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ArrowsClockwise, CaretDown, CaretRight, CaretUp, CurrencyDollar, Package, Spinner, Percent, TrendUp } from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';


const Multimarcas = () => {
  const apiClient = useApiClient();
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: '',
    cd_empresa: '95'
  });
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
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([
    { cd_empresa: '2' },
    { cd_empresa: '75' },
    { cd_empresa: '31' },
    { cd_empresa: '6' },
    { cd_empresa: '11' },
    { cd_empresa: '99' },
    { cd_empresa: '85' },
  ]);

  // Injetar CSS customizado para as tabelas
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .multimarcas-table-container {
        overflow-x: auto;
        position: relative;
        max-width: 100%;
      }
      
      .multimarcas-table-container table {
        position: relative;
      }
      
      .multimarcas-table {
        border-collapse: collapse;
        width: 100%;
      }
      
      .multimarcas-table th,
      .multimarcas-table td {
        padding: 6px 8px !important;
        border-right: 1px solid #f3f4f6;
        word-wrap: break-word;
        white-space: normal;
        font-size: 11px;
        line-height: 1.3;
      }
      
      .multimarcas-table th:last-child,
      .multimarcas-table td:last-child {
        border-right: none;
      }
      
      .multimarcas-table th {
        background-color: #000638;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
      }
      
      .multimarcas-table tbody tr:nth-child(odd) {
        background-color: white;
      }
      
      .multimarcas-table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      
      .multimarcas-table tbody tr:hover {
        background-color: #f0f9ff;
        transition: background-color 0.2s ease;
      }
      
      /* CSS para coluna fixa */
      .multimarcas-table thead th:first-child,
      .multimarcas-table tbody td:first-child {
        position: sticky !important;
        left: 0 !important;
        z-index: 10 !important;
        border-right: 2px solid #e5e7eb !important;
        box-shadow: 2px 0 4px rgba(0,0,0,0.1) !important;
      }
      
      .multimarcas-table thead th:first-child {
        background: #000638 !important;
        z-index: 20 !important;
      }
      
      .multimarcas-table tbody td:first-child {
        background: inherit !important;
      }
      
      .multimarcas-table tbody tr:nth-child(odd) td:first-child {
        background: white !important;
      }
      
      .multimarcas-table tbody tr:nth-child(even) td:first-child {
        background: #fafafa !important;
      }
      
      .multimarcas-table tbody tr:hover td:first-child {
        background: #f0f9ff !important;
      }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const handleSelectEmpresas = (empresas) => {
    setEmpresasSelecionadas(empresas);
  };

  const fetchDados = async (empresasParam = empresasSelecionadas) => {
    setLoading(true);
    setErro('');
    try {
      console.log('🔍 Iniciando busca de faturamento multimarcas:', { 
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

      const result = await apiClient.sales.faturamentoMtm(params);
      
      if (result.success) {
        console.log('✅ Dados de multimarcas recebidos:', {
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
      console.error('❌ Erro ao buscar dados de multimarcas:', err);
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

  // Cálculos para os cards (baseados no Consolidado)
  const calcularMargemCanal = (faturamento, custo) => {
    if (faturamento > 0 && custo > 0) {
      return ((faturamento - custo) / faturamento) * 100;
    }
    return null;
  };

  // Cálculos dos valores para os cards
  const faturamentoMultimarcas = React.useMemo(() => {
    return dados.reduce((acc, row) => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
      if (row.tp_operacao === 'S') {
        acc += valor;
      } else if (row.tp_operacao === 'E') {
        acc -= valor;
      }
      return acc;
    }, 0);
  }, [dados]);

  const custoBrutoMultimarcas = React.useMemo(() => {
    return dados.reduce((acc, row) => {
      if (row.tp_operacao === 'S') {
        const qtFaturado = Number(row.qt_faturado) || 1;
        const custoUnit = custoMap[row.cd_nivel?.trim()];
        if (custoUnit !== undefined) {
          acc += qtFaturado * custoUnit;
        }
      }
      return acc;
    }, 0);
  }, [dados, custoMap]);

  const precoTabelaMultimarcas = React.useMemo(() => {
    return dados.reduce((acc, row) => {
      const qtFaturado = Number(row.qt_faturado) || 1;
      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
      if (row.tp_operacao === 'S') {
        acc += valorBruto;
      }
      return acc;
    }, 0);
  }, [dados]);

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
    custoProdutos.forEach(item => {
      if (item.Codigo && item.Custo !== undefined) {
        custoMap[item.Codigo.trim()] = item.Custo;
      }
    });
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
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'rank_produtos_multimarcas.xlsx');
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
        case 'cd_empresa':
          aValue = a.cd_empresa || '';
          bValue = b.cd_empresa || '';
          break;
        case 'nm_pessoa':
          aValue = a.nm_pessoa || '';
          bValue = b.nm_pessoa || '';
          break;
        case 'cd_classificacao':
          aValue = a.cd_classificacao || '';
          bValue = b.cd_classificacao || '';
          break;
        case 'dt_transacao':
          aValue = a.dt_transacao ? new Date(a.dt_transacao) : new Date(0);
          bValue = b.dt_transacao ? new Date(b.dt_transacao) : new Date(0);
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
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Faturamento - Multimarcas</h1>
        {/* Filtros */}
        <div className="mb-8">
          <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2"><CurrencyDollar size={22} weight="bold" />Filtros</span>
              <span className="text-sm text-gray-500 mt-1">Selecione o período, grupo empresa ou data para análise</span>
            </div>
            <div className="flex flex-row gap-x-6 w-full">
              <div className="w-full">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={handleSelectEmpresas}
              />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Inicial</label>
                <input 
                  type="date" 
                  name="dt_inicio" 
                  value={filtros.dt_inicio} 
                  onChange={e => setFiltros({ ...filtros, dt_inicio: e.target.value })} 
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" 
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Final</label>
                <input 
                  type="date" 
                  name="dt_fim" 
                  value={filtros.dt_fim} 
                  onChange={e => setFiltros({ ...filtros, dt_fim: e.target.value })} 
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" 
                />
              </div>
            </div>
            <div className="flex justify-end w-full">
              <button type="submit" className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] transition h-10 text-sm font-bold shadow-md tracking-wide uppercase">
                <ArrowsClockwise size={18} weight="bold" /> Filtrar
              </button>
            </div>
          </form>
          {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
        </div>

        {/* Cards de Resumo */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          {/* Vendas após Desconto Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-green-700" />
                <CardTitle className="text-sm font-bold text-green-700">Vendas após Desconto Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-green-600 mb-1">
                {loading ? <Spinner size={24} className="text-green-600 animate-spin" /> : (faturamentoMultimarcas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Total Multimarcas</CardDescription>
            </CardContent>
          </Card>

          {/* CMV Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-red-700" />
                <CardTitle className="text-sm font-bold text-red-700">CMV Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-red-700 mb-1">
                {loading ? <Spinner size={24} className="text-red-600 animate-spin" /> : (custoBrutoMultimarcas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">CMV da Multimarcas</CardDescription>
            </CardContent>
          </Card>

          {/* CMV Multimarcas (%) */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Percent size={18} className="text-orange-600" />
                <CardTitle className="text-sm font-bold text-orange-600">CMV Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-orange-700 mb-1">
                {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : (
                  (faturamentoMultimarcas > 0 && custoBrutoMultimarcas > 0)
                    ? ((custoBrutoMultimarcas / faturamentoMultimarcas) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
                    : '--'
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">CMV Multimarcas (%)</CardDescription>
            </CardContent>
          </Card>

          {/* Margem Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Percent size={18} className="text-yellow-700" />
                <CardTitle className="text-sm font-bold text-yellow-700">Margem Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-yellow-700 mb-1">
                {loading ? <Spinner size={24} className="text-yellow-600 animate-spin" /> : (
                  (() => {
                    const margem = calcularMargemCanal(faturamentoMultimarcas, custoBrutoMultimarcas);
                    return margem !== null ? margem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--';
                  })()
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">Margem da Multimarcas</CardDescription>
            </CardContent>
          </Card>

          {/* Markup Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <TrendUp size={18} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-600">Markup Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-blue-700 mb-1">
                {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                  custoBrutoMultimarcas > 0 ? (faturamentoMultimarcas / custoBrutoMultimarcas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">Markup Multimarcas</CardDescription>
            </CardContent>
          </Card>

          {/* Preço de Tabela Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-purple-600" />
                <CardTitle className="text-sm font-bold text-purple-600">Preço de Tabela Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-purple-700 mb-1">
                {loading ? <Spinner size={24} className="text-purple-600 animate-spin" /> : (precoTabelaMultimarcas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Preço de Tabela da Multimarcas</CardDescription>
            </CardContent>
          </Card>

          {/* Desconto Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-orange-600" />
                <CardTitle className="text-sm font-bold text-orange-600">Desconto Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-orange-700 mb-1">
                {loading ? <Spinner size={24} className="text-orange-600 animate-spin" /> : ((precoTabelaMultimarcas - faturamentoMultimarcas) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <CardDescription className="text-xs text-gray-500">Desconto da Multimarcas</CardDescription>
            </CardContent>
          </Card>

          {/* Representatividade Multimarcas */}
          <Card className="shadow-lg rounded-xl w-64 bg-white cursor-pointer">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Percent size={18} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-600">Representatividade Multimarcas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-2xl font-extrabold text-blue-700 mb-1">
                {loading ? <Spinner size={24} className="text-blue-600 animate-spin" /> : (
                  (() => {
                    // Como estamos na página Multimarcas, a representatividade será sempre 100%
                    return '100,00%';
                  })()
                )}
              </div>
              <CardDescription className="text-xs text-gray-500">% das vendas após desconto total da rede</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Transações */}
        <div className="rounded-2xl shadow-lg bg-white mt-8 border border-[#000638]/10">
          <div className="p-4 border-b border-[#000638]/10 cursor-pointer select-none flex items-center justify-between" onClick={() => setExpandTabela(e => !e)}>
            <h2 className="text-xl font-bold text-[#000638]">Transações</h2>
            <span className="flex items-center">
              {expandTabela ? <CaretDown size={20} color="#9ca3af" /> : <CaretRight size={20} color="#9ca3af" />}
            </span>
          </div>
          {expandTabela && (
            <div className="multimarcas-table-container overflow-y-auto max-h-[500px]">
              <table className="multimarcas-table min-w-full text-sm">
                <thead>
                  <tr>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('nr_transacao')}
                    >
                      <div className="flex items-center justify-center">
                        Transação
                        {getSortIconTransacoes('nr_transacao')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('cd_empresa')}
                    >
                      <div className="flex items-center justify-center">
                        Empresa
                        {getSortIconTransacoes('cd_empresa')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('nm_pessoa')}
                    >
                      <div className="flex items-center justify-center">
                        Nome Cliente
                        {getSortIconTransacoes('nm_pessoa')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('cd_classificacao')}
                    >
                      <div className="flex items-center justify-center">
                        Classificação
                        {getSortIconTransacoes('cd_classificacao')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('dt_transacao')}
                    >
                      <div className="flex items-center justify-center">
                        Data Transação
                        {getSortIconTransacoes('dt_transacao')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('ds_nivel')}
                    >
                      <div className="flex items-center justify-center">
                        Modelo
                        {getSortIconTransacoes('ds_nivel')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('qt_faturado')}
                    >
                      <div className="flex items-center justify-center">
                        Qt. Faturado
                        {getSortIconTransacoes('qt_faturado')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('vl_unitliquido')}
                    >
                      <div className="flex items-center justify-center">
                        Valor
                        {getSortIconTransacoes('vl_unitliquido')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSortTransacoes('vl_unitbruto')}
                    >
                      <div className="flex items-center justify-center">
                        Valor Bruto
                        {getSortIconTransacoes('vl_unitbruto')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
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
                          <td className="px-0.5 py-0.5 text-center">{row.nr_transacao || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center">{row.cd_empresa || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center">{row.nm_pessoa || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center">{row.cd_classificacao || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center">{formatarDataBR(row.dt_transacao)}</td>
                          <td className="px-0.5 py-0.5 text-center">{row.ds_nivel || 'N/A'}</td>
                          <td className="px-0.5 py-0.5 text-center">{qtFaturado.toLocaleString('pt-BR')}</td>
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
        <div className="mt-8 rounded-2xl shadow-lg bg-white border border-[#000638]/10">
          <div className="flex items-center justify-between p-6 border-b border-[#000638]/10">
            <div className="flex items-center gap-3">
              <Package size={24} className="text-[#000638]" />
              <h2 className="text-xl font-bold text-[#000638]">Rank Produtos</h2>
            </div>
            <button
              className="px-4 py-2 bg-[#000638] text-white rounded-lg text-sm font-semibold hover:bg-[#001060] transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
              onClick={exportarRankParaExcel}
              type="button"
            >
              <ArrowsClockwise size={16} />
              Baixar Excel
            </button>
          </div>
          {expandRankProdutos && (
            <div className="p-6">
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-[#000638] text-white">
                      <th 
                        className="px-3 py-3 text-center font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('rank')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Rank {getSortIcon('rank')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-center font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('cd_nivel')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Código {getSortIcon('cd_nivel')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('modelo')}
                      >
                        <div className="flex items-center gap-1">
                          Modelo {getSortIcon('modelo')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-center font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('quantidade')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Qtd {getSortIcon('quantidade')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('valorTotal')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Valor {getSortIcon('valorTotal')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('valorBrutoTotal')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          V. Bruto {getSortIcon('valorBrutoTotal')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('desconto')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Desc. {getSortIcon('desconto')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('custo')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Custo {getSortIcon('custo')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('cmv')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          CMV % {getSortIcon('cmv')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
                        onClick={() => handleSort('markup')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Markup {getSortIcon('markup')}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-3 text-right font-semibold cursor-pointer hover:bg-[#001060] transition-colors"
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
                                <Spinner size={32} className="animate-spin text-gray-500" />
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
                        rankArray.map((produto, index) => (
                          <tr key={index} className="bg-[#f8f9fb] border-b hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-3 text-center text-blue-600 font-bold">#{index + 1}</td>
                            <td className="px-3 py-3 text-center font-medium">{produto.cd_nivel}</td>
                            <td className="px-3 py-3 text-left font-medium">{produto.modelo}</td>
                            <td className="px-3 py-3 text-center font-medium">{produto.quantidade.toLocaleString('pt-BR')}</td>
                            <td className="px-3 py-3 text-right font-medium">{produto.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-3 py-3 text-right font-medium">{produto.valorBrutoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-3 py-3 text-right font-medium text-orange-600">{(produto.valorBrutoTotal - produto.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-3 py-3 text-right font-medium">
                              {custoMap[produto.cd_nivel?.trim()] !== undefined
                                ? (produto.quantidade * custoMap[produto.cd_nivel.trim()]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : '-'}
                            </td>
                            <td className="px-3 py-3 text-right font-medium">
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
                            <td className="px-3 py-3 text-right font-medium">
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
                            <td className="px-3 py-3 text-right font-medium">
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
                        ))
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
};

export default Multimarcas; 