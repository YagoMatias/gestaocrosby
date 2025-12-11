import React, { useEffect, useState, useMemo } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import {
  FileText,
  Spinner,
  CaretLeft,
  CaretRight,
  FunnelSimple,
} from '@phosphor-icons/react';

const PAGE_SIZE = 50;

// Contas disponíveis para filtro
const CONTAS_DISPONIVEIS = [
  { value: '3', label: 'Conta 3' },
  { value: '4', label: 'Conta 4' },
  { value: '7', label: 'Conta 7' },
  { value: '12', label: 'Conta 12' },
  { value: '14', label: 'Conta 14' },
  { value: '15', label: 'Conta 15' },
  { value: '49', label: 'Conta 49' },
  { value: '109', label: 'Conta 109' },
  { value: '258', label: 'Conta 258' },
  { value: '271', label: 'Conta 271' },
  { value: '334442', label: 'Conta 334442' },
  { value: '448', label: 'Conta 448' },
  { value: '526', label: 'Conta 526' },
  { value: '528', label: 'Conta 528' },
  { value: '594', label: 'Conta 594' },
  { value: '595', label: 'Conta 595' },
  { value: '597', label: 'Conta 597' },
  { value: '789', label: 'Conta 789' },
  { value: '850', label: 'Conta 850' },
  { value: '890', label: 'Conta 890' },
  { value: '891', label: 'Conta 891' },
  { value: '959', label: 'Conta 959' },
  { value: '980', label: 'Conta 980' },
  { value: '998', label: 'Conta 998' },
];

const AuditoriaConta = () => {
  const apiClient = useApiClient();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filtros
  const [filtros, setFiltros] = useState({
    nr_ctapes: '',
    dt_movim_ini: '',
    dt_movim_fim: '',
  });
  const [mostrarFiltros, setMostrarFiltros] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.financial.auditoriaConta();
      if (response.success) {
        setData(response.data || []);
      } else {
        throw new Error(response.message || 'Erro ao buscar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Erro ao carregar dados de auditoria de conta');
    } finally {
      setLoading(false);
    }
  };

  // Paginação
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;

  // Filtrar dados
  const dadosFiltrados = useMemo(() => {
    let resultado = [...data];

    // Filtro por contas (campo de texto)
    if (filtros.nr_ctapes.trim()) {
      const contasBuscadas = filtros.nr_ctapes
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c);

      resultado = resultado.filter((item) =>
        contasBuscadas.some((conta) => String(item.nr_ctapes).includes(conta)),
      );
    }

    // Filtro por data inicial
    if (filtros.dt_movim_ini) {
      const dataInicial = new Date(filtros.dt_movim_ini);
      resultado = resultado.filter((item) => {
        const dataMovim = new Date(item.dt_movim);
        return dataMovim >= dataInicial;
      });
    }

    // Filtro por data final
    if (filtros.dt_movim_fim) {
      const dataFinal = new Date(filtros.dt_movim_fim);
      dataFinal.setHours(23, 59, 59, 999); // Incluir o dia todo
      resultado = resultado.filter((item) => {
        const dataMovim = new Date(item.dt_movim);
        return dataMovim <= dataFinal;
      });
    }

    return resultado;
  }, [data, filtros]);

  const currentData = dadosFiltrados.slice(startIndex, endIndex);
  const totalPagesFiltrados = Math.ceil(dadosFiltrados.length / PAGE_SIZE);

  // Reset página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filtros]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPagesFiltrados));
  };

  const handleDataChange = (campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  };

  const limparFiltros = () => {
    setFiltros({
      nr_ctapes: '',
      dt_movim_ini: '',
      dt_movim_fim: '',
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="p-6">
      <PageTitle title="Auditoria de Conta" icon={FileText} />

      {loading && (
        <div className="flex justify-center items-center h-64">
          <Spinner size={48} className="animate-spin text-blue-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6">
          {/* Seção de Filtros */}
          <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FunnelSimple
                  size={20}
                  weight="duotone"
                  className="text-blue-600"
                />
                <span className="font-semibold text-gray-700">Filtros</span>
                {(filtros.nr_ctapes.trim() ||
                  filtros.dt_movim_ini ||
                  filtros.dt_movim_fim) && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                    Ativos
                  </span>
                )}
              </div>
              <span className="text-gray-400">
                {mostrarFiltros ? '−' : '+'}
              </span>
            </button>

            {mostrarFiltros && (
              <div className="px-4 pb-4 border-t border-gray-100">
                {/* Filtro de Contas */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número da Conta
                  </label>
                  <input
                    type="text"
                    value={filtros.nr_ctapes}
                    onChange={(e) =>
                      handleDataChange('nr_ctapes', e.target.value)
                    }
                    placeholder="Digite o número da conta (ex: 3, 7, 12) ou vários separados por vírgula"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Dica: você pode digitar várias contas separadas por vírgula
                    (ex: 3, 7, 12)
                  </p>
                </div>

                {/* Filtro de Datas */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Inicial
                    </label>
                    <input
                      type="date"
                      value={filtros.dt_movim_ini}
                      onChange={(e) =>
                        handleDataChange('dt_movim_ini', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Final
                    </label>
                    <input
                      type="date"
                      value={filtros.dt_movim_fim}
                      onChange={(e) =>
                        handleDataChange('dt_movim_fim', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Botão Limpar Filtros */}
                {(filtros.nr_ctapes.trim() ||
                  filtros.dt_movim_ini ||
                  filtros.dt_movim_fim) && (
                  <div className="mt-4">
                    <button
                      onClick={limparFiltros}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      Limpar Filtros
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mb-4 flex justify-between items-center">
            <p className="text-gray-600">
              {dadosFiltrados.length} de {data.length} registro(s)
            </p>

            {totalPagesFiltrados > 1 && (
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <CaretLeft size={16} />
                  Anterior
                </button>
                <span className="text-sm text-gray-600">
                  Página {currentPage} de {totalPagesFiltrados}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPagesFiltrados}
                  className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  Próxima
                  <CaretRight size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Movim.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seq. Mov.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo Op.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Lançto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Histórico
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auxiliar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dt. Liq.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dt. Conci.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estorno
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Empresa
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentData.map((row, index) => (
                  <tr
                    key={`${row.nr_seqmov}-${index}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.nr_ctapes}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(row.dt_movim)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.nr_seqmov}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.ds_doc || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.tp_operacao === 'C'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {row.tp_operacao === 'C' ? 'Crédito' : 'Débito'}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-sm text-right font-semibold ${
                        row.tp_operacao === 'C'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(row.vl_lancto)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.cd_historico || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.ds_aux || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(row.dt_liq)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(row.dt_conci)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.in_estorno === 'T'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {row.in_estorno === 'T' ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.cd_empresa || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPagesFiltrados > 1 && (
            <div className="mt-4 flex justify-center">
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <CaretLeft size={16} />
                  Anterior
                </button>
                <span className="text-sm text-gray-600">
                  Página {currentPage} de {totalPagesFiltrados}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPagesFiltrados}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  Próxima
                  <CaretRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditoriaConta;
