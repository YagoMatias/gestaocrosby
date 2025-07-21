import React, { useState, useRef } from 'react';

const FiltroEmpresa = ({ empresasSelecionadas = [], onSelectEmpresas }) => {
  const [sugestoes, setSugestoes] = useState([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);

  const fetchEmpresas = async (texto) => {
    if (!texto || texto.length < 1) {
      setSugestoes([]);
      setShowSugestoes(false);
      return;
    }
    try {
      const res = await fetch(`https://apigestaocrosby.onrender.com/autocomplete/nm_grupoempresa?q=${encodeURIComponent(texto)}`);
      if (!res.ok) return;
      const json = await res.json();
      setSugestoes(json.map(e => ({
        label: `${e.cd_empresa} - ${e.nm_grupoempresa}`,
        value: e.nm_grupoempresa,
        cd_empresa: e.cd_empresa,
        empresaObj: e
      })));
      setShowSugestoes(true);
      setHighlightedIndex(-1);
    } catch {
      setSugestoes([]);
      setShowSugestoes(false);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    fetchEmpresas(e.target.value);
  };

  const handleFocus = (e) => {
    fetchEmpresas(e.target.value);
  };

  const handleToggleEmpresa = (empresaObj) => {
    let novasSelecionadas;
    if (empresasSelecionadas.some(emp => emp.cd_empresa === empresaObj.cd_empresa)) {
      novasSelecionadas = empresasSelecionadas.filter(emp => emp.cd_empresa !== empresaObj.cd_empresa);
    } else {
      novasSelecionadas = [...empresasSelecionadas, empresaObj];
    }
    if (onSelectEmpresas) onSelectEmpresas(novasSelecionadas);
  };

  const handleRemoveSelecionada = (cd_empresa) => {
    const novas = empresasSelecionadas.filter(emp => emp.cd_empresa !== cd_empresa);
    if (onSelectEmpresas) onSelectEmpresas(novas);
  };

  const handleKeyDown = (e) => {
    if (!showSugestoes || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(idx => (idx < sugestoes.length - 1 ? idx + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(idx => (idx > 0 ? idx - 1 : sugestoes.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < sugestoes.length) {
        handleToggleEmpresa(sugestoes[highlightedIndex].empresaObj);
      }
    } else if (e.key === 'Escape') {
      setShowSugestoes(false);
    }
  };

  return (
    <div className="flex flex-col relative">
      <label className="block text-xs font-semibold mb-1 text-[#000638]">Empresa</label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name="nm_grupoempresa"
          autoComplete="off"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
          onKeyDown={handleKeyDown}
          className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
          placeholder="Digite o nome da loja"
        />
        {showSugestoes && sugestoes.length > 0 && (
          <ul className="absolute left-0 right-0 z-50 bg-white border rounded shadow w-full max-h-40 overflow-y-auto mt-1">
            {sugestoes.map((s, i) => (
              <li
                key={i}
                className={`px-3 py-2 hover:bg-gray-100 cursor-pointer select-none flex items-center justify-between gap-2 ${highlightedIndex === i ? 'bg-blue-100' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleToggleEmpresa(s.empresaObj)}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                <span>{s.label}</span>
                <input
                  type="checkbox"
                  checked={empresasSelecionadas.some(emp => emp.cd_empresa === s.cd_empresa)}
                  readOnly
                  className="accent-[#000638]"
                  onClick={e => e.stopPropagation()}
                  onChange={() => handleToggleEmpresa(s.empresaObj)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Empresas selecionadas abaixo do dropdown */}
      {empresasSelecionadas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {empresasSelecionadas.map((emp, idx) => (
            <span key={emp.cd_empresa} className="bg-[#000638] text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm">
              {emp.cd_empresa} - {emp.nm_grupoempresa}
              <button type="button" className="ml-1 text-white hover:text-[#fe0000]" onClick={() => handleRemoveSelecionada(emp.cd_empresa)} title="Remover">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default FiltroEmpresa;
