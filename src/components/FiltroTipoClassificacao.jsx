import React, { useState, useRef, useEffect } from 'react';

const FiltroTipoClassificacao = ({ tiposSelecionados = [], onSelectTipos, dadosTipos = [] }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Filtrar tipos baseado no termo de busca
  const tiposFiltrados = dadosTipos.filter(tipo =>
    tipo?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleTipo = (tipo) => {
    let novosSelecionados;
    if (tiposSelecionados.includes(tipo)) {
      novosSelecionados = tiposSelecionados.filter(t => t !== tipo);
    } else {
      novosSelecionados = [...tiposSelecionados, tipo];
    }
    if (onSelectTipos) onSelectTipos(novosSelecionados);
  };

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex flex-col relative" ref={dropdownRef}>
      <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Tipo Classificação</label>
      
      {/* Botão do dropdown */}
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={dadosTipos.length === 0}
        className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed text-xs"
      >
        <span className="truncate">
          {dadosTipos.length === 0 
            ? 'Nenhum tipo disponível' 
            : tiposSelecionados.length === 0 
              ? 'Selecione os tipos' 
              : `${tiposSelecionados.length} tipo(s) selecionado(s)`
          }
        </span>
        {dadosTipos.length === 0 ? (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        ) : (
          <svg 
            className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="w-full absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-100 overflow-hidden">
          {/* Campo de busca */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Buscar tipo classificação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#000638] text-sm"
            />
          </div>

          {/* Botões de ação */}
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (onSelectTipos) onSelectTipos([...dadosTipos]);
              }}
              className="text-xs px-2 py-1 bg-[#000638] text-white rounded hover:bg-[#fe0000] transition-colors"
            >
              Selecionar Todos
            </button>
            <button
              type="button"
              onClick={() => {
                if (onSelectTipos) onSelectTipos([]);
              }}
              className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                if (onSelectTipos) onSelectTipos(['VAZIO']);
              }}
              className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
            >
              Apenas Vazios
            </button>
          </div>

          {/* Lista de tipos */}
          <div className="w-full max-h-48 overflow-y-auto">
            {dadosTipos.length === 0 ? (
              <div className="p-3 text-gray-500 text-sm text-center">
                Nenhum tipo disponível
              </div>
            ) : tiposFiltrados.length === 0 ? (
              <div className="p-3 text-gray-500 text-sm text-center">
                Nenhum tipo encontrado
              </div>
            ) : (
              tiposFiltrados.map((tipo) => {
                const isSelected = tiposSelecionados.includes(tipo);
                return (
                  <div
                    key={`tipo-${tipo}`}
                    className={`px-2 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between mb-1 ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleToggleTipo(tipo)}
                  >
                    <span className="text-xs font-medium text-gray-900">
                      {tipo}
                    </span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-gray-300 text-[#000638] focus:ring-[#000638] w-4 h-4"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FiltroTipoClassificacao;
