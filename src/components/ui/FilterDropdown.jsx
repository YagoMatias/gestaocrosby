import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CaretUp, CaretDown, FunnelSimple, TextAa, ListChecks, Check, X } from '@phosphor-icons/react';
import Input from './Input';
import Button from './Button';

const FilterDropdown = ({
  columnKey,
  columnTitle,
  data,
  currentFilter,
  onApplyFilter,
  onClose,
}) => {
  const [tempSortDirection, setTempSortDirection] = useState(currentFilter?.sortDirection || null);
  const [tempSearchTerm, setTempSearchTerm] = useState(currentFilter?.searchTerm || '');
  const [tempSelectedItems, setTempSelectedItems] = useState(currentFilter?.selected || []);
  const dropdownRef = useRef(null);

  // Obter valores únicos para seleção
  const uniqueValues = Array.from(new Set(data.map(row => String(row[columnKey]))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const handleApply = () => {
    onApplyFilter(columnKey, {
      sortDirection: tempSortDirection,
      searchTerm: tempSearchTerm,
      selected: tempSelectedItems,
    });
    onClose();
  };

  const handleClear = () => {
    setTempSortDirection(null);
    setTempSearchTerm('');
    setTempSelectedItems([]);
    onApplyFilter(columnKey, null); // Limpa o filtro
    onClose();
  };

  const handleSelectItem = (value) => {
    setTempSelectedItems((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setTempSelectedItems(uniqueValues);
    } else {
      setTempSelectedItems([]);
    }
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 mt-96 w-60 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none p-3"
    >
      {/* Título do Filtro */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Filtro coluna ({columnTitle})</h2>

      {/* Filtrar por texto */}
      <div className="mb-3 pt-0 border-t-0">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Filtrar por Texto</h3>
        <Input
          placeholder="Pesquisar..."
          value={tempSearchTerm}
          onChange={(e) => setTempSearchTerm(e.target.value)}
          leftIcon={<FunnelSimple size={14} className="text-gray-400" />}
          className="mb-1 text-xs"
          size="sm"
        />
      </div>

      {/* Filtro por seleção */}
      <div className="mb-3 border-t pt-3 border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Filtrar por Seleção</h3>
        <div className="max-h-40 overflow-y-auto pr-1 custom-scrollbar">
          <div className="flex items-start mb-1">
            <input
              type="checkbox"
              id={`select-all-${columnKey}`}
              className="rounded border-gray-300 text-[#000638] focus:ring-[#000638] mr-1 w-4 h-4"
              checked={tempSelectedItems.length === uniqueValues.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            <label htmlFor={`select-all-${columnKey}`} className="text-xs font-medium text-gray-700">
              (Selecionar Tudo)
            </label>
          </div>
          {uniqueValues.map((value) => (
            <div key={value} className="flex items-start mb-1 text-nowrap">
              <input
                type="checkbox"
                id={`filter-${columnKey}-${value}`}
                className="rounded border-gray-300 text-[#000638] focus:ring-[#000638] w-4 h-4 mr-1"
                checked={tempSelectedItems.includes(value)}
                onChange={() => handleSelectItem(value)}
              />
              <label htmlFor={`filter-${columnKey}-${value}`} className="text-xs text-gray-700">
                {value}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex justify-end space-x-1 border-t pt-3 border-gray-200">
        <Button variant="secondary" size="xs" onClick={handleClear}>
          Limpar
        </Button>
        <Button variant="primary" size="xs" onClick={handleApply}>
          Aplicar
        </Button>
      </div>
    </div>
  );
};

export default FilterDropdown;
