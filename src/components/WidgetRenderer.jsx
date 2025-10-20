import { useState, useEffect } from 'react';
import { executeQuery } from '../lib/queryBuilderApi';
import LoadingSpinner from './LoadingSpinner';

/**
 * Componente WidgetRenderer
 * Renderiza um widget executando sua query e exibindo os dados
 */
export default function WidgetRenderer({ widget }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros de data (se o widget tiver colunas de data)
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dateColumn, setDateColumn] = useState(null);

  // Detectar se há coluna de data na query
  useEffect(() => {
    if (widget.query_config?.select) {
      // Procurar por colunas que contenham 'dt_' ou 'data'
      const possibleDateColumns = widget.query_config.select.filter(
        (col) =>
          typeof col === 'string' &&
          (col.toLowerCase().startsWith('dt_') ||
            col.toLowerCase().includes('data') ||
            col.toLowerCase().includes('date')),
      );

      if (possibleDateColumns.length > 0) {
        setDateColumn(possibleDateColumns[0]); // Usa a primeira coluna de data encontrada
        console.log(
          '📅 [WidgetRenderer] Coluna de data detectada:',
          possibleDateColumns[0],
        );
      }
    }
  }, [widget.id]);

  useEffect(() => {
    loadWidgetData();
  }, [widget.id, dataInicio, dataFim]);

  // Função para formatar valor de data
  const formatDateValue = (value) => {
    if (!value) return value;

    let formattedValue = String(value);

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

  const loadWidgetData = async () => {
    console.log('🔍 [WidgetRenderer] Carregando dados do widget:', widget.name);
    console.log('📊 [WidgetRenderer] Query Config:', widget.query_config);

    try {
      setLoading(true);
      setError(null);

      // Copiar query config
      let queryConfig = { ...widget.query_config };

      // Se o usuário aplicou filtros de data, REMOVER filtros antigos de data do widget
      if (dateColumn && (dataInicio || dataFim)) {
        console.log('🗑️ [WidgetRenderer] Usuário aplicou filtros de data - removendo filtros antigos de data');
        // Manter apenas filtros que NÃO sejam da coluna de data
        queryConfig.where = (queryConfig.where || []).filter((filter) => {
          const isDateFilter = filter.column === dateColumn;
          if (isDateFilter) {
            console.log(`🗑️ [WidgetRenderer] Removendo filtro antigo:`, filter);
          }
          return !isDateFilter;
        });
      }
      // Se NÃO houver filtros do usuário, formatar os filtros originais do widget
      else if (queryConfig.where && Array.isArray(queryConfig.where)) {
        queryConfig.where = queryConfig.where.map((filter) => {
          // Se o filtro é na coluna de data, formatar os valores
          if (filter.column === dateColumn) {
            const formattedFilter = { ...filter };
            if (filter.value) {
              formattedFilter.value = formatDateValue(filter.value);
              console.log(
                `📅 [WidgetRenderer] Filtro original formatado: ${filter.value} → ${formattedFilter.value}`,
              );
            }
            if (filter.value2) {
              formattedFilter.value2 = formatDateValue(filter.value2);
            }
            return formattedFilter;
          }
          return filter;
        });
      }

      // Se houver filtros de data do usuário ativos, adicionar ao where
      if (dateColumn && (dataInicio || dataFim)) {
        const dateFilters = [];

        // Se ambas as datas estão preenchidas, usar BETWEEN
        if (dataInicio && dataFim) {
          dateFilters.push({
            column: dateColumn,
            operator: 'BETWEEN',
            value: `${dataInicio} 00:00:00`,
            value2: `${dataFim} 23:59:59`,
          });
          console.log(
            '📅 [WidgetRenderer] Filtro BETWEEN do usuário aplicado:',
            {
              column: dateColumn,
              de: `${dataInicio} 00:00:00`,
              ate: `${dataFim} 23:59:59`,
            },
          );
        }
        // Se só data inicial, usar >=
        else if (dataInicio) {
          dateFilters.push({
            column: dateColumn,
            operator: '>=',
            value: `${dataInicio} 00:00:00`,
          });
          console.log(
            '📅 [WidgetRenderer] Filtro >= aplicado:',
            `${dataInicio} 00:00:00`,
          );
        }
        // Se só data final, usar <=
        else if (dataFim) {
          dateFilters.push({
            column: dateColumn,
            operator: '<=',
            value: `${dataFim} 23:59:59`,
          });
          console.log(
            '📅 [WidgetRenderer] Filtro <= aplicado:',
            `${dataFim} 23:59:59`,
          );
        }

        // Adicionar filtros de data aos filtros existentes
        queryConfig.where = [...(queryConfig.where || []), ...dateFilters];
      }

      console.log('🔧 [WidgetRenderer] Query final:', queryConfig);
      console.log('🔧 [WidgetRenderer] Filtros WHERE:', JSON.stringify(queryConfig.where, null, 2));

      // Executar query do widget
      const result = await executeQuery(queryConfig);

      console.log('📦 [WidgetRenderer] Resultado:', result);
      if (result.success && result.data?.rows) {
        console.log(`📦 [WidgetRenderer] Total de linhas retornadas: ${result.data.rows.length}`);
        console.log('📦 [WidgetRenderer] Primeiras 3 linhas:', result.data.rows.slice(0, 3));
      }

      if (result.success) {
        setData(result.data.rows);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('💥 [WidgetRenderer] Erro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLimparFiltros = () => {
    setDataInicio('');
    setDataFim('');
  };

  // Renderizar filtros de data (se aplicável)
  const renderDateFilters = () => {
    if (!dateColumn) return null;

    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-700">
            📅 Filtrar por {dateColumn}:
          </span>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">De:</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Até:</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {(dataInicio || dataFim) && (
            <button
              onClick={handleLimparFiltros}
              className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              Limpar
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        {renderDateFilters()}
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {renderDateFilters()}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">
            ❌ Erro ao carregar dados: {error}
          </p>
          <button
            onClick={loadWidgetData}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div>
        {renderDateFilters()}
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500">Sem dados para exibir</p>
        </div>
      </div>
    );
  }

  // Renderizar baseado no tipo de widget
  return (
    <div>
      {renderDateFilters()}
      {widget.widget_type === 'table' && <TableWidget data={data} />}
      {widget.widget_type === 'chart' && widget.chart_type === 'bar' && (
        <BarChartWidget data={data} config={widget.display_config} />
      )}
      {widget.widget_type === 'chart' && widget.chart_type === 'pie' && (
        <PieChartWidget data={data} config={widget.display_config} />
      )}
      {widget.widget_type === 'metric' && <MetricWidget data={data} />}
    </div>
  );
}

/**
 * Widget de Tabela
 */
function TableWidget({ data }) {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-auto max-h-96">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td
                  key={column}
                  className="px-4 py-3 whitespace-nowrap text-sm text-gray-900"
                >
                  {row[column] !== null && row[column] !== undefined
                    ? String(row[column])
                    : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600">
        {data.length} registro(s)
      </div>
    </div>
  );
}

/**
 * Widget de Gráfico de Barras
 * Implementação simples sem biblioteca externa
 */
function BarChartWidget({ data, config }) {
  if (!data || data.length === 0) return null;

  // Pegar primeira coluna como label e segunda como valor
  const columns = Object.keys(data[0]);
  const labelCol = columns[0];
  const valueCol = columns[1] || columns[0];

  // Encontrar valor máximo para escala
  const maxValue = Math.max(...data.map((row) => Number(row[valueCol]) || 0));

  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((row, idx) => {
        const value = Number(row[valueCol]) || 0;
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const color =
          config?.colors?.[idx % (config.colors?.length || 5)] || '#3B82F6';

        return (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">{row[labelCol]}</span>
              <span className="font-semibold text-gray-900">
                {value.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6">
              <div
                className="h-6 rounded-full transition-all duration-300"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
      {data.length > 10 && (
        <p className="text-xs text-gray-500 text-center mt-2">
          Mostrando 10 de {data.length} registros
        </p>
      )}
    </div>
  );
}

/**
 * Widget de Gráfico de Pizza
 * Implementação simples sem biblioteca externa
 */
function PieChartWidget({ data, config }) {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);
  const labelCol = columns[0];
  const valueCol = columns[1] || columns[0];

  // Calcular total
  const total = data.reduce(
    (sum, row) => sum + (Number(row[valueCol]) || 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Legenda */}
      <div className="grid grid-cols-2 gap-2">
        {data.slice(0, 8).map((row, idx) => {
          const value = Number(row[valueCol]) || 0;
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          const color =
            config?.colors?.[idx % (config.colors?.length || 5)] ||
            `hsl(${idx * 45}, 70%, 60%)`;

          return (
            <div key={idx} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: color }}
              />
              <div className="text-xs">
                <div className="font-medium text-gray-900">{row[labelCol]}</div>
                <div className="text-gray-500">
                  {percentage}% ({value.toLocaleString()})
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual simples de pizza */}
      <div className="flex justify-center">
        <div className="text-center p-8 bg-gray-100 rounded-lg">
          <div className="text-4xl font-bold text-gray-900">
            {total.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 mt-1">Total</div>
        </div>
      </div>

      {data.length > 8 && (
        <p className="text-xs text-gray-500 text-center">
          Mostrando 8 de {data.length} itens
        </p>
      )}
    </div>
  );
}

/**
 * Widget de Métrica
 */
function MetricWidget({ data }) {
  if (!data || data.length === 0) return null;

  const firstRow = data[0];
  const columns = Object.keys(firstRow);
  const valueCol = columns[0];
  const value = firstRow[valueCol];

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-5xl font-bold text-blue-600">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-sm text-gray-600 mt-2 uppercase tracking-wider">
          {valueCol.replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  );
}
