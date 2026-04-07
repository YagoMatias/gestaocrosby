import React, { useState, useCallback, useEffect } from 'react';
import useApiClient from '../hooks/useApiClient';
import FiltroEmpresa from '../components/FiltroEmpresa';
import PageTitle from '../components/ui/PageTitle';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/cards';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Ticket, MagnifyingGlass, DownloadSimple, CircleNotch, Receipt } from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import ModalDetalharTransacao from '../components/ModalDetalharTransacao';
import { useTransacoesOperacao } from '../hooks/useTransacoesOperacao';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'InProgress', label: 'Em andamento' },
  { value: 'Closed', label: 'Encerrado' },
  { value: 'Canceled', label: 'Cancelado' },
];

const STATUS_COLORS = {
  'Em andamento': 'bg-green-100 text-green-800',
  'Encerrado': 'bg-blue-100 text-blue-800',
  'Cancelado': 'bg-red-100 text-red-800',
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  // Extrair ano/mês/dia direto da string para evitar problemas de timezone UTC
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
};

const VoucherUsage = () => {
  const { apiCall } = useApiClient();
  // Hook para modal de detalhes de transação
  const {
    detalharTransacao,
    fecharDetalhes,
    detalhesAberto,
    detalhesLoading,
    detalhesItens,
    detalhesErro,
  } = useTransacoesOperacao({
    transacoesPorNr: async (params) => {
      // Adapte para sua API se necessário
      const result = await apiCall('/api/sales/transacoes-por-nr', params);
      return result;
    },
  });

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [statusVoucher, setStatusVoucher] = useState('');

  const [dados, setDados] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [sortDesconto, setSortDesconto] = useState(null); // null | 'asc' | 'desc'

  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const fmt = (d) => d.toISOString().split('T')[0];
    setDataInicio(fmt(primeiroDia));
    setDataFim(fmt(ultimoDia));
  }, []);

  const buscar = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    setLoading(true);
    setErro(null);

    try {
      const params = {
        startDateInitial: dataInicio,
        startDateFinal: dataFim,
        enrich: 'true',
      };
      if (statusVoucher) params.status = statusVoucher;

      const branchCodes = empresasSelecionadas.map(emp => Number(emp.cd_empresa));

      if (branchCodes.length > 0) {
        let allData = [];
        let totalSummary = { total: 0, totalValue: 0, statusCounts: {}, queryTime: 0 };

        for (const code of branchCodes) {
          const result = await apiCall('/api/totvs/vouchers/search', { ...params, branchCode: code });
          if (result?.success) {
            // apiCall normaliza: result.data = array, summary em result.metadata.data.summary
            const dataArray = Array.isArray(result.data) ? result.data : [];
            const summary = result.metadata?.data?.summary || {};
            allData = allData.concat(dataArray);
            totalSummary.total += summary.total || dataArray.length;
            totalSummary.totalValue += summary.totalValue || 0;
            totalSummary.queryTime = Math.max(totalSummary.queryTime, summary.queryTime || 0);
            for (const [key, val] of Object.entries(summary.statusCounts || {})) {
              totalSummary.statusCounts[key] = (totalSummary.statusCounts[key] || 0) + val;
            }
          }
        }
        setDados(allData);
        setSummary(totalSummary);
      } else {
        const result = await apiCall('/api/totvs/vouchers/search', params);
        if (result?.success) {
          // apiCall normaliza: result.data = array, summary em result.metadata.data.summary
          const dataArray = Array.isArray(result.data) ? result.data : [];
          const summary = result.metadata?.data?.summary || null;
          setDados(dataArray);
          setSummary(summary);
        } else {
          setErro(result?.message || 'Erro ao buscar dados');
          setDados([]);
          setSummary(null);
        }
      }
    } catch (err) {
      setErro(err.message || 'Erro ao buscar dados');
      setDados([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, empresasSelecionadas, statusVoucher, apiCall]);

  const exportarExcel = () => {
    if (dados.length === 0) return;
    const rows = dados.map((d) => ({
      'Voucher': d.voucherNumber,
      'Status': d.statusLabel,
      'Cliente': d.customerCode,
      'Nome': d.customerName || '',
      'Valor': d.value,
      'Data Início': formatDate(d.startDate),
      'Data Fim': formatDate(d.endDate),
      'Filial': d.branchCode,
      'Transação': d.lastPurchase?.transactionCode || '',
      'Data Compra': d.lastPurchase ? formatDate(d.lastPurchase.transactionDate) : '',
      'Desconto %': d.lastPurchase?.discountPercentage || '',
      'Desconto R$': d.lastPurchase?.discountValue || '',
      'Valor Compra': d.lastPurchase?.totalValue || '',
      'Valor Bruto': d.lastPurchase ? (d.lastPurchase.totalValueBruto ?? (d.lastPurchase.totalValue || 0) + (d.lastPurchase.discountValue || 0)) : null,
      'Valor com Desconto': d.lastPurchase?.totalValue ?? null,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Vouchers');
    XLSX.writeFile(wb, `vouchers_${dataInicio}_${dataFim}.xlsx`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <PageTitle
        title="Vouchers"
        subtitle="Consulta de vouchers TOTVS por período, empresa e status"
        icon={Ticket}
        iconColor="text-purple-600"
      />

      {/* Filtros */}
      <Card className="shadow-lg rounded-xl bg-white mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MagnifyingGlass size={18} className="text-[#000638]" />
            <CardTitle className="text-sm font-bold text-[#000638]">
              Filtros
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <CardDescription className="text-xs text-gray-500 mb-4">
            Configure os filtros para consulta de vouchers
          </CardDescription>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
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
                value={statusVoucher}
                onChange={(e) => setStatusVoucher(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-transparent select-none">.</label>
              <button
                onClick={buscar}
                disabled={loading || !dataInicio || !dataFim}
                className="flex items-center gap-2 bg-[#000638] text-white px-4 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors w-full justify-center text-sm"
              >
                {loading ? (
                  <>
                    <CircleNotch size={16} className="animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <MagnifyingGlass size={16} />
                    Buscar
                  </>
                )}
              </button>
            </div>
          </div>

          {dados.length > 0 && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={exportarExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium transition-colors text-xs"
              >
                <DownloadSimple size={14} />
                Exportar Excel
              </button>
            </div>
          )}

        </CardContent>
      </Card>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{erro}</div>
      )}

      {/* Cards de Resumo */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-700">
                  Total Vouchers
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-blue-600 mb-0.5">
                {summary.total}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Vouchers encontrados
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-green-600" />
                <CardTitle className="text-sm font-bold text-green-700">
                  Valor Total
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-green-600 mb-0.5">
                {formatCurrency(summary.totalValue)}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Soma dos valores dos vouchers
              </CardDescription>
            </CardContent>
          </Card>

          {Object.entries(summary.statusCounts || {}).map(([label, count]) => (
            <Card key={label} className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-orange-600" />
                  <CardTitle className="text-sm font-bold text-orange-700">
                    {label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-base font-extrabold text-orange-600 mb-0.5">
                  {count}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Vouchers com status {label.toLowerCase()}
                </CardDescription>
              </CardContent>
            </Card>
          ))}

          <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-purple-600" />
                <CardTitle className="text-sm font-bold text-purple-700">
                  Valor Total Transações
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="text-base font-extrabold text-purple-600 mb-0.5">
                {formatCurrency(dados.reduce((sum, v) => sum + (v.lastPurchase?.totalValue || 0), 0))}
              </div>
              <CardDescription className="text-xs text-gray-500">
                Soma das transações com voucher
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela */}
      <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Ticket size={18} className="text-[#000638]" />
            <CardTitle className="text-sm font-bold text-[#000638]">
              Lista de Vouchers
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <CardDescription className="text-xs text-gray-500 mb-4">
            Detalhes de todos os vouchers encontrados
          </CardDescription>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" text="Carregando vouchers..." />
            </div>
          ) : dados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Ticket size={48} className="mb-3" />
              <p className="text-lg font-medium">
                {summary === null
                  ? 'Selecione o período e clique em Buscar'
                  : 'Nenhum voucher encontrado'}
              </p>
              <p className="text-sm mt-1">
                Busca vouchers na API TOTVS por período, empresa e status
              </p>
            </div>
          ) : (() => {
            const dadosOrdenados = sortDesconto
              ? [...dados].sort((a, b) => {
                  const pctA = a.lastPurchase?.discountPercentage ?? -1;
                  const pctB = b.lastPurchase?.discountPercentage ?? -1;
                  return sortDesconto === 'desc' ? pctB - pctA : pctA - pctB;
                })
              : dados;
            return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Voucher</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Filial</th>
                    <th className="px-4 py-3">Data Início</th>
                    <th className="px-4 py-3">Data Fim</th>
                    <th className="px-4 py-3">Transação</th>
                    <th className="px-4 py-3">Valor Bruto</th>
                    <th className="px-4 py-3">Valor com Desconto</th>
                    <th
                      className="px-4 py-3 cursor-pointer select-none hover:bg-gray-100 transition-colors"
                      onClick={() => setSortDesconto(s => s === 'desc' ? 'asc' : 'desc')}
                    >
                      <span className="flex items-center gap-1">
                        Desconto
                        <span className="text-gray-400">
                          {sortDesconto === 'desc' ? '↓' : sortDesconto === 'asc' ? '↑' : '↕'}
                        </span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dadosOrdenados.map((item, idx) => {
                    // Valor bruto: se não existir campo, soma valor final + desconto
                    const valorBruto = item.lastPurchase
                      ? (item.lastPurchase.totalValueBruto ?? (item.lastPurchase.totalValue || 0) + (item.lastPurchase.discountValue || 0))
                      : null;
                    const valorComDesconto = item.lastPurchase?.totalValue ?? null;
                    return (
                    <tr
                      key={`${item.voucherNumber}-${idx}`}
                      className="bg-white border-b hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded">
                          {item.voucherNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[item.statusLabel] || 'bg-gray-100 text-gray-600'}`}>
                          {item.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div>{item.customerName || '—'}</div>
                        <div className="text-xs text-gray-400">{item.customerCode || '—'}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        {formatCurrency(item.value)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-1 rounded">
                          {item.branchCode || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatDate(item.startDate)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatDate(item.endDate)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {item.lastPurchase ? (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                            {item.lastPurchase.transactionCode}
                          </span>
                        ) : item.statusLabel === 'Encerrado' ? (
                          <span className="text-xs text-gray-400">Não encontrada</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {valorBruto !== null ? formatCurrency(valorBruto) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {valorComDesconto !== null ? formatCurrency(valorComDesconto) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {item.lastPurchase ? (
                          <div>
                            <div className="text-red-600 font-semibold">{formatCurrency(item.lastPurchase.discountValue)}</div>
                            <div
                              className={`text-xs font-medium px-1.5 py-0.5 rounded inline-block ${
                                item.lastPurchase.discountPercentage > 20
                                  ? 'bg-red-100 text-red-700 border border-red-300 animate-pulse'
                                  : 'bg-green-100 text-green-700 border border-green-300'
                              }`}
                            >
                              {item.lastPurchase.discountPercentage.toFixed(2)}%
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

export default VoucherUsage;
