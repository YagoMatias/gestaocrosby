import React, { useState, useEffect } from 'react';
import SEOHead from '../components/ui/SEOHead';
import PageTitle from '../components/ui/PageTitle';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/cards';
import FiltroEmpresa from '../components/FiltroEmpresa';
import useApiClient from '../hooks/useApiClient';
import {
  CurrencyCircleDollar,
  Users,
  Receipt,
  Percent,
  Buildings,
  Download,
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
  Funnel,
  ChartLineUp,
} from '@phosphor-icons/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
];

const AnaliseCashback = () => {
  const { apiCall } = useApiClient();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estado para modal de gráfico ampliado
  const [modalGrafico, setModalGrafico] = useState(null);

  // Estados para métricas calculadas
  const [metrics, setMetrics] = useState({
    totalVoucherGerado: 0,
    totalTransacoes: 0,
    totalDesconto: 0,
    clientesUnicos: 0,
    percentualDesconto: 0,
    valorLiquido: 0,
    vendasAcima35: 0,
    totalDescontoAcima35: 0,
  });

  const [empresaData, setEmpresaData] = useState([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [empresaNames, setEmpresaNames] = useState({});
  const [vendedorNames, setVendedorNames] = useState({});
  const [above35Data, setAbove35Data] = useState([]);
  const [vendedorData, setVendedorData] = useState([]);
  const [vendedorAbove35Data, setVendedorAbove35Data] = useState([]);

  // Filtros
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 180); // 6 meses atrás
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(
    () => new Date().toISOString().split('T')[0],
  );
  const [dateField, setDateField] = useState('dt_transacao'); // or 'dt_voucher'
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);

  // Estados para ordenação da tabela de clientes
  const [clienteSortField, setClienteSortField] = useState(null);
  const [clienteSortOrder, setClienteSortOrder] = useState('none'); // 'none', 'asc', 'desc'
  const [sortedData, setSortedData] = useState([]);

  // Estados para ordenação da tabela de empresas
  const [empresaSortField, setEmpresaSortField] = useState(null);
  const [empresaSortOrder, setEmpresaSortOrder] = useState('none'); // 'none', 'asc', 'desc'
  const [sortedEmpresaData, setSortedEmpresaData] = useState([]);

  // Função para buscar dados da API
  const [limit, setLimit] = useState(1000);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Função para buscar nomes dos vendedores baseado nos cd_compvend das transações
  const fetchVendedorNames = async (transacoes) => {
    try {
      // Coletar cd_compvend únicos das transações
      const vendedoresUnicos = [...new Set(
        transacoes
          .map(item => item.cd_compvend)
          .filter(cd => cd !== null && cd !== undefined)
      )];

      if (vendedoresUnicos.length === 0) return;

      // Buscar nomes apenas dos vendedores que aparecem nas transações
      const resp = await apiCall('/api/faturamento/pes_vendedor', {
        cd_vendedor: vendedoresUnicos.join(',')
      });
      
      if (resp.success && Array.isArray(resp.data)) {
        const map = {};
        resp.data.forEach((v) => {
          map[String(v.cd_vendedor)] = v.nm_vendedor;
        });
        setVendedorNames(map);
      }
    } catch (err) {
      console.warn('Erro ao buscar nomes de vendedores:', err);
    }
  };

  const fetchCashbackData = async (
    params = {},
    options = { append: false },
  ) => {
    try {
      if (options.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      // garantir limit/offset nos params
      const finalParams = {
        ...params,
        limit,
        offset: options.append ? offset : 0,
      };

      const response = await apiCall(
        '/api/faturamento/analise-cashback',
        finalParams,
      );

      if (response.success) {
        let cashbackData = response.data || [];
        // Filtrar casos isolados: remover transação 679515 e voucher 85626 (não foram cashback)
        cashbackData = cashbackData.filter((item) => {
          const nrTrans = item.nr_transacao ? String(item.nr_transacao) : '';
          const nrVoucher = item.nr_voucher ? String(item.nr_voucher) : '';
          if (nrTrans === '679515' || nrVoucher === '85626') return false;
          return true;
        });

        if (options.append) {
          const combined = [...data, ...cashbackData];
          setData(combined);
          processMetrics(combined);
          processEmpresaData(combined);
          processTimeSeriesData(combined);
          processAbove35ByLoja(combined);
          
          // Buscar vendedores únicos das transações e atualizar nomes
          await fetchVendedorNames(combined);
          
          processVendedorData(combined);
          processVendedorAbove35(combined);
        } else {
          setData(cashbackData);
          processMetrics(cashbackData);
          processEmpresaData(cashbackData);
          processTimeSeriesData(cashbackData);
          processAbove35ByLoja(cashbackData);
          
          // Buscar vendedores únicos das transações e atualizar nomes
          await fetchVendedorNames(cashbackData);
          
          processVendedorData(cashbackData);
          processVendedorAbove35(cashbackData);
        }

        // Atualiza offset e hasMore conforme resposta
        setHasMore(Boolean(response.hasMore));
        if (options.append) setOffset((prev) => prev + limit);
        else setOffset(limit);
      } else {
        throw new Error(response.message || 'Erro ao buscar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar análise de cashback:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Processar métricas principais
  const processMetrics = (data) => {
    const totalVoucherGerado = data.reduce(
      (sum, item) => sum + parseFloat(item.vl_voucher || 0),
      0,
    );
    // vl_bruto = valor bruto das transações (líquido + desconto)
    const totalTransacoesBruto = data.reduce(
      (sum, item) => sum + parseFloat(item.vl_bruto || 0),
      0,
    );
    // vl_total = valor líquido (já com desconto aplicado)
    const totalTransacoesLiquido = data.reduce(
      (sum, item) => sum + parseFloat(item.vl_total || 0),
      0,
    );
    const totalDesconto = data.reduce(
      (sum, item) => sum + parseFloat(item.vl_desconto || 0),
      0,
    );
    const clientesUnicos = new Set(data.map((item) => item.cd_pessoa)).size;
    const percentualDesconto =
      totalTransacoesBruto > 0
        ? (totalDesconto / totalTransacoesBruto) * 100
        : 0;

    // Calcular transações com desconto acima de 35%
    let vendasAcima35 = 0;
    let totalDescontoAcima35 = 0;

    data.forEach((item) => {
      // Preferir pct_desconto_bruto se disponível, senão calcular
      let pct = null;
      if (
        item.pct_desconto_bruto !== undefined &&
        item.pct_desconto_bruto !== null
      ) {
        pct = parseFloat(item.pct_desconto_bruto || 0);
      } else {
        const bruto = parseFloat(
          item.vl_bruto ||
            parseFloat(item.vl_total || 0) + parseFloat(item.vl_desconto || 0),
        );
        const desconto = parseFloat(item.vl_desconto || 0);
        pct = bruto > 0 ? (desconto / bruto) * 100 : 0;
      }

      if (pct > 35) {
        vendasAcima35 += 1;
        totalDescontoAcima35 += parseFloat(item.vl_desconto || 0);
      }
    });

    setMetrics({
      totalVoucherGerado,
      totalTransacoes: totalTransacoesBruto,
      totalDesconto,
      clientesUnicos,
      percentualDesconto,
      valorLiquido: totalTransacoesLiquido,
      vendasAcima35,
      totalDescontoAcima35,
    });
  };

  // Processar dados por empresa
  const processEmpresaData = (data) => {
    const empresaMap = new Map();

    data.forEach((item) => {
      const empresa = item.cd_empresa;
      if (!empresaMap.has(empresa)) {
        empresaMap.set(empresa, {
          cd_empresa: empresa,
          nome_empresa: empresaNames[String(empresa)] || `Empresa ${empresa}`,
          vouchers: 0,
          transacoesBruto: 0,
          transacoesLiquido: 0,
          desconto: 0,
          clientes: new Set(),
        });
      }

      const emp = empresaMap.get(empresa);
      emp.vouchers += parseFloat(item.vl_voucher || 0);
      emp.transacoesBruto += parseFloat(item.vl_bruto || 0);
      emp.transacoesLiquido += parseFloat(item.vl_total || 0);
      emp.desconto += parseFloat(item.vl_desconto || 0);
      emp.clientes.add(item.cd_pessoa);
    });

    const empresaArray = Array.from(empresaMap.values()).map((emp) => ({
      ...emp,
      clientes: emp.clientes.size,
      percentualDesconto:
        emp.transacoesBruto > 0
          ? (emp.desconto / emp.transacoesBruto) * 100
          : 0,
    }));

    setEmpresaData(empresaArray);
  };

  // Processar dados por período (agrupamento por data)
  const processTimeSeriesData = (data) => {
    const dateMap = new Map();

    data.forEach((item) => {
      const date = item.dt_transacao
        ? new Date(item.dt_transacao).toISOString().split('T')[0]
        : null;
      if (!date) return;

      if (!dateMap.has(date)) {
        dateMap.set(date, {
          data: date,
          vouchers: 0,
          transacoesBruto: 0,
          transacoesLiquido: 0,
          desconto: 0,
          clientes: new Set(),
        });
      }

      const dayData = dateMap.get(date);
      dayData.vouchers += parseFloat(item.vl_voucher || 0);
      dayData.transacoesBruto += parseFloat(item.vl_bruto || 0);
      dayData.transacoesLiquido += parseFloat(item.vl_total || 0);
      dayData.desconto += parseFloat(item.vl_desconto || 0);
      dayData.clientes.add(item.cd_pessoa);
    });

    const timeArray = Array.from(dateMap.values())
      .map((day) => ({
        ...day,
        clientes: day.clientes.size,
        data: new Date(day.data).toLocaleDateString('pt-BR'),
      }))
      .sort(
        (a, b) =>
          new Date(a.data.split('/').reverse().join('-')) -
          new Date(b.data.split('/').reverse().join('-')),
      );

    setTimeSeriesData(timeArray.slice(-30)); // Últimos 30 dias
  };

  // Função para ordenar tabela de clientes
  const handleSortCliente = (field) => {
    if (clienteSortField === field) {
      // Cicla entre none -> asc -> desc -> none
      if (clienteSortOrder === 'none') {
        setClienteSortOrder('asc');
      } else if (clienteSortOrder === 'asc') {
        setClienteSortOrder('desc');
      } else {
        setClienteSortOrder('none');
        setClienteSortField(null);
      }
    } else {
      setClienteSortField(field);
      setClienteSortOrder('asc');
    }
  };

  // Atualizar dados ordenados da tabela de clientes
  useEffect(() => {
    if (clienteSortField === null || clienteSortOrder === 'none') {
      setSortedData([...data]);
    } else {
      const sorted = [...data].sort((a, b) => {
        let valueA, valueB;

        switch (clienteSortField) {
          case 'vl_bruto':
            valueA = parseFloat(a.vl_bruto || 0);
            valueB = parseFloat(b.vl_bruto || 0);
            break;
          case 'vl_desconto':
            valueA = parseFloat(a.vl_desconto || 0);
            valueB = parseFloat(b.vl_desconto || 0);
            break;
          case 'vl_total':
            valueA = parseFloat(a.vl_total || 0);
            valueB = parseFloat(b.vl_total || 0);
            break;
          case 'pct_desconto_bruto':
            valueA = parseFloat(a.pct_desconto_bruto || 0);
            valueB = parseFloat(b.pct_desconto_bruto || 0);
            break;
          case 'vl_voucher':
            valueA = parseFloat(a.vl_voucher || 0);
            valueB = parseFloat(b.vl_voucher || 0);
            break;
          default:
            return 0;
        }

        if (clienteSortOrder === 'asc') {
          return valueA - valueB;
        } else {
          return valueB - valueA;
        }
      });
      setSortedData(sorted);
    }
  }, [data, clienteSortField, clienteSortOrder]);

  // Atualizar dados ordenados da tabela de empresas
  useEffect(() => {
    if (empresaSortField === null || empresaSortOrder === 'none') {
      setSortedEmpresaData([...empresaData]);
    } else {
      const sorted = [...empresaData].sort((a, b) => {
        let valueA, valueB;

        switch (empresaSortField) {
          case 'vouchers':
            valueA = parseFloat(a.vouchers || 0);
            valueB = parseFloat(b.vouchers || 0);
            break;
          case 'transacoesBruto':
            valueA = parseFloat(a.transacoesBruto || 0);
            valueB = parseFloat(b.transacoesBruto || 0);
            break;
          case 'desconto':
            valueA = parseFloat(a.desconto || 0);
            valueB = parseFloat(b.desconto || 0);
            break;
          case 'percentualDesconto':
            valueA = parseFloat(a.percentualDesconto || 0);
            valueB = parseFloat(b.percentualDesconto || 0);
            break;
          case 'clientes':
            valueA = parseInt(a.clientes || 0);
            valueB = parseInt(b.clientes || 0);
            break;
          default:
            return 0;
        }

        if (empresaSortOrder === 'asc') {
          return valueA - valueB;
        } else {
          return valueB - valueA;
        }
      });
      setSortedEmpresaData(sorted);
    }
  }, [empresaData, empresaSortField, empresaSortOrder]);

  // Processar transações com desconto acima de 35% por loja
  const processAbove35ByLoja = (data) => {
    const map = new Map();

    data.forEach((item) => {
      // determinar porcentagem de desconto
      let pct = null;
      if (
        item.pct_desconto_bruto !== undefined &&
        item.pct_desconto_bruto !== null
      ) {
        pct = parseFloat(item.pct_desconto_bruto || 0);
      } else {
        const bruto = parseFloat(
          item.vl_bruto ||
            parseFloat(item.vl_total || 0) + parseFloat(item.vl_desconto || 0),
        );
        const desconto = parseFloat(item.vl_desconto || 0);
        pct = bruto > 0 ? (desconto / bruto) * 100 : 0;
      }

      if (pct > 35) {
        const loja = String(item.cd_empresa || 'unknown');
        if (!map.has(loja)) {
          map.set(loja, {
            cd_empresa: loja,
            nome_loja: empresaNames[loja] || `Loja ${loja}`,
            descontoTotal: 0,
            valorTransacoes: 0,
            transacoes: 0,
          });
        }

        const entry = map.get(loja);
        entry.descontoTotal += parseFloat(item.vl_desconto || 0);
        entry.valorTransacoes += parseFloat(item.vl_bruto || 0);
        entry.transacoes += 1;
      }
    });

    const arr = Array.from(map.values()).map((e) => ({
      ...e,
      mediaDescontoPorTransacao:
        e.transacoes > 0 ? e.descontoTotal / e.transacoes : 0,
      nome_loja_label: `${e.nome_loja} (${e.transacoes} tx)`,
    }));

    // ordenar por descontoTotal desc por padrão
    arr.sort((a, b) => b.descontoTotal - a.descontoTotal);
    setAbove35Data(arr);
  };

  // Processar dados por vendedor (todas as transações com voucher)
  const processVendedorData = (data) => {
    const map = new Map();

    data.forEach((item) => {
      const vendedor = String(item.cd_compvend || 'unknown');
      if (!map.has(vendedor)) {
        map.set(vendedor, {
          cd_vendedor: vendedor,
          nome_vendedor: vendedorNames[vendedor] || `Vendedor ${vendedor}`,
          descontoTotal: 0,
          valorTransacoes: 0,
          transacoes: 0,
        });
      }

      const entry = map.get(vendedor);
      entry.descontoTotal += parseFloat(item.vl_desconto || 0);
      entry.valorTransacoes += parseFloat(item.vl_bruto || 0);
      entry.transacoes += 1;
    });

    const arr = Array.from(map.values()).map((e) => ({
      ...e,
      nome_vendedor_label: `${e.nome_vendedor} (${e.transacoes} tx)`,
    }));

    // ordenar por valorTransacoes desc
    arr.sort((a, b) => b.valorTransacoes - a.valorTransacoes);
    setVendedorData(arr);
  };

  // Processar vendedores com desconto acima de 35%
  const processVendedorAbove35 = (data) => {
    const map = new Map();

    data.forEach((item) => {
      // determinar porcentagem de desconto
      let pct = null;
      if (
        item.pct_desconto_bruto !== undefined &&
        item.pct_desconto_bruto !== null
      ) {
        pct = parseFloat(item.pct_desconto_bruto || 0);
      } else {
        const bruto = parseFloat(
          item.vl_bruto ||
            parseFloat(item.vl_total || 0) + parseFloat(item.vl_desconto || 0),
        );
        const desconto = parseFloat(item.vl_desconto || 0);
        pct = bruto > 0 ? (desconto / bruto) * 100 : 0;
      }

      if (pct > 35) {
        const vendedor = String(item.cd_compvend || 'unknown');
        if (!map.has(vendedor)) {
          map.set(vendedor, {
            cd_vendedor: vendedor,
            nome_vendedor: vendedorNames[vendedor] || `Vendedor ${vendedor}`,
            descontoTotal: 0,
            valorTransacoes: 0,
            transacoes: 0,
          });
        }

        const entry = map.get(vendedor);
        entry.descontoTotal += parseFloat(item.vl_desconto || 0);
        entry.valorTransacoes += parseFloat(item.vl_bruto || 0);
        entry.transacoes += 1;
      }
    });

    const arr = Array.from(map.values()).map((e) => ({
      ...e,
      nome_vendedor_label: `${e.nome_vendedor} (${e.transacoes} tx)`,
    }));

    // ordenar por descontoTotal desc
    arr.sort((a, b) => b.descontoTotal - a.descontoTotal);
    setVendedorAbove35Data(arr);
  };

  // Função para ordenar tabela de empresas
  const handleSortEmpresa = (field) => {
    if (empresaSortField === field) {
      // Cicla entre none -> asc -> desc -> none
      if (empresaSortOrder === 'none') {
        setEmpresaSortOrder('asc');
      } else if (empresaSortOrder === 'asc') {
        setEmpresaSortOrder('desc');
      } else {
        setEmpresaSortOrder('none');
        setEmpresaSortField(null);
      }
    } else {
      setEmpresaSortField(field);
      setEmpresaSortOrder('asc');
    }
  };

  useEffect(() => {
    // carregar nomes de empresas e vendedores, então buscar os dados iniciais
    const init = async () => {
      // buscar nomes de empresas
      try {
        const resp = await apiCall('/api/company/empresas');
        if (resp.success && Array.isArray(resp.data)) {
          const map = {};
          resp.data.forEach((e) => {
            map[String(e.cd_empresa)] = e.nm_grupoempresa;
          });
          setEmpresaNames(map);
        }
      } catch (err) {
        console.warn('Erro ao buscar nomes de empresas:', err);
      }

      // depois de garantir que os nomes de empresas foram buscados, buscar os dados
      const initialParams = {
        dataInicio,
        dataFim,
        cd_empresa:
          empresasSelecionadas.length > 0
            ? empresasSelecionadas.map((e) => e.cd_empresa).join(',')
            : undefined,
        dateField,
      };

      await fetchCashbackData(initialParams);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se os nomes chegarem depois dos dados, reprocessar empresaData para aplicar os nomes
  useEffect(() => {
    if (Object.keys(empresaNames).length > 0 && data.length > 0) {
      processEmpresaData(data);
      processAbove35ByLoja(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaNames]);

  // Se os nomes de vendedores chegarem depois dos dados, reprocessar vendedorData
  useEffect(() => {
    if (Object.keys(vendedorNames).length > 0 && data.length > 0) {
      processVendedorData(data);
      processVendedorAbove35(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedorNames]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="w-full">
      <SEOHead
        title="Análise de Cashback - Crosby"
        description="Análise detalhada do programa de cashback com métricas de performance e utilização"
      />

      <div className="max-w-7xl mx-auto p-6">
        <PageTitle
          title="Análise de Cashback"
          subtitle="Dashboard completo do programa de cashback com métricas de performance e utilização"
          icon={CurrencyCircleDollar}
          iconColor="text-green-600"
        />

        {/* Filtros e Botões */}
        <div className="mb-4">
          <form className="flex flex-col bg-white p-3 rounded-lg shadow-lg w-full max-w-4xl mx-auto border border-[#000638]/10 gap-5 p-5">
            <div className="">
              <div className="mb-2">
                <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
                  <Funnel size={18} weight="bold" />
                  Filtros
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  Selecione o período e empresa para análise
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-3">
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
                    Campo de Data
                  </label>
                  <select
                    value={dateField}
                    onChange={(e) => setDateField(e.target.value)}
                    className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
                  >
                    <option value="dt_transacao">Transação</option>
                    <option value="dt_voucher">Criação Voucher</option>
                  </select>
                </div>

                <div className="w-full">
                  <FiltroEmpresa
                    empresasSelecionadas={empresasSelecionadas}
                    onSelectEmpresas={(sel) => setEmpresasSelecionadas(sel)}
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const params = {
                        dataInicio,
                        dataFim,
                        cd_empresa:
                          empresasSelecionadas.length > 0
                            ? empresasSelecionadas
                                .map((e) => e.cd_empresa)
                                .join(',')
                            : undefined,
                        dateField,
                      };
                      fetchCashbackData(params);
                    }}
                    className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercas"
                  >
                    <ChartLineUp size={16} />
                    Buscar
                  </button>
                  <button className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide">
                    <Download size={18} />
                    Exportar
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner
              size="lg"
              text="Carregando análise de cashback..."
            />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="text-center text-red-600">
                <p className="text-lg font-semibold">Erro ao carregar dados</p>
                <p className="text-sm mt-2">{error}</p>
                <button
                  onClick={fetchCashbackData}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Tentar novamente
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content - só mostra quando não está loading e não tem erro */}
        {!loading && !error && (
          <>
            {/* Cards de Resumo (estilo Faturamento) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CurrencyCircleDollar
                      size={18}
                      className="text-green-600"
                    />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Total Vouchers Gerados
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-base font-extrabold text-gray-900 mb-0.5">
                    {formatCurrency(metrics.totalVoucherGerado)}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Valor total dos vouchers
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Percent size={18} className="text-red-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Vendas com &gt; 35% desconto
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-base font-extrabold text-red-600 mb-0.5">
                    {metrics.vendasAcima35.toLocaleString()}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Desconto total:{' '}
                    {formatCurrency(metrics.totalDescontoAcima35)}
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Receipt size={18} className="text-blue-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Total Transações (Bruto)
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-base font-extrabold text-gray-900 mb-0.5">
                    {formatCurrency(metrics.totalTransacoes)}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Valor bruto das vendas
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Percent size={18} className="text-orange-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Total Desconto Aplicado
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-base font-extrabold text-orange-600 mb-0.5">
                    {formatCurrency(metrics.totalDesconto)}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {formatPercent(metrics.percentualDesconto)} do total
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-purple-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Clientes Únicos
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-base font-extrabold text-gray-900 mb-0.5">
                    {metrics.clientesUnicos.toLocaleString()}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Que utilizaram vouchers
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Receipt size={18} className="text-indigo-600" />
                    <CardTitle className="text-sm font-bold text-[#000638]">
                      Valor Líquido Total
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-base font-extrabold text-green-600 mb-0.5">
                    {formatCurrency(metrics.valorLiquido)}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    Após descontos aplicados
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Gráfico de Evolução Temporal */}
              <Card
                className="bg-white shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl cursor-pointer"
                onClick={() =>
                  setModalGrafico({
                    type: 'line',
                    title: 'Evolução Temporal (30 dias)',
                    description:
                      'Vouchers, transações e descontos ao longo do tempo',
                    data: timeSeriesData,
                  })
                }
              >
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Evolução Temporal (30 dias)
                  </CardTitle>
                  <CardDescription>
                    Vouchers, transações e descontos ao longo do tempo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-2xl shadow-lg p-4 border border-[#000638]/10">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="data" />
                        <YAxis
                          tickFormatter={(value) =>
                            `R$ ${(value / 1000).toFixed(0)}k`
                          }
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            formatCurrency(value),
                            name,
                          ]}
                          labelFormatter={(label) => `Data: ${label}`}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="vouchers"
                          stroke="#10B981"
                          strokeWidth={3}
                          name="Vouchers Gerados"
                          dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="transacoesBruto"
                          stroke="#3B82F6"
                          strokeWidth={3}
                          name="Valor Transações (Bruto)"
                          dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="desconto"
                          stroke="#F59E0B"
                          strokeWidth={3}
                          name="Desconto Aplicado"
                          dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico de Participação por Empresa */}
              <Card
                className="bg-white shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl cursor-pointer"
                onClick={() =>
                  setModalGrafico({
                    type: 'pie',
                    title: 'Distribuição por Empresa',
                    description:
                      'Participação das empresas no programa de cashback',
                    data: empresaData,
                  })
                }
              >
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Distribuição por Empresa
                  </CardTitle>
                  <CardDescription>
                    Participação das empresas no programa de cashback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-2xl shadow-lg p-4 border border-[#000638]/10">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={empresaData.slice(0, 8)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ nome_empresa, percent }) =>
                            `${nome_empresa}: ${(percent * 100).toFixed(1)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="vouchers"
                        >
                          {empresaData.slice(0, 8).map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, props) => [
                            formatCurrency(value),
                            props.payload.nome_empresa,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de Barras - Performance por Empresa */}
            <Card
              className="bg-white shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl cursor-pointer"
              onClick={() =>
                setModalGrafico({
                  type: 'bar',
                  title: 'Performance por Empresa',
                  description:
                    'Comparativo de vouchers, transações e descontos por empresa',
                  data: empresaData,
                })
              }
            >
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900 ">
                  Performance por Empresa
                </CardTitle>
                <CardDescription>
                  Comparativo de vouchers, transações e descontos por empresa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-2xl shadow-lg p-4 border border-[#000638]/10">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={empresaData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome_empresa" />
                      <YAxis
                        tickFormatter={(value) =>
                          `R$ ${(value / 1000).toFixed(0)}k`
                        }
                      />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === 'Clientes') {
                            return [value.toLocaleString(), 'Clientes'];
                          }
                          return [formatCurrency(value), name];
                        }}
                        labelFormatter={(label) => label}
                      />
                      <Legend />
                      <Bar
                        dataKey="vouchers"
                        fill="#10B981"
                        name="Vouchers Gerados"
                      />
                      <Bar
                        dataKey="transacoesBruto"
                        fill="#3B82F6"
                        name="Valor Transações (Bruto)"
                      />
                      <Bar dataKey="desconto" fill="#F59E0B" name="Desconto" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico - Descontos >35% por Loja */}
            <Card
              className="mt-6 bg-white shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl cursor-pointer"
              onClick={() =>
                setModalGrafico({
                  type: 'barAbove35',
                  title: 'Descontos >35% por Loja',
                  description:
                    'Lojas que concederam descontos acima de 35% - total de desconto e valor das transações',
                  data: above35Data,
                })
              }
            >
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900 ">
                  Descontos &gt;35% por Loja
                </CardTitle>
                <CardDescription>
                  Lojas que mais concederam descontos superiores a 35%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-2xl shadow-lg p-4 border border-[#000638]/10">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={above35Data.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(value) =>
                          `R$ ${(value / 1000).toFixed(0)}k`
                        }
                      />
                      <YAxis type="category" dataKey="nome_loja_label" width={260} />
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(value),
                          name,
                        ]}
                        labelFormatter={(label) => label}
                      />
                      <Legend />
                      <Bar
                        dataKey="descontoTotal"
                        fill="#F59E0B"
                        name="Desconto Total"
                      />
                      <Bar
                        dataKey="valorTransacoes"
                        fill="#3B82F6"
                        name="Valor Transações"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico - Vendedores que mais venderam com Voucher */}
            <Card
              className="mt-6 bg-white shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl cursor-pointer"
              onClick={() =>
                setModalGrafico({
                  type: 'barVendedorGeral',
                  title: 'Vendedores que Mais Venderam com Voucher',
                  description:
                    'Ranking de vendedores por valor de transações e desconto aplicado em vendas com voucher',
                  data: vendedorData,
                })
              }
            >
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900 ">
                  Vendedores - Vendas com Voucher
                </CardTitle>
                <CardDescription>
                  Ranking dos vendedores que mais venderam utilizando vouchers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-2xl shadow-lg p-4 border border-[#000638]/10">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vendedorData.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(value) =>
                          `R$ ${(value / 1000).toFixed(0)}k`
                        }
                      />
                      <YAxis type="category" dataKey="nome_vendedor_label" width={260} />
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(value),
                          name,
                        ]}
                        labelFormatter={(label) => label}
                      />
                      <Legend />
                      <Bar
                        dataKey="valorTransacoes"
                        fill="#3B82F6"
                        name="Valor Transações"
                      />
                      <Bar
                        dataKey="descontoTotal"
                        fill="#F59E0B"
                        name="Desconto Total"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico - Vendedores com Vendas >35% Desconto */}
            <Card
              className="mt-6 bg-white shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl cursor-pointer"
              onClick={() =>
                setModalGrafico({
                  type: 'barVendedorAbove35',
                  title: 'Vendedores com Vendas >35% de Desconto',
                  description:
                    'Vendedores que realizaram vendas com desconto acima de 35% - total de desconto e valor das transações',
                  data: vendedorAbove35Data,
                })
              }
            >
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900 ">
                  Vendedores - Descontos &gt;35%
                </CardTitle>
                <CardDescription>
                  Vendedores que mais venderam com descontos superiores a 35%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-2xl shadow-lg p-4 border border-[#000638]/10">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vendedorAbove35Data.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(value) =>
                          `R$ ${(value / 1000).toFixed(0)}k`
                        }
                      />
                      <YAxis type="category" dataKey="nome_vendedor_label" width={260} />
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(value),
                          name,
                        ]}
                        labelFormatter={(label) => label}
                      />
                      <Legend />
                      <Bar
                        dataKey="descontoTotal"
                        fill="#F59E0B"
                        name="Desconto Total"
                      />
                      <Bar
                        dataKey="valorTransacoes"
                        fill="#3B82F6"
                        name="Valor Transações"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Tabela Detalhada por Empresa */}
            <Card className="mt-6 bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900">
                  Detalhamento por Empresa
                </CardTitle>
                <CardDescription>
                  Métricas completas por empresa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                          Empresa
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() => handleSortEmpresa('vouchers')}
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por Vouchers Gerados"
                          >
                            Vouchers Gerados
                            {empresaSortField === 'vouchers' &&
                              empresaSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {empresaSortField === 'vouchers' &&
                              empresaSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {empresaSortField === 'vouchers' &&
                              empresaSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {empresaSortField !== 'vouchers' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() => handleSortEmpresa('transacoesBruto')}
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por Valor Transações"
                          >
                            Valor Transações
                            {empresaSortField === 'transacoesBruto' &&
                              empresaSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {empresaSortField === 'transacoesBruto' &&
                              empresaSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {empresaSortField === 'transacoesBruto' &&
                              empresaSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {empresaSortField !== 'transacoesBruto' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() => handleSortEmpresa('desconto')}
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por Desconto Aplicado"
                          >
                            Desconto Aplicado
                            {empresaSortField === 'desconto' &&
                              empresaSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {empresaSortField === 'desconto' &&
                              empresaSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {empresaSortField === 'desconto' &&
                              empresaSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {empresaSortField !== 'desconto' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() =>
                              handleSortEmpresa('percentualDesconto')
                            }
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por % Desconto"
                          >
                            % Desconto
                            {empresaSortField === 'percentualDesconto' &&
                              empresaSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {empresaSortField === 'percentualDesconto' &&
                              empresaSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {empresaSortField === 'percentualDesconto' &&
                              empresaSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {empresaSortField !== 'percentualDesconto' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() => handleSortEmpresa('clientes')}
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por Clientes"
                          >
                            Clientes
                            {empresaSortField === 'clientes' &&
                              empresaSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {empresaSortField === 'clientes' &&
                              empresaSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {empresaSortField === 'clientes' &&
                              empresaSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {empresaSortField !== 'clientes' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEmpresaData.map((empresa, index) => (
                        <tr
                          key={index}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <Buildings className="w-5 h-5 text-indigo-600" />
                              </div>
                              <span className="font-medium text-gray-900">
                                {empresa.nome_empresa}
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4 font-medium text-gray-900">
                            {formatCurrency(empresa.vouchers)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-700">
                            {formatCurrency(empresa.transacoesBruto)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-700">
                            {formatCurrency(empresa.desconto)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-700">
                            {formatPercent(empresa.percentualDesconto)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-700">
                            {empresa.clientes.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedEmpresaData.length > 0 &&
                  empresaSortField &&
                  empresaSortOrder !== 'none' && (
                    <div className="mt-4 flex items-center justify-end text-sm text-gray-500 px-4">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Ordenado por{' '}
                        {empresaSortField === 'vouchers'
                          ? 'Vouchers Gerados'
                          : empresaSortField === 'transacoesBruto'
                          ? 'Valor Transações'
                          : empresaSortField === 'desconto'
                          ? 'Desconto Aplicado'
                          : empresaSortField === 'percentualDesconto'
                          ? '% Desconto'
                          : empresaSortField === 'clientes'
                          ? 'Clientes'
                          : ''}{' '}
                        {empresaSortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Tabela Detalhada por Cliente */}
            <Card className="mt-6 bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-900">
                  Transações por Cliente
                </CardTitle>
                <CardDescription>
                  Detalhamento completo de todas as transações com vouchers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                          Cliente
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                          Nº Transação
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                          Data
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                          Loja
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                          Vendedor
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() => handleSortCliente('vl_bruto')}
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por Valor Transação"
                          >
                            Valor Transação
                            {clienteSortField === 'vl_bruto' &&
                              clienteSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {clienteSortField === 'vl_bruto' &&
                              clienteSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {clienteSortField === 'vl_bruto' &&
                              clienteSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {clienteSortField !== 'vl_bruto' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() => handleSortCliente('vl_desconto')}
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por Desconto"
                          >
                            Desconto
                            {clienteSortField === 'vl_desconto' &&
                              clienteSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {clienteSortField === 'vl_desconto' &&
                              clienteSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {clienteSortField === 'vl_desconto' &&
                              clienteSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {clienteSortField !== 'vl_desconto' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() => handleSortCliente('vl_total')}
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por Valor Líquido"
                          >
                            Valor Líquido
                            {clienteSortField === 'vl_total' &&
                              clienteSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {clienteSortField === 'vl_total' &&
                              clienteSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {clienteSortField === 'vl_total' &&
                              clienteSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {clienteSortField !== 'vl_total' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() =>
                              handleSortCliente('pct_desconto_bruto')
                            }
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por % Desconto"
                          >
                            % Desconto
                            {clienteSortField === 'pct_desconto_bruto' &&
                              clienteSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {clienteSortField === 'pct_desconto_bruto' &&
                              clienteSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {clienteSortField === 'pct_desconto_bruto' &&
                              clienteSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {clienteSortField !== 'pct_desconto_bruto' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">
                          <button
                            onClick={() => handleSortCliente('vl_voucher')}
                            className="flex items-center gap-2 ml-auto hover:text-gray-900 transition-colors"
                            title="Ordenar por Voucher"
                          >
                            Voucher
                            {clienteSortField === 'vl_voucher' &&
                              clienteSortOrder === 'none' && (
                                <ArrowsDownUp className="w-4 h-4 text-gray-400" />
                              )}
                            {clienteSortField === 'vl_voucher' &&
                              clienteSortOrder === 'asc' && (
                                <ArrowUp className="w-4 h-4 text-green-600" />
                              )}
                            {clienteSortField === 'vl_voucher' &&
                              clienteSortOrder === 'desc' && (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            {clienteSortField !== 'vl_voucher' && (
                              <ArrowsDownUp className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                            )}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedData.map((item, index) => (
                        <tr
                          key={index}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <Users className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">
                                  {item.cd_pessoa}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm text-gray-700">
                              {item.nr_transacao}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {item.dt_transacao
                              ? new Date(item.dt_transacao).toLocaleDateString(
                                  'pt-BR',
                                )
                              : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <Buildings className="w-4 h-4 text-green-600" />
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                {empresaNames[String(item.cd_empresa)] ||
                                  `Loja ${item.cd_empresa}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {vendedorNames[String(item.cd_compvend)] ||
                              `Vendedor ${item.cd_compvend || '-'}`}
                          </td>
                          <td className="text-right py-3 px-4 font-medium text-gray-900">
                            {formatCurrency(parseFloat(item.vl_bruto || 0))}
                          </td>
                          <td className="text-right py-3 px-4 text-orange-600 font-medium">
                            {formatCurrency(parseFloat(item.vl_desconto || 0))}
                          </td>
                          <td className="text-right py-3 px-4 text-green-600 font-semibold">
                            {formatCurrency(parseFloat(item.vl_total || 0))}
                          </td>
                          <td className="text-right py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {item.pct_desconto_bruto
                                ? `${parseFloat(
                                    item.pct_desconto_bruto,
                                  ).toFixed(1)}%`
                                : '0%'}
                            </span>
                          </td>
                          <td className="text-right py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {formatCurrency(parseFloat(item.vl_voucher || 0))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedData.length > 0 && (
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-500 px-4">
                    <span>
                      Mostrando {sortedData.length} transações com vouchers
                    </span>
                    {clienteSortField && clienteSortOrder !== 'none' && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Ordenado por{' '}
                        {clienteSortField === 'vl_bruto'
                          ? 'Valor Transação'
                          : clienteSortField === 'vl_desconto'
                          ? 'Desconto'
                          : clienteSortField === 'vl_total'
                          ? 'Valor Líquido'
                          : clienteSortField === 'pct_desconto_bruto'
                          ? '% Desconto'
                          : clienteSortField === 'vl_voucher'
                          ? 'Voucher'
                          : ''}{' '}
                        {clienteSortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                )}
                {hasMore && (
                  <div className="mt-4 flex items-center justify-center">
                    <button
                      onClick={() => {
                        const params = {
                          dataInicio,
                          dataFim,
                          cd_empresa:
                            empresasSelecionadas.length > 0
                              ? empresasSelecionadas
                                  .map((e) => e.cd_empresa)
                                  .join(',')
                              : undefined,
                          dateField,
                        };
                        fetchCashbackData(params, { append: true });
                      }}
                      disabled={loadingMore}
                      className="px-4 py-2 bg-[#000638] text-white rounded-lg hover:bg-[#fe0000] disabled:opacity-50"
                    >
                      {loadingMore ? 'Carregando...' : 'Carregar mais'}
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Modal para gráfico ampliado */}
            {modalGrafico && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
                onClick={() => setModalGrafico(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl p-8 max-w-6xl w-full flex flex-col items-center relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setModalGrafico(null)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-red-600 text-2xl font-bold"
                    aria-label="Fechar"
                  >
                    &times;
                  </button>
                  <div className="mb-4 flex items-center gap-2">
                    {modalGrafico.type === 'line' && (
                      <ChartLineUp size={28} className="text-[#000638]" />
                    )}
                    {modalGrafico.type === 'pie' && (
                      <Buildings size={28} className="text-[#000638]" />
                    )}
                    {modalGrafico.type === 'bar' && (
                      <Receipt size={28} className="text-[#000638]" />
                    )}
                    <span className="text-2xl font-bold text-[#000638]">
                      {modalGrafico.title}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">
                    {modalGrafico.description}
                  </p>
                  <div
                    className="w-full flex items-center justify-center"
                    style={{ height: '500px' }}
                  >
                    {modalGrafico.type === 'line' && (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={modalGrafico.data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="data" />
                          <YAxis
                            tickFormatter={(value) =>
                              `R$ ${(value / 1000).toFixed(0)}k`
                            }
                          />
                          <Tooltip
                            formatter={(value, name) => [
                              formatCurrency(value),
                              name,
                            ]}
                            labelFormatter={(label) => `Data: ${label}`}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="vouchers"
                            stroke="#10B981"
                            strokeWidth={3}
                            name="Vouchers Gerados"
                            dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="transacoesBruto"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            name="Valor Transações (Bruto)"
                            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="desconto"
                            stroke="#F59E0B"
                            strokeWidth={3}
                            name="Desconto Aplicado"
                            dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}

                    {modalGrafico.type === 'pie' && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={modalGrafico.data.slice(0, 8)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ nome_empresa, percent }) =>
                              `${nome_empresa}: ${(percent * 100).toFixed(1)}%`
                            }
                            outerRadius={150}
                            fill="#8884d8"
                            dataKey="vouchers"
                          >
                            {modalGrafico.data
                              .slice(0, 8)
                              .map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name, props) => [
                              formatCurrency(value),
                              props.payload.nome_empresa,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}

                    {modalGrafico.type === 'bar' && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={modalGrafico.data.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="nome_empresa" />
                          <YAxis
                            tickFormatter={(value) =>
                              `R$ ${(value / 1000).toFixed(0)}k`
                            }
                          />
                          <Tooltip
                            formatter={(value, name) => {
                              if (name === 'Clientes') {
                                return [value.toLocaleString(), 'Clientes'];
                              }
                              return [formatCurrency(value), name];
                            }}
                            labelFormatter={(label) => label}
                          />
                          <Legend />
                          <Bar
                            dataKey="vouchers"
                            fill="#10B981"
                            name="Vouchers Gerados"
                          />
                          <Bar
                            dataKey="transacoesBruto"
                            fill="#3B82F6"
                            name="Valor Transações (Bruto)"
                          />
                          <Bar
                            dataKey="desconto"
                            fill="#F59E0B"
                            name="Desconto"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}

                    {modalGrafico.type === 'barAbove35' && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={modalGrafico.data.slice(0, 20)}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            tickFormatter={(value) =>
                              `R$ ${(value / 1000).toFixed(0)}k`
                            }
                          />
                          <YAxis
                            type="category"
                            dataKey="nome_loja_label"
                            width={300}
                          />
                          <Tooltip
                            formatter={(value, name) => [
                              formatCurrency(value),
                              name,
                            ]}
                            labelFormatter={(label) => label}
                          />
                          <Legend />
                          <Bar
                            dataKey="descontoTotal"
                            fill="#F59E0B"
                            name="Desconto Total"
                          />
                          <Bar
                            dataKey="valorTransacoes"
                            fill="#3B82F6"
                            name="Valor Transações"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}

                    {modalGrafico.type === 'barVendedorGeral' && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={modalGrafico.data.slice(0, 20)}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            tickFormatter={(value) =>
                              `R$ ${(value / 1000).toFixed(0)}k`
                            }
                          />
                          <YAxis
                            type="category"
                            dataKey="nome_vendedor_label"
                            width={300}
                          />
                          <Tooltip
                            formatter={(value, name) => [
                              formatCurrency(value),
                              name,
                            ]}
                            labelFormatter={(label) => label}
                          />
                          <Legend />
                          <Bar
                            dataKey="valorTransacoes"
                            fill="#3B82F6"
                            name="Valor Transações"
                          />
                          <Bar
                            dataKey="descontoTotal"
                            fill="#F59E0B"
                            name="Desconto Total"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}

                    {modalGrafico.type === 'barVendedorAbove35' && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={modalGrafico.data.slice(0, 20)}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            tickFormatter={(value) =>
                              `R$ ${(value / 1000).toFixed(0)}k`
                            }
                          />
                          <YAxis
                            type="category"
                            dataKey="nome_vendedor_label"
                            width={300}
                          />
                          <Tooltip
                            formatter={(value, name) => [
                              formatCurrency(value),
                              name,
                            ]}
                            labelFormatter={(label) => label}
                          />
                          <Legend />
                          <Bar
                            dataKey="descontoTotal"
                            fill="#F59E0B"
                            name="Desconto Total"
                          />
                          <Bar
                            dataKey="valorTransacoes"
                            fill="#3B82F6"
                            name="Valor Transações"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AnaliseCashback;
