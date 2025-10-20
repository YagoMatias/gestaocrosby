import { useState, useEffect } from 'react';
import {
  fetchTables,
  fetchTableColumns,
  previewQuery,
} from '../lib/queryBuilderApi';
import { createWidget } from '../lib/dashboardSupabase';
import LoadingSpinner from './LoadingSpinner';

/**
 * Modal de Criação de Widget
 * Permite construir visualmente uma query SQL e escolher visualização
 */
export default function WidgetBuilderModal({
  dashboardId,
  isOpen,
  onClose,
  onSuccess,
}) {
  // Estados principais
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);

  // Estados do widget
  const [widgetName, setWidgetName] = useState('');
  const [widgetType, setWidgetType] = useState('chart');
  const [chartType, setChartType] = useState('bar');

  // Estados de filtros e ordenação
  const [filters, setFilters] = useState([]);
  const [orderBy, setOrderBy] = useState([]);
  const [limit, setLimit] = useState(100);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Operadores disponíveis
  const operators = [
    { value: '=', label: 'Igual (=)' },
    { value: '!=', label: 'Diferente (≠)' },
    { value: '>', label: 'Maior (>)' },
    { value: '>=', label: 'Maior ou Igual (≥)' },
    { value: '<', label: 'Menor (<)' },
    { value: '<=', label: 'Menor ou Igual (≤)' },
    { value: 'BETWEEN', label: 'Entre (BETWEEN)' },
    { value: 'LIKE', label: 'Contém (LIKE)' },
    { value: 'NOT LIKE', label: 'Não Contém' },
    { value: 'IN', label: 'Em Lista (IN)' },
    { value: 'NOT IN', label: 'Não Em Lista' },
    { value: 'IS NULL', label: 'É Nulo' },
    { value: 'IS NOT NULL', label: 'Não é Nulo' },
  ];

  // Carregar tabelas ao abrir modal
  useEffect(() => {
    console.log(
      '🎬 [WidgetBuilder] useEffect isOpen disparado. isOpen:',
      isOpen,
    );
    if (isOpen) {
      console.log('✅ [WidgetBuilder] Modal aberto, carregando tabelas...');
      loadTables();
    }
  }, [isOpen]);

  // Carregar colunas quando selecionar tabela
  useEffect(() => {
    console.log(
      '🎬 [WidgetBuilder] useEffect selectedTable disparado. Tabela:',
      selectedTable,
    );
    if (selectedTable) {
      console.log(
        '✅ [WidgetBuilder] Tabela selecionada, carregando colunas...',
      );
      loadColumns(selectedTable);
    } else {
      console.log(
        '⚠️ [WidgetBuilder] Nenhuma tabela selecionada, limpando colunas',
      );
      setColumns([]);
      setSelectedColumns([]);
    }
  }, [selectedTable]);

  const loadTables = async () => {
    console.log('🔍 [WidgetBuilder] Iniciando loadTables...');
    try {
      setLoading(true);
      console.log('📡 [WidgetBuilder] Chamando fetchTables()...');
      const result = await fetchTables();
      console.log('📦 [WidgetBuilder] Resultado fetchTables:', result);

      if (result.success) {
        console.log('✅ [WidgetBuilder] Tabelas carregadas:', result.data);
        setTables(result.data);
      } else {
        console.error(
          '❌ [WidgetBuilder] Erro ao buscar tabelas:',
          result.error,
        );
        setError(result.error);
      }
    } catch (err) {
      console.error('💥 [WidgetBuilder] Exception em loadTables:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      console.log(
        '🏁 [WidgetBuilder] loadTables finalizado. Tables state:',
        tables,
      );
    }
  };

  const loadColumns = async (tableName) => {
    console.log(
      '🔍 [WidgetBuilder] Carregando colunas para tabela:',
      tableName,
    );
    try {
      setLoading(true);
      const result = await fetchTableColumns(tableName);
      console.log('📦 [WidgetBuilder] Resultado fetchTableColumns:', result);

      if (result.success) {
        console.log(
          '✅ [WidgetBuilder] Colunas carregadas:',
          result.data.columns,
        );
        setColumns(result.data.columns || []);
      } else {
        console.error(
          '❌ [WidgetBuilder] Erro ao buscar colunas:',
          result.error,
        );
        setError(result.error);
      }
    } catch (err) {
      console.error('💥 [WidgetBuilder] Exception em loadColumns:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addFilter = () => {
    setFilters([
      ...filters,
      { column: '', operator: '=', value: '', value2: '' },
    ]);
  };

  const removeFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index, field, value) => {
    const newFilters = [...filters];
    newFilters[index][field] = value;
    setFilters(newFilters);
  };

  const addOrderBy = () => {
    setOrderBy([...orderBy, { column: '', direction: 'ASC' }]);
  };

  const removeOrderBy = (index) => {
    setOrderBy(orderBy.filter((_, i) => i !== index));
  };

  const updateOrderBy = (index, field, value) => {
    const newOrderBy = [...orderBy];
    newOrderBy[index][field] = value;
    setOrderBy(newOrderBy);
  };

  const toggleColumn = (columnName) => {
    if (selectedColumns.includes(columnName)) {
      setSelectedColumns(selectedColumns.filter((c) => c !== columnName));
    } else {
      setSelectedColumns([...selectedColumns, columnName]);
    }
  };

  const handlePreview = async () => {
    console.log('🔍 [WidgetBuilder] handlePreview iniciado');
    console.log('📋 [WidgetBuilder] Selected Table:', selectedTable);
    console.log('📋 [WidgetBuilder] Selected Columns:', selectedColumns);

    if (!selectedTable || selectedColumns.length === 0) {
      console.error(
        '❌ [WidgetBuilder] Validação falhou: tabela ou colunas vazias',
      );
      setError('Selecione uma tabela e pelo menos uma coluna');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('⏳ [WidgetBuilder] Loading iniciado...');

      const queryConfig = {
        select: selectedColumns,
        from: selectedTable,
        where: formatFiltersForBackend(filters),
        orderBy: orderBy.filter((o) => o.column),
        limit: 10, // Preview com apenas 10 registros
      };

      console.log('📦 [WidgetBuilder] Query Config:', queryConfig);
      console.log('📅 [WidgetBuilder] Filtros formatados:', queryConfig.where);
      console.log('🌐 [WidgetBuilder] Chamando previewQuery...');

      const startTime = Date.now();
      const result = await previewQuery(queryConfig);
      const endTime = Date.now();

      console.log(
        `⏱️ [WidgetBuilder] previewQuery levou ${endTime - startTime}ms`,
      );
      console.log('📦 [WidgetBuilder] Resultado previewQuery:', result);

      if (result.success) {
        console.log(
          '✅ [WidgetBuilder] Preview data recebido:',
          result.data?.length,
          'registros',
        );
        setPreviewData(result.data);
      } else {
        console.error('❌ [WidgetBuilder] Erro no preview:', result.error);
        setError(result.error);
      }
    } catch (err) {
      console.log('💥 [WidgetBuilder] Exception em handlePreview:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      console.log('🏁 [WidgetBuilder] handlePreview finalizado');
    }
  };

  /**
   * Formata filtros para envio ao backend
   * Converte datetime-local para formato ISO aceito pelo SQL Server
   */
  const formatDateValue = (value) => {
    if (!value) return value;

    let formattedValue = value;

    // Caso 1: "2024-01-15T10:30" (datetime-local completo)
    if (formattedValue.includes('T')) {
      formattedValue = formattedValue.replace('T', ' ');
      if (formattedValue.split(':').length === 2) {
        formattedValue = `${formattedValue}:00`;
      }
    }
    // Caso 2: "2024-01-15" (apenas data, sem hora)
    else if (/^\d{4}-\d{2}-\d{2}$/.test(formattedValue)) {
      formattedValue = `${formattedValue} 00:00:00`;
    }
    // Caso 3: "2024-01-15 10:30" (já tem espaço mas falta segundos)
    else if (
      formattedValue.includes(' ') &&
      formattedValue.split(':').length === 2
    ) {
      formattedValue = `${formattedValue}:00`;
    }

    return formattedValue;
  };

  const formatFiltersForBackend = (filters) => {
    return filters
      .filter((f) => f.column && f.value)
      .map((filter) => {
        // Encontrar o tipo da coluna
        const column = columns.find((col) => col.name === filter.column);
        const columnType = column?.data_type?.toLowerCase() || '';

        const isDateColumn =
          columnType.includes('date') ||
          columnType.includes('time') ||
          columnType === 'timestamp' ||
          columnType === 'datetime';

        if (isDateColumn) {
          const formattedValue = formatDateValue(filter.value);
          const formattedValue2 = formatDateValue(filter.value2);

          console.log(`📅 [formatFilters] ${filter.value} → ${formattedValue}`);
          if (filter.value2) {
            console.log(
              `📅 [formatFilters] ${filter.value2} → ${formattedValue2}`,
            );
          }

          return {
            ...filter,
            value: formattedValue,
            value2: formattedValue2,
          };
        }

        return filter;
      });
  };

  const handleSave = async () => {
    if (!widgetName) {
      setError('Digite um nome para o widget');
      return;
    }

    if (!selectedTable || selectedColumns.length === 0) {
      setError('Configure a query antes de salvar');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const widgetData = {
        dashboard_id: dashboardId,
        name: widgetName,
        widget_type: widgetType,
        chart_type: widgetType === 'chart' ? chartType : null,
        query_config: {
          select: selectedColumns,
          from: selectedTable,
          where: formatFiltersForBackend(filters),
          orderBy: orderBy.filter((o) => o.column),
          limit: limit,
        },
        display_config: {
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
        },
        position_x: 0,
        position_y: 0,
        width: 6,
        height: 4,
        is_active: true,
      };

      console.log('💾 [WidgetBuilder] Salvando widget com dados:', widgetData);
      console.log(
        '📅 [WidgetBuilder] Filtros formatados:',
        widgetData.query_config.where,
      );

      const result = await createWidget(widgetData);

      if (result.success) {
        onSuccess('Widget criado com sucesso!');
        handleClose();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setSelectedTable('');
    setColumns([]);
    setSelectedColumns([]);
    setFilters([]);
    setOrderBy([]);
    setWidgetName('');
    setWidgetType('chart');
    setChartType('bar');
    setPreviewData(null);
    setError(null);
    setCurrentStep(1);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Criar Widget</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                currentStep === 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              1. Tabela e Colunas
            </button>
            <button
              onClick={() => setCurrentStep(2)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                currentStep === 2
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              2. Filtros
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                currentStep === 3
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              3. Visualização
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Step 1: Tabela e Colunas */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Seleção de Tabela */}
              <div className="relative z-10">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione a Tabela *
                </label>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log(
                      '📋 [WidgetBuilder] Tabela selecionada:',
                      value,
                    );
                    console.log('📋 [WidgetBuilder] Event target:', e.target);
                    console.log(
                      '📋 [WidgetBuilder] Selected index:',
                      e.target.selectedIndex,
                    );
                    console.log(
                      '📋 [WidgetBuilder] Selected option:',
                      e.target.options[e.target.selectedIndex],
                    );
                    setSelectedTable(value);
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white cursor-pointer"
                  style={{
                    minHeight: '44px',
                    position: 'relative',
                    zIndex: 100,
                  }}
                >
                  <option value="" className="text-gray-500" disabled>
                    Escolha uma tabela...
                  </option>
                  {console.log(
                    '🎨 [WidgetBuilder] Renderizando dropdown. Tables:',
                    tables,
                    'Length:',
                    tables.length,
                  )}
                  {tables.map((table) => {
                    console.log(
                      '🎨 [WidgetBuilder] Renderizando opção:',
                      table,
                    );
                    // Suporta tanto 'table_name' quanto 'name'
                    const tableName = table.table_name || table.name;
                    console.log(
                      '🔍 [WidgetBuilder] Table name extraído:',
                      tableName,
                    );
                    return (
                      <option
                        key={tableName}
                        value={tableName}
                        className="text-gray-900 py-2"
                        style={{
                          color: '#111827',
                          backgroundColor: 'white',
                          padding: '8px',
                        }}
                      >
                        {tableName}
                      </option>
                    );
                  })}
                </select>
                {tables.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    ⚠️ Nenhuma tabela disponível. Verifique o console.
                  </p>
                )}
                {tables.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-green-600">
                      ✅ {tables.length} tabela(s) carregada(s)
                    </p>
                    <details className="text-xs text-gray-600">
                      <summary className="cursor-pointer hover:text-gray-900">
                        🔍 Debug: Ver primeiras 5 tabelas
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                        {JSON.stringify(tables.slice(0, 5), null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>

              {/* Seleção de Colunas */}
              {selectedTable && columns.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecione as Colunas * ({selectedColumns.length}{' '}
                    selecionadas)
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {columns.map((column) => (
                        <label
                          key={column.name}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedColumns.includes(column.name)}
                            onChange={() => toggleColumn(column.name)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {column.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {column.data_type}
                              {column.category && ` • ${column.category}`}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Filtros e Ordenação */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {console.log(
                '🎨 [WidgetBuilder] Renderizando Step 2. Columns:',
                columns,
                'Length:',
                columns.length,
              )}
              {console.log('🎨 [WidgetBuilder] Selected Table:', selectedTable)}

              {/* Filtros WHERE */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Filtros (WHERE)
                  </label>
                  <button
                    onClick={addFilter}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Adicionar Filtro
                  </button>
                </div>

                {filters.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                    Nenhum filtro adicionado
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filters.map((filter, index) => {
                      // Encontrar a coluna selecionada para determinar o tipo
                      const selectedColumn = columns.find(
                        (col) => col.name === filter.column,
                      );
                      const columnType =
                        selectedColumn?.data_type?.toLowerCase() || '';

                      // Verificar se é uma coluna de data/datetime
                      const isDateColumn =
                        columnType.includes('date') ||
                        columnType.includes('time') ||
                        columnType === 'timestamp' ||
                        columnType === 'datetime';

                      return (
                        <div key={index} className="flex gap-2 items-start">
                          <select
                            value={filter.column}
                            onChange={(e) =>
                              updateFilter(index, 'column', e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="">Coluna...</option>
                            {columns.map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.name} ({col.data_type})
                              </option>
                            ))}
                          </select>

                          <select
                            value={filter.operator}
                            onChange={(e) =>
                              updateFilter(index, 'operator', e.target.value)
                            }
                            className="w-40 px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {operators.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>

                          {/* Campo de Valor (ou valores para BETWEEN) */}
                          {filter.operator === 'BETWEEN' ? (
                            <div className="flex-1 flex gap-2">
                              {isDateColumn ? (
                                <>
                                  <input
                                    type="datetime-local"
                                    value={filter.value || ''}
                                    onChange={(e) =>
                                      updateFilter(
                                        index,
                                        'value',
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Data inicial"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                  />
                                  <span className="text-gray-500 self-center">
                                    e
                                  </span>
                                  <input
                                    type="datetime-local"
                                    value={filter.value2 || ''}
                                    onChange={(e) =>
                                      updateFilter(
                                        index,
                                        'value2',
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Data final"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                  />
                                </>
                              ) : (
                                <>
                                  <input
                                    type="text"
                                    value={filter.value || ''}
                                    onChange={(e) =>
                                      updateFilter(
                                        index,
                                        'value',
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Valor inicial"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                  />
                                  <span className="text-gray-500 self-center">
                                    e
                                  </span>
                                  <input
                                    type="text"
                                    value={filter.value2 || ''}
                                    onChange={(e) =>
                                      updateFilter(
                                        index,
                                        'value2',
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Valor final"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                  />
                                </>
                              )}
                            </div>
                          ) : isDateColumn ? (
                            <div className="flex-1 flex gap-1">
                              <input
                                type="datetime-local"
                                value={filter.value || ''}
                                onChange={(e) =>
                                  updateFilter(index, 'value', e.target.value)
                                }
                                placeholder="dd/mm/aaaa hh:mm"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                              />
                              <span className="text-xs text-gray-500 self-center whitespace-nowrap">
                                📅
                              </span>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={filter.value || ''}
                              onChange={(e) =>
                                updateFilter(index, 'value', e.target.value)
                              }
                              placeholder="Valor..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          )}

                          <button
                            onClick={() => removeFilter(index)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ordenação ORDER BY */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Ordenação (ORDER BY)
                  </label>
                  <button
                    onClick={addOrderBy}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Adicionar Ordenação
                  </button>
                </div>

                {orderBy.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                    Nenhuma ordenação adicionada
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderBy.map((order, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <select
                          value={order.column}
                          onChange={(e) =>
                            updateOrderBy(index, 'column', e.target.value)
                          }
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Coluna...</option>
                          {columns.map((col) => (
                            <option key={col.name} value={col.name}>
                              {col.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={order.direction}
                          onChange={(e) =>
                            updateOrderBy(index, 'direction', e.target.value)
                          }
                          className="w-40 px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="ASC">Crescente (A-Z)</option>
                          <option value="DESC">Decrescente (Z-A)</option>
                        </select>

                        <button
                          onClick={() => removeOrderBy(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Limite */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Limite de Registros
                </label>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                  min="1"
                  max="10000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Step 3: Visualização */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Nome do Widget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Widget *
                </label>
                <input
                  type="text"
                  value={widgetName}
                  onChange={(e) => setWidgetName(e.target.value)}
                  placeholder="Ex: Vendas por Mês"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Tipo de Visualização */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Visualização *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setWidgetType('chart')}
                    className={`p-4 border-2 rounded-lg text-center ${
                      widgetType === 'chart'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">📊</div>
                    <div className="font-medium">Gráfico</div>
                  </button>

                  <button
                    onClick={() => setWidgetType('table')}
                    className={`p-4 border-2 rounded-lg text-center ${
                      widgetType === 'table'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">📋</div>
                    <div className="font-medium">Tabela</div>
                  </button>
                </div>
              </div>

              {/* Tipo de Gráfico */}
              {widgetType === 'chart' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Gráfico *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setChartType('bar')}
                      className={`p-4 border-2 rounded-lg text-center ${
                        chartType === 'bar'
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <div className="text-3xl mb-2">📊</div>
                      <div className="font-medium">Barras</div>
                    </button>

                    <button
                      onClick={() => setChartType('pie')}
                      className={`p-4 border-2 rounded-lg text-center ${
                        chartType === 'pie'
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <div className="text-3xl mb-2">🥧</div>
                      <div className="font-medium">Pizza</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Preview dos Dados
                  </label>
                  <button
                    onClick={handlePreview}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    {loading ? 'Carregando...' : '🔄 Atualizar Preview'}
                  </button>
                </div>

                {previewData && (
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-80">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(previewData[0] || {}).map((key) => (
                              <th
                                key={key}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {previewData.map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((value, i) => (
                                <td
                                  key={i}
                                  className="px-4 py-3 whitespace-nowrap text-sm text-gray-900"
                                >
                                  {value !== null ? String(value) : 'NULL'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600">
                      Mostrando {previewData.length} registros (preview
                      limitado)
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              Cancelar
            </button>

            <div className="flex gap-3">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  ← Voltar
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  onClick={() => {
                    console.log('🔄 [WidgetBuilder] Botão Próximo clicado');
                    console.log(
                      '📊 [WidgetBuilder] Current Step:',
                      currentStep,
                    );
                    console.log(
                      '📋 [WidgetBuilder] Selected Table:',
                      selectedTable,
                    );
                    console.log(
                      '📋 [WidgetBuilder] Selected Columns:',
                      selectedColumns,
                    );
                    console.log(
                      '📋 [WidgetBuilder] Columns disponíveis:',
                      columns.length,
                    );
                    setCurrentStep(currentStep + 1);
                  }}
                  disabled={
                    currentStep === 1 &&
                    (!selectedTable || selectedColumns.length === 0)
                  }
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Próximo →
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={loading || !widgetName}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : '✓ Salvar Widget'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
