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
        console.error('Erro ao carregar nomes das empresas:', err);
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
      console.error('Erro ao buscar invoices:', err);
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
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      {/* Page Title */}
      <PageTitle
        title="Ranking de Faturamento"
        subtitle="Acompanhe o desempenho das lojas em tempo real"
        icon={Trophy}
        iconColor="text-yellow-600"
      />

      {/* Filtros */}
      <div className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full mx-auto border border-[#000638]/10 mb-4">
        <span className="text-lg font-bold text-[#000638] flex items-center gap-1 mb-1">
          <Funnel size={18} weight="bold" />
          Filtros
        </span>
        <span className="text-xs text-gray-500 mb-3">
          Selecione o período para gerar o ranking
        </span>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 bg-[#000638] text-white px-4 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-bold shadow-md tracking-wide uppercase h-7"
          >
            {loading ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <MagnifyingGlass size={14} weight="bold" />
            )}
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {/* Filtro Franquia / Filial */}
        {grouped.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs font-semibold text-[#000638] mr-1">
              <Buildings size={14} weight="bold" className="inline mr-1" />
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
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-150 ${
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Spinner size={40} className="animate-spin mb-3" />
          <p className="text-sm font-medium">Carregando dados das lojas...</p>
          <p className="text-xs text-gray-300 mt-1">
            Isso pode levar alguns segundos
          </p>
        </div>
      )}

      {/* ==========================================
          DASHBOARD: Cards de Resumo + Top 1
          ========================================== */}
      {!loading && filteredGrouped.length > 0 && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            {/* Card: Faturamento Total */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <CurrencyDollar
                    size={16}
                    weight="bold"
                    className="text-green-600"
                  />
                  <CardTitle className="text-xs font-bold text-green-700">
                    Faturamento Total
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-base font-extrabold text-green-600 break-words">
                  R$ {formatBRL(grandTotal.totalValue)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Resultado (Saída - Entrada)
                </CardDescription>
              </CardContent>
            </Card>

            {/* Card: Ticket Médio Geral */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart
                    size={16}
                    weight="bold"
                    className="text-blue-600"
                  />
                  <CardTitle className="text-xs font-bold text-blue-700">
                    Ticket Médio
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-base font-extrabold text-blue-600 break-words">
                  R$ {formatBRL(grandTotal.ticketMedio)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Valor médio das vendas
                </CardDescription>
              </CardContent>
            </Card>

            {/* Card: PA Geral */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <Tote size={16} weight="bold" className="text-purple-600" />
                  <CardTitle className="text-xs font-bold text-purple-700">
                    PA (Peças/Atendimento)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-base font-extrabold text-purple-600 break-words">
                  {grandTotal.pa.toFixed(2)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Média geral de peças por venda
                </CardDescription>
              </CardContent>
            </Card>

            {/* Card: Lojas */}
            <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-1 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <Buildings
                    size={16}
                    weight="bold"
                    className="text-[#000638]"
                  />
                  <CardTitle className="text-xs font-bold text-[#000638]">
                    Lojas
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <div className="text-base font-extrabold text-[#000638] break-words">
                  {filteredGrouped.length}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  {grandTotal.saidaCount} vendas |{' '}
                  {meta?.queryTime
                    ? `${(meta.queryTime / 1000).toFixed(1)}s`
                    : ''}
                  {meta?.fromCache ? ' (cache)' : ''}
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* TOP 1 — Destaque */}
          {top1 && (
            <div className="relative mb-4 bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 border-2 border-yellow-300 rounded-xl shadow-lg p-4 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none">
                <Trophy size={128} weight="fill" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md">
                  <Trophy size={28} weight="fill" className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded-full">
                      TOP 1
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#000638] truncate">
                    {top1.branchName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-600">
                    <span>
                      Ticket Médio:{' '}
                      <strong className="text-blue-700">
                        R$ {formatBRL(top1.ticketMedio)}
                      </strong>
                    </span>
                    <span>
                      PA:{' '}
                      <strong className="text-purple-700">
                        {top1.pa.toFixed(2)}
                      </strong>
                    </span>
                    <span>
                      Vendas:{' '}
                      <strong className="text-gray-700">
                        {top1.saidaCount}
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-2xl font-extrabold text-green-700">
                    R$ {formatBRL(top1.totalValue)}
                  </p>
                  <p className="text-xs text-gray-500">Faturamento líquido</p>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              RANKING: Lista de lojas
              ========================================== */}
          <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 w-full overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#000638]/10 flex items-center gap-2">
              <ChartBar size={18} weight="bold" className="text-[#000638]" />
              <h2 className="text-sm font-bold text-[#000638]">
                Ranking por Loja
              </h2>
              <span className="ml-auto text-xs text-gray-400">
                Clique para ver detalhes
              </span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[#000638] text-white text-xs font-bold uppercase tracking-wider">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-4">Loja</div>
              <div className="col-span-2 text-right">Faturamento</div>
              <div className="col-span-2 text-right">Ticket Médio</div>
              <div className="col-span-1 text-right">PA</div>
              <div className="col-span-2 text-right">Vendas</div>
            </div>

            {/* Rows */}
            {filteredGrouped.map((group, index) => {
              // Verificar se franquia tem acesso a esta loja
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
                  className={`w-full grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm transition-all duration-150 border-b border-gray-100 last:border-b-0 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  } ${canViewDetails ? 'hover:bg-blue-50 cursor-pointer' : 'cursor-default opacity-70'}`}
                >
                  {/* # Posição */}
                  <div className="col-span-1 text-center">
                    {getPositionBadge(index)}
                  </div>

                  {/* Loja */}
                  <div className="col-span-4 text-left truncate">
                    <span
                      className={`font-semibold ${index < 3 ? 'text-[#000638]' : 'text-gray-700'}`}
                    >
                      {group.branchName}
                    </span>
                  </div>

                  {/* Faturamento */}
                  <div className="col-span-2 text-right">
                    <span
                      className={`font-bold font-mono ${
                        group.totalValue >= 0
                          ? 'text-green-700'
                          : 'text-red-600'
                      }`}
                    >
                      R$ {formatBRL(group.totalValue)}
                    </span>
                  </div>

                  {/* Ticket Médio */}
                  <div className="col-span-2 text-right">
                    <span className="text-blue-700 font-mono font-medium">
                      R$ {formatBRL(group.ticketMedio)}
                    </span>
                  </div>

                  {/* PA */}
                  <div className="col-span-1 text-right">
                    <span className="text-purple-700 font-mono font-medium">
                      {group.pa.toFixed(1)}
                    </span>
                  </div>

                  {/* Vendas */}
                  <div className="col-span-2 text-right flex items-center justify-end gap-1">
                    <span className="text-gray-600 font-mono">
                      {group.saidaCount}
                    </span>
                    <CaretDown
                      size={12}
                      className="text-gray-300 group-hover:text-blue-500 transition-colors"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && invoices.length === 0 && !error && (
        <div className="text-center py-20 text-gray-400">
          <Trophy
            size={56}
            weight="light"
            className="mx-auto mb-3 opacity-30"
          />
          <p className="text-sm font-medium">
            Selecione o período e clique em Buscar para gerar o ranking.
          </p>
        </div>
      )}

      {/* ==========================================
          MODAL: Detalhes da Loja
          ========================================== */}
      {modalGroup && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalGroup(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#000638]/10 bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#000638] flex items-center justify-center">
                  <Buildings size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#000638]">
                    {modalGroup.branchName}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {modalGroup.items.length} nota(s) fiscal(is)
                  </p>
                </div>
              </div>

              {/* Mini cards no header do modal */}
              <div className="flex items-center gap-4">
                <div className="text-center px-3">
                  <p className="text-xs text-gray-500">Faturamento</p>
                  <p
                    className={`text-base font-bold font-mono ${modalGroup.totalValue >= 0 ? 'text-green-700' : 'text-red-600'}`}
                  >
                    R$ {formatBRL(modalGroup.totalValue)}
                  </p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center px-3">
                  <p className="text-xs text-gray-500">Ticket Médio</p>
                  <p className="text-base font-bold font-mono text-blue-700">
                    R$ {formatBRL(modalGroup.ticketMedio)}
                  </p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center px-3">
                  <p className="text-xs text-gray-500">PA</p>
                  <p className="text-base font-bold font-mono text-purple-700">
                    {modalGroup.pa.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => setModalGroup(null)}
                  className="ml-2 p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Body - Tabela */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-[#000638] text-white">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`px-3 py-2.5 text-left font-medium text-xs cursor-pointer hover:bg-[#000638]/80 whitespace-nowrap select-none uppercase tracking-wider ${
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
                          className={`px-3 py-2 whitespace-nowrap ${
                            col.numeric ? 'text-right font-mono' : ''
                          }`}
                        >
                          {formatCell(inv[col.key], col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {/* Footer summary */}
                <tfoot>
                  <tr className="bg-green-50 border-t-2 border-green-200 font-semibold text-xs">
                    <td
                      colSpan={9}
                      className="px-3 py-3 text-right text-[#000638]"
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
