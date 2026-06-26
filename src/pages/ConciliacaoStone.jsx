import React, { useEffect, useState, useMemo, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import { API_BASE_URL } from '../config/constants';
import {
  CreditCard,
  MagnifyingGlass,
  Export,
  Warning,
  Storefront,
  CalendarBlank,
  ArrowsClockwise,
  CaretUp,
  CaretDown,
  Info,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BRAND_COLORS = {
  Visa: 'bg-blue-100 text-blue-800 border-blue-300',
  Mastercard: 'bg-orange-100 text-orange-800 border-orange-300',
  Elo: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Amex: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  Hipercard: 'bg-red-100 text-red-800 border-red-300',
};

const fmt = (v) =>
  v != null
    ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

// Default: últimos 7 dias
const hojeISO = () => new Date().toISOString().slice(0, 10);
const diasAtrasISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const ConciliacaoStone = () => {
  const [lojas, setLojas] = useState([]);
  const [stonecode, setStonecode] = useState('');
  const [inicio, setInicio] = useState(diasAtrasISO(7));
  const [fim, setFim] = useState(hojeISO());

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'dataCaptura', direction: 'desc' });

  // Carrega lojas configuradas
  useEffect(() => {
    const carregar = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/conciliacao-stone/lojas`);
        const j = await r.json();
        const lista = j?.data || [];
        setLojas(lista);
        if (lista.length) setStonecode(lista[0].stonecode);
      } catch (e) {
        console.error('Erro ao carregar lojas Stone:', e);
      }
    };
    carregar();
  }, []);

  const consultar = useCallback(async () => {
    if (!stonecode) {
      setErro('Selecione uma loja.');
      return;
    }
    if (inicio > fim) {
      setErro('A data inicial não pode ser maior que a final.');
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ stonecode, inicio, fim });
      const r = await fetch(
        `${API_BASE_URL}/api/conciliacao-stone/conciliacao?${params}`,
      );
      const j = await r.json();
      if (!j?.success) throw new Error(j?.message || 'Falha na consulta.');
      setResultado(j.data);
    } catch (e) {
      console.error('Erro na conciliação:', e);
      setErro(e.message || 'Erro ao consultar conciliação.');
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }, [stonecode, inicio, fim]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const transacoesOrdenadas = useMemo(() => {
    const arr = [...(resultado?.transacoes || [])];
    arr.sort((a, b) => {
      const va = a[sortConfig.key];
      const vb = b[sortConfig.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return sortConfig.direction === 'asc' ? -1 : 1;
      if (va > vb) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [resultado, sortConfig]);

  const resumo = resultado?.resumo;

  const exportarExcel = () => {
    if (!resultado?.transacoes?.length) return;
    const rows = resultado.transacoes.map((t) => ({
      Data: t.dataArquivo,
      'Captura': t.dataCaptura,
      NSU: t.nsu,
      Bandeira: t.bandeira,
      Tipo: t.tipoConta,
      Entrada: t.formaEntrada,
      Cartão: t.cartao,
      'Cód. Aut.': t.codAutorizacao,
      Parcelas: t.parcelas,
      'Valor Bruto': t.valorBruto,
      'Valor Líquido': t.valorLiquido,
      Taxa: t.taxa,
      'Serial POS': t.serialPos,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Conciliação Stone');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `conciliacao_stone_${inicio}_${fim}.xlsx`);
  };

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return null;
    return sortConfig.direction === 'asc' ? (
      <CaretUp size={12} weight="bold" />
    ) : (
      <CaretDown size={12} weight="bold" />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4 md:p-6 pb-24 md:pb-6">
      <PageTitle title="Conciliação Stone" icon={CreditCard} />

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4 mb-4">
        <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-end md:gap-3">
          <div className="flex-1 min-w-0 md:min-w-[220px]">
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              <Storefront size={13} /> Loja (CNPJ)
            </label>
            <select
              value={stonecode}
              onChange={(e) => setStonecode(e.target.value)}
              className="w-full px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              {lojas.length === 0 && <option value="">Carregando…</option>}
              {lojas.map((l) => (
                <option key={l.stonecode} value={l.stonecode}>
                  {l.nome} — {l.cnpjFmt}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 md:contents">
            <div className="md:w-auto">
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <CalendarBlank size={13} /> Início
              </label>
              <input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="w-full px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:w-auto">
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <CalendarBlank size={13} /> Fim
              </label>
              <input
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="w-full px-3 py-2.5 md:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
            <button
              onClick={consultar}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 md:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? (
                <ArrowsClockwise size={16} className="animate-spin" />
              ) : (
                <MagnifyingGlass size={16} weight="bold" />
              )}
              Consultar
            </button>
            <button
              onClick={exportarExcel}
              disabled={!resultado?.transacoes?.length}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 md:py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50"
            >
              <Export size={16} /> Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Aviso de escopo da conciliação */}
      <div className="flex items-start gap-2 px-3.5 py-2.5 mb-4 bg-blue-50 border border-blue-200 rounded-lg text-xs md:text-sm text-blue-800">
        <Info size={18} className="shrink-0 mt-0.5" />
        <span>
          A conciliação Stone traz apenas <strong>vendas de maquininha</strong>{' '}
          (crédito, débito e voucher). <strong>PIX e link de pagamento</strong> são
          gerados em um arquivo separado pela Stone e não aparecem aqui. O arquivo é
          diário — se um dia não teve vendas, ele volta vazio.
        </span>
      </div>

      {erro && (
        <div className="flex items-start gap-2 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {/* Cards Resumo */}
      {resumo && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4 mb-4 md:mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Transações</p>
            <p className="text-base md:text-xl font-bold text-gray-900 mt-0.5">{resumo.qtdTransacoes}</p>
            <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">{resumo.diasConsultados} dia(s)</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Total Bruto</p>
            <p className="text-base md:text-xl font-bold text-gray-900 mt-0.5">{fmt(resumo.totalBruto)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Total Líquido</p>
            <p className="text-base md:text-xl font-bold text-green-600 mt-0.5">{fmt(resumo.totalLiquido)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
            <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Total Taxas</p>
            <p className="text-base md:text-xl font-bold text-orange-600 mt-0.5">{fmt(resumo.totalTaxa)}</p>
            <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">
              {resumo.totalBruto > 0
                ? ((resumo.totalTaxa / resumo.totalBruto) * 100).toFixed(2) + '% médio'
                : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Avisos de dias com erro */}
      {resultado?.erros?.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2.5 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <Warning size={16} className="shrink-0 mt-0.5" />
          <span>
            {resultado.erros.length} dia(s) não retornaram arquivo:{' '}
            {resultado.erros.map((e) => e.data).join(', ')}
          </span>
        </div>
      )}

      {/* Desktop: Tabela */}
      {resultado && (
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { key: 'dataArquivo', label: 'Data' },
                    { key: 'dataCaptura', label: 'Captura' },
                    { key: 'nsu', label: 'NSU' },
                    { key: 'bandeira', label: 'Bandeira' },
                    { key: 'tipoConta', label: 'Tipo' },
                    { key: 'formaEntrada', label: 'Entrada' },
                    { key: 'cartao', label: 'Cartão' },
                    { key: 'parcelas', label: 'Parc.' },
                    { key: 'valorBruto', label: 'Bruto' },
                    { key: 'valorLiquido', label: 'Líquido' },
                    { key: 'taxa', label: 'Taxa' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1">
                        {col.label} <SortIcon col={col.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transacoesOrdenadas.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-gray-400">
                      Nenhuma venda de cartão neste período para esta loja.
                    </td>
                  </tr>
                ) : (
                  transacoesOrdenadas.map((t, i) => (
                    <tr key={`${t.nsu}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">{t.dataArquivo}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">{t.dataCaptura}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono">{t.nsu}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${BRAND_COLORS[t.bandeira] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                          {t.bandeira}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">{t.tipoConta}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">{t.formaEntrada}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono">{t.cartao}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-center">{t.parcelas}x</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-right">{fmt(t.valorBruto)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-right text-green-700">{fmt(t.valorLiquido)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-right text-orange-600">{fmt(t.taxa)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
            {transacoesOrdenadas.length} transações · {resultado.loja?.nome}
          </div>
        </div>
      )}

      {/* Mobile: Cards */}
      {resultado && (
        <div className="md:hidden space-y-2.5">
          {transacoesOrdenadas.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm px-6">
              Nenhuma venda de cartão neste período para esta loja.
            </div>
          ) : (
            <>
              {transacoesOrdenadas.map((t, i) => (
                <div key={`${t.nsu}-${i}`} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${BRAND_COLORS[t.bandeira] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                          {t.bandeira}
                        </span>
                        <span className="text-[11px] text-gray-500">{t.tipoConta} · {t.parcelas}x</span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono mt-1">{t.cartao}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{fmt(t.valorBruto)}</p>
                      <p className="text-[11px] text-green-700 font-semibold">{fmt(t.valorLiquido)} líq.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-2 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Captura:</span>
                      <span className="text-gray-700">{t.dataCaptura?.slice(0, 16)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Taxa:</span>
                      <span className="text-orange-600">{fmt(t.taxa)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Entrada:</span>
                      <span className="text-gray-700">{t.formaEntrada}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">NSU:</span>
                      <span className="text-gray-700 font-mono truncate ml-1">{t.nsu}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-center text-xs text-gray-400 py-2">
                {transacoesOrdenadas.length} transações · {resultado.loja?.nome}
              </div>
            </>
          )}
        </div>
      )}

      {/* Estado inicial */}
      {!resultado && !loading && !erro && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          <CreditCard size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Selecione a loja e o período e clique em <strong>Consultar</strong>.</p>
        </div>
      )}
    </div>
  );
};

export default ConciliacaoStone;
