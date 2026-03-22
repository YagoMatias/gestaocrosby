import React, { useState, useMemo, useEffect } from 'react';
import useApiClient from '../hooks/useApiClient';
import { useAuth } from '../components/AuthContext';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '../components/ui/cards';
import {
  Spinner,
  MagnifyingGlass,
  ChartBar,
  CaretDown,
  CaretUp,
  Buildings,
  X,
  CurrencyDollar,
  Trophy,
  ShoppingCart,
  Tote,
  Funnel,
} from '@phosphor-icons/react';

// ==========================================
// HELPERS
// ==========================================
const formatBRL = (value) =>
  typeof value === 'number'
    ? value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '-';

const formatDateBR = (isoDate) => {
  if (!isoDate) return '--';
  try {
    const [datePart] = String(isoDate).split('T');
    const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
    if (!y || !m || !d) return '--';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  } catch {
    return '--';
  }
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
const RankingFaturamento = () => {
  const apiClient = useApiClient();
  const { user } = useAuth();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filterType, setFilterType] = useState('todas'); // 'todas' | 'franquia' | 'filial'

  // Modal
  const [modalGroup, setModalGroup] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Mapas de empresas
  const [branchNames, setBranchNames] = useState({});
  const [branchGroupMap, setBranchGroupMap] = useState({});

  const TotvsURL = 'https://apigestaocrosby-bw2v.onrender.com/api/totvs/';

  // ==========================================
  // FETCH: Nomes das empresas
  // ==========================================
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch(`${TotvsURL}branches`);
        if (response.ok) {
          const result = await response.json();
          let empresas = [];
          if (result.success && result.data) {
            empresas = result.data.data || result.data;
            if (!Array.isArray(empresas)) empresas = [];
          }
          const nameMap = {};
          const groupMap = {};
          empresas.forEach((emp) => {
            const code = parseInt(emp.cd_empresa);
            const nome =
              emp.nm_grupoempresa ||
              emp.fantasyName ||
              emp.description ||
              `Empresa ${code}`;
            nameMap[code] = nome;
            groupMap[code] = nome;
          });
          setBranchNames(nameMap);
          setBranchGroupMap(groupMap);
        }
      } catch (err) {
        // silently fail
      }
    };
    fetchBranches();
  }, []);

  // ==========================================
  // FETCH: Buscar invoices
  // ==========================================
  const handleSearch = async () => {
    if (!startDate || !endDate) {
      setError('Informe as datas de início e fim.');
      return;
    }

    setLoading(true);
    setError('');
    setInvoices([]);
    setMeta(null);
    setModalGroup(null);

    try {
      const result = await apiClient.totvs.invoicesSearch({
        startDate,
        endDate,
        invoiceStatusList: ['Normal', 'Issued'],
        operationCodeList: [
          1, 2, 55, 510, 511, 1511, 521, 1521, 522, 960, 9001, 9009, 9027, 9017,
          9400, 9401, 9402, 9403, 9404, 9005, 545, 546, 555, 548, 1210, 9405,
          1205, 1101, 9065, 9064, 9063, 9062, 9061, 9420, 9026,
        ],
      });

      if (result.success) {
        const data = result.data;
        setInvoices(data?.items || []);
        setMeta({
          count: data?.count,
          totalPages: data?.totalPages,
          totalItems: data?.totalItems,
          queryTime: data?.queryTime,
          fromCache: data?.fromCache,
        });
      } else {
        setError(result.message || 'Erro ao buscar invoices.');
      }
    } catch (err) {
      setError(err.message || 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FILTRO: invoiceDate dentro do range exato
  // ==========================================
  const filteredInvoices = useMemo(() => {
    if (!startDate || !endDate || invoices.length === 0) return invoices;
    return invoices.filter((inv) => {
      if (!inv.invoiceDate) return false;
      const d = inv.invoiceDate.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [invoices, startDate, endDate]);

  // ==========================================
  // AGRUPAMENTO: Por GRUPO EMPRESA
  // ==========================================
  const { grouped, grandTotal } = useMemo(() => {
    const map = {};
    let total = {
      totalValue: 0,
      saidaValue: 0,
      entradaValue: 0,
      saidaCount: 0,
      saidaQuantity: 0,
      entradaQuantity: 0,
      count: 0,
    };

    filteredInvoices.forEach((inv) => {
      const code = inv.branchCode ?? 0;
      const grupoKey =
        branchGroupMap[code] || branchNames[code] || `Empresa ${code}`;

      if (!map[grupoKey]) {
        map[grupoKey] = {
          grupoKey,
          branchName: grupoKey,
          branchCodes: new Set(),
          items: [],
          totalValue: 0,
          saidaValue: 0,
          entradaValue: 0,
          saidaCount: 0,
          saidaQuantity: 0,
          entradaQuantity: 0,
        };
      }

      map[grupoKey].branchCodes.add(code);

      const val = Number(inv.totalValue ?? 0);
      const qty = Number(inv.quantity ?? 0);
      const isEntrada =
        String(inv.operationType || '').toLowerCase() === 'input';

      map[grupoKey].items.push(inv);

      if (isEntrada) {
        map[grupoKey].entradaValue += val;
        map[grupoKey].entradaQuantity += qty;
        total.entradaValue += val;
        total.entradaQuantity += qty;
      } else {
        map[grupoKey].saidaValue += val;
        map[grupoKey].saidaCount += 1;
        map[grupoKey].saidaQuantity += qty;
        total.saidaValue += val;
        total.saidaCount += 1;
        total.saidaQuantity += qty;
      }

      total.count += 1;
    });

    Object.values(map).forEach((g) => {
      g.totalValue = g.saidaValue - g.entradaValue;
      g.branchCodesArr = [...g.branchCodes].sort((a, b) => a - b);
      // Ticket Médio = faturamento (saída - entrada) / vendas (saída)
      g.ticketMedio = g.saidaCount > 0 ? g.totalValue / g.saidaCount : 0;
      // PA = (peças saída - peças entrada) / vendas (saída)
      g.pa =
        g.saidaCount > 0
          ? (g.saidaQuantity - g.entradaQuantity) / g.saidaCount
          : 0;
    });

    total.totalValue = total.saidaValue - total.entradaValue;
    total.ticketMedio =
      total.saidaCount > 0 ? total.totalValue / total.saidaCount : 0;
    total.pa =
      total.saidaCount > 0
        ? (total.saidaQuantity - total.entradaQuantity) / total.saidaCount
        : 0;

    let groups = Object.values(map).sort((a, b) => b.totalValue - a.totalValue);

    return { grouped: groups, grandTotal: total };
  }, [filteredInvoices, branchNames, branchGroupMap]);

  // ==========================================
  // FILTRO: Franquia / Filial
  // ==========================================
  const filteredGrouped = useMemo(() => {
    if (filterType === 'todas') return grouped;
    if (filterType === 'franquia') {
      return grouped.filter((g) =>
        g.branchName.toUpperCase().includes('FRANQUIA'),
      );
    }
    if (filterType === 'filial') {
      return grouped.filter((g) => {
        const name = g.branchName.toUpperCase();
        return name.includes('CROSBY') && !name.includes('FRANQUIA');
      });
    }
    return grouped;
  }, [grouped, filterType]);

  // ==========================================
  // MODAL: Itens ordenados
  // ==========================================
  const modalItems = useMemo(() => {
    if (!modalGroup) return [];
    const items = [...modalGroup.items];
    if (sortConfig.key) {
      items.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number')
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [modalGroup, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const openModal = (group) => {
    // Franquias só podem ver detalhes da própria loja
    if (user?.role === 'franquias' && user?.allowedCompanies) {
      const allowed = user.allowedCompanies.map((c) => Number(c));
      const groupCodes = [...(group.branchCodes || [])];
      const hasAccess = groupCodes.some((code) =>
        allowed.includes(Number(code)),
      );
      if (!hasAccess) return; // Bloqueia abertura do modal
    }
    setSortConfig({ key: null, direction: 'asc' });
    setModalGroup(group);
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey)
      return <CaretDown size={12} className="opacity-30" />;
    return sortConfig.direction === 'asc' ? (
      <CaretUp size={12} className="text-blue-400" />
    ) : (
      <CaretDown size={12} className="text-blue-400" />
    );
  };

  const columns = [
    { key: 'invoiceCode', label: 'Nº NF' },
    { key: 'serialCode', label: 'Série' },
    { key: 'invoiceDate', label: 'Data Emissão' },
    { key: 'personCode', label: 'Cód. Pessoa' },
    { key: 'personName', label: 'Nome Pessoa' },
    { key: 'operationType', label: 'Tipo' },
    { key: 'operatioCode', label: 'Cód. Op.' },
    { key: 'operatioName', label: 'Operação' },
    { key: 'invoiceStatus', label: 'Status' },
    { key: 'totalValue', label: 'Valor Total', numeric: true },
    { key: 'productValue', label: 'Valor Produto', numeric: true },
    { key: 'quantity', label: 'Qtd', numeric: true },
    { key: 'discountPercentage', label: '% Desc', numeric: true },
    { key: 'paymentConditionName', label: 'Cond. Pagamento' },
  ];

  const formatCell = (value, col) => {
    if (value == null || value === '') return '-';
    if (col.numeric && typeof value === 'number') return formatBRL(value);
    if (col.key === 'invoiceDate' && typeof value === 'string')
      return formatDateBR(value);
    return String(value);
  };

  // Ícone de posição: bolinha azul com número branco
  const getPositionBadge = (position) => (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#000638] text-white text-xs font-bold">
      {position + 1}
    </span>
  );

  const top1 = filteredGrouped.length > 0 ? filteredGrouped[0] : null;

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2 sm:px-4 font-barlow">
      {/* Page Title */}
      <PageTitle
        title="Ranking de Faturamento"
        subtitle="Acompanhe o desempenho das lojas em tempo real"
        icon={Trophy}
        iconColor="text-yellow-600"
      />

      {/* Filtros */}
      <div className="flex flex-col bg-white p-3 sm:p-4 rounded-xl shadow-md w-full mx-auto border border-[#000638]/10 mb-4">
        <span className="text-sm sm:text-base font-bold text-[#000638] flex items-center gap-1.5 mb-0.5 font-barlow">
          <Funnel size={16} weight="bold" />
          Filtros
        </span>
        <span className="text-xs text-gray-500 mb-3 font-barlow">
          Selecione o período para gerar o ranking
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638] font-barlow">
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs font-barlow"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638] font-barlow">
              Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs font-barlow"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold shadow-md tracking-wide uppercase w-full sm:w-auto font-barlow"
            >
              {loading ? (
                <Spinner size={14} className="animate-spin" />
              ) : (
                <MagnifyingGlass size={14} weight="bold" />
              )}
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Filtro Franquia / Filial */}
        {grouped.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs font-semibold text-[#000638] mr-1 flex items-center gap-1 font-barlow">
              <Buildings size={14} weight="bold" />
              Tipo:
            </span>
            {[
              { key: 'todas', label: 'Todas' },
              { key: 'filial', label: 'Filial' },
              { key: 'franquia', label: 'Franquia' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilterType(opt.key)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-150 font-barlow ${
                  filterType === opt.key
                    ? 'bg-[#000638] text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs sm:text-sm text-red-700 font-barlow">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-gray-400">
          <Spinner size={36} className="animate-spin mb-3" />
          <p className="text-sm font-medium font-barlow">
            Carregando dados das lojas...
          </p>
          <p className="text-xs text-gray-300 mt-1 font-barlow">
            Isso pode levar alguns segundos
          </p>
        </div>
      )}

      {/* DASHBOARD */}
      {!loading && filteredGrouped.length > 0 && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <CurrencyDollar
                    size={14}
                    weight="bold"
                    className="text-green-600"
                  />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-green-700 font-barlow">
                    Faturamento Total
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-green-600 break-words font-barlow">
                  R$ {formatBRL(grandTotal.totalValue)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  Saída - Entrada
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart
                    size={14}
                    weight="bold"
                    className="text-blue-600"
                  />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-blue-700 font-barlow">
                    Ticket Médio
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-blue-600 break-words font-barlow">
                  R$ {formatBRL(grandTotal.ticketMedio)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  Valor médio por venda
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <Tote size={14} weight="bold" className="text-purple-600" />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-purple-700 font-barlow">
                    PA
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-purple-600 break-words font-barlow">
                  {grandTotal.pa.toFixed(2)}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  Peças por atendimento
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-2.5 px-2.5 sm:px-3">
                <div className="flex items-center gap-1.5">
                  <Buildings
                    size={14}
                    weight="bold"
                    className="text-[#000638]"
                  />
                  <CardTitle className="text-[10px] sm:text-xs font-bold text-[#000638] font-barlow">
                    Lojas
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2.5 sm:px-3 pb-2.5">
                <div className="text-sm sm:text-base font-extrabold text-[#000638] break-words font-barlow">
                  {filteredGrouped.length}
                </div>
                <CardDescription className="text-[10px] sm:text-xs text-gray-500 font-barlow hidden sm:block">
                  {grandTotal.saidaCount} vendas
                  {meta?.queryTime
                    ? ` | ${(meta.queryTime / 1000).toFixed(1)}s`
                    : ''}
                  {meta?.fromCache ? ' (cache)' : ''}
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* TOP 1 — Destaque */}
          {top1 && (
            <div className="relative mb-4 bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 border-2 border-yellow-300 rounded-xl shadow-lg p-3 sm:p-4 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 opacity-5 pointer-events-none">
                <Trophy size={128} weight="fill" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md">
                    <Trophy
                      size={20}
                      weight="fill"
                      className="text-white sm:hidden"
                    />
                    <Trophy
                      size={28}
                      weight="fill"
                      className="text-white hidden sm:block"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded-full font-barlow">
                      TOP 1
                    </span>
                    <h3 className="text-sm sm:text-lg font-bold text-[#000638] truncate mt-0.5 font-barlow">
                      {top1.branchName}
                    </h3>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto">
                  <div className="text-xs text-gray-600 font-barlow">
                    TM:{' '}
                    <strong className="text-blue-700">
                      R$ {formatBRL(top1.ticketMedio)}
                    </strong>
                  </div>
                  <div className="text-xs text-gray-600 font-barlow">
                    PA:{' '}
                    <strong className="text-purple-700">
                      {top1.pa.toFixed(2)}
                    </strong>
                  </div>
                  <div className="text-xs text-gray-600 font-barlow">
                    Vendas:{' '}
                    <strong className="text-gray-700">{top1.saidaCount}</strong>
                  </div>
                  <div className="sm:ml-2">
                    <p className="text-lg sm:text-2xl font-extrabold text-green-700 font-barlow">
                      R$ {formatBRL(top1.totalValue)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RANKING */}
          <div className="bg-white rounded-xl shadow-md border border-[#000638]/10 w-full overflow-hidden">
            {/* Header */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#000638]/10 flex items-center gap-2">
              <ChartBar size={16} weight="bold" className="text-[#000638]" />
              <h2 className="text-xs sm:text-sm font-bold text-[#000638] font-barlow">
                Ranking por Loja
              </h2>
              <span className="ml-auto text-[10px] sm:text-xs text-gray-400 font-barlow hidden sm:inline">
                Clique para ver detalhes
              </span>
            </div>

            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-[#000638] text-white text-[10px] font-bold uppercase tracking-wider font-barlow">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-4">Loja</div>
              <div className="col-span-2 text-right">Faturamento</div>
              <div className="col-span-2 text-right">Ticket Médio</div>
              <div className="col-span-1 text-right">PA</div>
              <div className="col-span-2 text-right">Vendas</div>
            </div>

            {/* Rows */}
            {filteredGrouped.map((group, index) => {
              const isFranchiseUser =
                user?.role === 'franquias' && user?.allowedCompanies;
              const canViewDetails =
                !isFranchiseUser ||
                [...(group.branchCodes || [])].some((code) =>
                  user.allowedCompanies
                    .map((c) => Number(c))
                    .includes(Number(code)),
                );

              return (
                <button
                  key={group.grupoKey}
                  onClick={() => openModal(group)}
                  disabled={!canViewDetails}
                  title={
                    !canViewDetails
                      ? 'Você só pode ver detalhes da sua própria loja'
                      : 'Clique para ver detalhes'
                  }
                  className={`w-full text-left transition-all duration-150 border-b border-gray-100 last:border-b-0 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  } ${canViewDetails ? 'hover:bg-blue-50/60 cursor-pointer' : 'cursor-default opacity-70'}`}
                >
                  {/* Mobile card layout */}
                  <div className="md:hidden p-3 flex items-start gap-2.5">
                    <div className="flex-shrink-0 mt-0.5">
                      {getPositionBadge(index)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-semibold truncate font-barlow ${index < 3 ? 'text-[#000638]' : 'text-gray-700'}`}
                      >
                        {group.branchName}
                      </p>
                      <p
                        className={`text-sm font-bold font-mono mt-0.5 ${group.totalValue >= 0 ? 'text-green-700' : 'text-red-600'}`}
                      >
                        R$ {formatBRL(group.totalValue)}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-500 font-barlow">
                        <span>
                          TM:{' '}
                          <strong className="text-blue-700">
                            R$ {formatBRL(group.ticketMedio)}
                          </strong>
                        </span>
                        <span>
                          PA:{' '}
                          <strong className="text-purple-700">
                            {group.pa.toFixed(1)}
                          </strong>
                        </span>
                        <span>
                          Vendas:{' '}
                          <strong className="text-gray-700">
                            {group.saidaCount}
                          </strong>
                        </span>
                      </div>
                    </div>
                    <CaretDown
                      size={14}
                      className="text-gray-300 flex-shrink-0 mt-1"
                    />
                  </div>

                  {/* Desktop row layout */}
                  <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm">
                    <div className="col-span-1 text-center">
                      {getPositionBadge(index)}
                    </div>
                    <div className="col-span-4 text-left truncate">
                      <span
                        className={`font-semibold font-barlow ${index < 3 ? 'text-[#000638]' : 'text-gray-700'}`}
                      >
                        {group.branchName}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span
                        className={`font-bold font-mono text-xs ${group.totalValue >= 0 ? 'text-green-700' : 'text-red-600'}`}
                      >
                        R$ {formatBRL(group.totalValue)}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-blue-700 font-mono font-medium text-xs">
                        R$ {formatBRL(group.ticketMedio)}
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-purple-700 font-mono font-medium text-xs">
                        {group.pa.toFixed(1)}
                      </span>
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-1">
                      <span className="text-gray-600 font-mono text-xs">
                        {group.saidaCount}
                      </span>
                      <CaretDown size={12} className="text-gray-300" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && invoices.length === 0 && !error && (
        <div className="text-center py-16 sm:py-20 text-gray-400">
          <Trophy
            size={48}
            weight="light"
            className="mx-auto mb-3 opacity-30"
          />
          <p className="text-xs sm:text-sm font-medium font-barlow">
            Selecione o período e clique em Buscar para gerar o ranking.
          </p>
        </div>
      )}

      {/* MODAL */}
      {modalGroup && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setModalGroup(null)}
        >
          <div
            className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-7xl max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-fade-in-scale"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#000638]/10 bg-gray-50 rounded-t-xl gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#000638] flex items-center justify-center flex-shrink-0">
                  <Buildings size={16} className="text-white sm:hidden" />
                  <Buildings size={20} className="text-white hidden sm:block" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm sm:text-lg font-bold text-[#000638] truncate font-barlow">
                    {modalGroup.branchName}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-gray-500 font-barlow">
                    {modalGroup.items.length} nota(s) fiscal(is)
                  </p>
                </div>
                <button
                  onClick={() => setModalGroup(null)}
                  className="sm:hidden p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Mini cards */}
              <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
                <div className="text-center px-2 sm:px-3 flex-shrink-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 font-barlow">
                    Faturamento
                  </p>
                  <p
                    className={`text-xs sm:text-base font-bold font-mono ${modalGroup.totalValue >= 0 ? 'text-green-700' : 'text-red-600'}`}
                  >
                    R$ {formatBRL(modalGroup.totalValue)}
                  </p>
                </div>
                <div className="w-px h-6 sm:h-8 bg-gray-200 flex-shrink-0" />
                <div className="text-center px-2 sm:px-3 flex-shrink-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 font-barlow">
                    Ticket Médio
                  </p>
                  <p className="text-xs sm:text-base font-bold font-mono text-blue-700">
                    R$ {formatBRL(modalGroup.ticketMedio)}
                  </p>
                </div>
                <div className="w-px h-6 sm:h-8 bg-gray-200 flex-shrink-0" />
                <div className="text-center px-2 sm:px-3 flex-shrink-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 font-barlow">
                    PA
                  </p>
                  <p className="text-xs sm:text-base font-bold font-mono text-purple-700">
                    {modalGroup.pa.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => setModalGroup(null)}
                  className="hidden sm:block ml-2 p-2 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Body - Tabela */}
            <div className="overflow-auto flex-1 -webkit-overflow-scrolling-touch">
              <table className="w-full text-xs sm:text-sm min-w-[700px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#000638] text-white">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`px-2 sm:px-3 py-2 sm:py-2.5 text-left font-medium text-[10px] sm:text-xs cursor-pointer hover:bg-[#000638]/80 whitespace-nowrap select-none uppercase tracking-wider font-barlow ${
                          col.numeric ? 'text-right' : ''
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          <SortIcon columnKey={col.key} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modalItems.map((inv, idx) => (
                    <tr
                      key={idx}
                      className={`border-b last:border-b-0 hover:bg-blue-50/40 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap font-barlow ${
                            col.numeric ? 'text-right font-mono' : ''
                          }`}
                        >
                          {formatCell(inv[col.key], col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-green-50 border-t-2 border-green-200 font-semibold text-[10px] sm:text-xs">
                    <td
                      colSpan={9}
                      className="px-2 sm:px-3 py-2.5 sm:py-3 text-right text-[#000638] font-barlow"
                    >
                      Resultado: R$ {formatBRL(modalGroup.totalValue)} | TM: R${' '}
                      {formatBRL(modalGroup.ticketMedio)} | PA:{' '}
                      {modalGroup.pa.toFixed(2)}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankingFaturamento;
