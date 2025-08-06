import React, { useState, useRef, useEffect } from 'react';

const FiltroEmpresa = ({ empresasSelecionadas = [], onSelectEmpresas }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [todasEmpresas, setTodasEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  // Códigos das empresas que queremos buscar
  const codigosEmpresas = ['1', '2', '6', '90', '91', '96', '97', '94', '93', '99', '11', '31', '7', '95', '65', '75', '85', '92', '98', '5', '55', '100', '200', '600', '990', '910', '960', '970', '940', '930', '111', '310', '700', '950', '650', '750', '850', '920', '980', '500', '550'];

  // Buscar empresas do banco de dados
  useEffect(() => {
         const buscarEmpresas = async () => {
       setLoading(true);
       try {
         // Tentar diferentes rotas para buscar empresas
         const rotas = [
           'https://apigestaocrosby-bw2v.onrender.com/api/company/empresas'
         ];
         
         let todasEmpresasAPI = null;
         let rotaUsada = '';
         
         for (const rota of rotas) {
           try {
             console.log('🔍 Tentando rota:', rota);
             const res = await fetch(rota);
             
             if (res.ok) {
               todasEmpresasAPI = await res.json();
               rotaUsada = rota;
               console.log('✅ Rota funcionou:', rota);
               console.log('📊 Dados recebidos:', todasEmpresasAPI);
               break;
             } else {
               console.warn(`❌ Rota ${rota} retornou status ${res.status}: ${res.statusText}`);
             }
           } catch (err) {
             console.warn(`❌ Erro na rota ${rota}:`, err);
           }
         }
         
         if (!todasEmpresasAPI) {
           throw new Error('Nenhuma rota funcionou para buscar empresas');
         }
         console.log('Rota usada com sucesso:', rotaUsada);
         
         // Verificar se a resposta tem a estrutura esperada
         let dadosEmpresas = todasEmpresasAPI;
         console.log('🔧 Processando dados. Tipo:', typeof todasEmpresasAPI, 'É array:', Array.isArray(todasEmpresasAPI));
         
         // Se for um objeto com propriedades, tentar extrair o array
         if (todasEmpresasAPI && typeof todasEmpresasAPI === 'object' && !Array.isArray(todasEmpresasAPI)) {
           console.log('🔍 Propriedades disponíveis:', Object.keys(todasEmpresasAPI));
           
           if (todasEmpresasAPI.empresas) {
             dadosEmpresas = todasEmpresasAPI.empresas;
             console.log('✅ Usando propriedade "empresas"');
           } else if (todasEmpresasAPI.data) {
             dadosEmpresas = todasEmpresasAPI.data;
             console.log('✅ Usando propriedade "data"');
           } else if (todasEmpresasAPI.dados) {
             dadosEmpresas = todasEmpresasAPI.dados;
             console.log('✅ Usando propriedade "dados"');
           } else {
             // Se não encontrar propriedade específica, usar o objeto como está
             dadosEmpresas = Object.values(todasEmpresasAPI);
             console.log('⚠️ Usando Object.values() como fallback');
           }
         }
         
         console.log('📋 Dados para filtrar:', dadosEmpresas);
         
         // Filtrar apenas as empresas que queremos
         console.log('🎯 Códigos que estamos procurando:', codigosEmpresas);
         console.log('📊 Estrutura de empresa de exemplo:', dadosEmpresas[0]);
         
         const empresasFiltradas = dadosEmpresas.filter(empresa => {
           const temEmpresa = empresa && empresa.cd_empresa;
           const codigoIncluido = temEmpresa && codigosEmpresas.includes(empresa.cd_empresa.toString());
           
           if (temEmpresa && !codigoIncluido) {
             console.log(`⏭️ Empresa ${empresa.cd_empresa} ignorada (não está na lista)`);
           }
           
           return temEmpresa && codigoIncluido;
         });
         
         console.log(`🔍 Empresas filtradas: ${empresasFiltradas.length} de ${dadosEmpresas.length}`);
         
         // Ordenar por código da empresa
         const empresasOrdenadas = empresasFiltradas.sort((a, b) => {
           const codigoA = parseInt(a.cd_empresa);
           const codigoB = parseInt(b.cd_empresa);
           return codigoA - codigoB;
         });
         
         // Verificar se encontrou empresas
         if (empresasOrdenadas.length === 0) {
           console.warn('❌ Nenhuma empresa encontrada com os códigos especificados');
           console.log('📋 Dados brutos recebidos:', todasEmpresasAPI);
           console.log('📋 Dados processados:', dadosEmpresas);
         } else {
           console.log('✅ Empresas encontradas:', empresasOrdenadas.map(e => `${e.cd_empresa} - ${e.nm_grupoempresa || e.nm_empresa || 'Sem nome'}`));
         }
         
         setTodasEmpresas(empresasOrdenadas);
      } catch (error) {
        console.error('Erro ao buscar empresas:', error);
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
  React.useEffect(() => {
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
        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-hidden">
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
            <div className="max-h-48 overflow-y-auto">
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
                     className={`px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                       isSelected ? 'bg-blue-50' : ''
                     }`}
                     onClick={() => handleToggleEmpresa(empresa)}
                   >
                     <div className="flex flex-col">
                       <span className="text-sm font-medium text-gray-900">
                         {empresa.cd_empresa} - {empresa.nm_grupoempresa}
                       </span>
                     </div>
                <input
                  type="checkbox"
                       checked={isSelected}
                  readOnly
                  className="accent-[#000638]"
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
