import React, { useState, useRef, useEffect } from 'react';

const FiltroEmpresa = ({ empresasSelecionadas = [], onSelectEmpresas, apenasEmpresa101 = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [todasEmpresas, setTodasEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  // Códigos das empresas que queremos buscar
  const codigosEmpresas = apenasEmpresa101 
    ? ['1','2','5','6','7','11','31','55','65','75','85','90','91','92','93','94','95','96','97','98','99','100','101','111','200','311','500','550','600','650','700','750','850','890','910','920','930','940','950','960','970','980','990']
    : ['1','2','5','6','7','11','31','55','65','75','85','90','91','92','93','94','95','96','97','98','99','100','101','111','200','311','500','550','600','650','700','750','850','890','910','920','930','940','950','960','970','980','990'];
  // Buscar empresas do banco de dados
  useEffect(() => {
    const buscarEmpresas = async () => {
      setLoading(true);
      try {
        console.log('🔍 Buscando empresas da API...');
        
        const response = await fetch('https://apigestaocrosby-bw2v.onrender.com/api/company/empresas');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
                 const result = await response.json();
         console.log('📊 Resposta da API:', result);
         
         // A API retorna: { success: boolean, message: string, data: object, timestamp: string }
         if (result.data && typeof result.data === 'object') {
           console.log('📊 Estrutura do data:', result.data);
           
           // Verificar se data tem a propriedade data (array de empresas)
           let empresasArray = [];
           if (result.data.data && Array.isArray(result.data.data)) {
             empresasArray = result.data.data;
             console.log(`✅ Recebidas ${empresasArray.length} empresas da API`);
           } else if (Array.isArray(result.data)) {
             empresasArray = result.data;
             console.log(`✅ Recebidas ${empresasArray.length} empresas da API (data direto)`);
           } else {
             console.log('📊 Propriedades disponíveis em data:', Object.keys(result.data));
             throw new Error('Estrutura de dados não reconhecida');
           }
           
           // Filtrar apenas as empresas que queremos
           const empresasFiltradas = empresasArray.filter(empresa => 
             codigosEmpresas.includes(empresa.cd_empresa.toString())
           );
           
           console.log(`🔍 Empresas filtradas: ${empresasFiltradas.length} de ${empresasArray.length}`);
           
           // Ordenar por código da empresa
           const empresasOrdenadas = empresasFiltradas.sort((a, b) => 
             parseInt(a.cd_empresa) - parseInt(b.cd_empresa)
           );
           
           setTodasEmpresas(empresasOrdenadas);
           console.log('✅ Empresas carregadas com sucesso:', empresasOrdenadas.map(e => `${e.cd_empresa} - ${e.nm_grupoempresa}`));
         } else {
           throw new Error('Formato de resposta inválido da API');
         }
      } catch (error) {
        console.error('❌ Erro ao buscar empresas:', error);
        // Fallback para empresas padrão se a API falhar
        setTodasEmpresas(codigosEmpresas.map(codigo => ({
          cd_empresa: codigo,
          nm_grupoempresa: `CROSBY FILIAL ${codigo}`
        })));
      } finally {
        setLoading(false);
      }
    };

    buscarEmpresas();
  }, []);

  // Filtrar empresas baseado no termo de busca
  const empresasFiltradas = todasEmpresas.filter(empresa =>
    empresa.cd_empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    empresa.nm_grupoempresa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleEmpresa = (empresaObj) => {
    let novasSelecionadas;
    if (empresasSelecionadas.some(emp => emp.cd_empresa === empresaObj.cd_empresa)) {
      novasSelecionadas = empresasSelecionadas.filter(emp => emp.cd_empresa !== empresaObj.cd_empresa);
    } else {
      novasSelecionadas = [...empresasSelecionadas, empresaObj];
    }
    if (onSelectEmpresas) onSelectEmpresas(novasSelecionadas);
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
      <label className="block text-xs font-semibold mb-1 text-[#000638]">Empresas</label>
      
      {/* Botão do dropdown */}
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={loading}
        className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">
          {loading 
            ? 'Carregando empresas...' 
            : empresasSelecionadas.length === 0 
              ? 'Selecione as empresas' 
              : `${empresasSelecionadas.length} empresa(s) selecionada(s)`
          }
        </span>
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
              placeholder="Buscar empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#000638] text-sm"
            />
          </div>

          {/* Botões de ação */}
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (onSelectEmpresas) onSelectEmpresas([...todasEmpresas]);
              }}
              className="text-xs px-2 py-1 bg-[#000638] text-white rounded hover:bg-[#fe0000] transition-colors"
            >
              Selecionar Todas
            </button>
            <button
              type="button"
              onClick={() => {
                if (onSelectEmpresas) onSelectEmpresas([]);
              }}
              className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Limpar
            </button>
          </div>

          {/* Lista de empresas */}
          <div className="w-full max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-gray-500 text-sm text-center">
                <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Carregando empresas...
              </div>
            ) : empresasFiltradas.length === 0 ? (
              <div className="p-3 text-gray-500 text-sm text-center">
                Nenhuma empresa encontrada
              </div>
            ) : (
              empresasFiltradas.map((empresa) => {
                const isSelected = empresasSelecionadas.some(emp => emp.cd_empresa === empresa.cd_empresa);
                return (
                  <div
                    key={empresa.cd_empresa}
                    className={`px-2 py-2 hover:bg-gray-50 cursor-pointer flex items-start mb-1 ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleToggleEmpresa(empresa)}
                  >
                    <div className="flex flex-row w-full">
                      <span className="text-sm font-medium text-gray-900">
                        {empresa.cd_empresa} - {empresa.nm_grupoempresa}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-gray-300 text-[#000638] focus:ring-[#000638] mr-1 w-4 h-4"
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

export default FiltroEmpresa;
