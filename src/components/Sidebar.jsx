import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// SVGs para os grupos
const FolderIcon = () => (
  <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
);
const ChevronIcon = ({ open }) => (
  <svg className={`w-3 h-3 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);

const financeiro = [
  { name: 'Transações', href: '/transacoes', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1' },
  { name: 'Extrato Financeiro', href: '/extrato-financeiro', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { name: 'Extrato TOTVS', href: '/extrato-totvs', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { name: 'Consulta de Fatura', href: '/consulta-fatura', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { name: 'Fundo de Propaganda', href: '/fundo-propaganda', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

const faturamento = [
  { name: 'Varejo', href: '/varejo', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' },
  { name: 'Franquias', href: '/franquias', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { name: 'Multimarcas', href: '/multimarcas', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { name: 'Revenda', href: '/revenda', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { name: 'Ranking Faturamento', href: '/ranking-faturamento', icon: 'M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2M16 11V7a4 4 0 00-8 0v4M12 17v.01' },
];

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [financeiroOpen, setFinanceiroOpen] = useState(false);
  const [faturamentoOpen, setFaturamentoOpen] = useState(false);

  const handleNavigation = (href) => {
    onClose();
    navigate(href);
  };

  const SidebarContent = () => (
    <div className="w-64 h-full bg-white shadow-lg">
      <div className="h-16 px-6 border-b border-gray-200 flex justify-center items-center">
        <img
          src="/crosbyazul.png"
          alt="Logo Crosby"
          className="h-8 w-auto"
        />
      </div>
      <nav className="mt-6 px-3">
        <button
          className="mb-2 flex items-center w-full px-3 py-2 rounded-lg transition-colors text-xs font-bold text-gray-700 hover:bg-gray-100 focus:outline-none"
          onClick={() => setFinanceiroOpen((open) => !open)}
        >
          <FolderIcon />
          <span className="flex-1 text-left">Financeiro</span>
          <ChevronIcon open={financeiroOpen} />
        </button>
        {financeiroOpen && (
          <div className="mb-2">
            {financeiro.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <button
                  key={item.name}
                  className={`w-full flex items-center px-3 py-2 mb-1 rounded-lg transition-colors text-xs ${
                    isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={() => handleNavigation(item.href)}
                >
                  <svg 
                    className="w-4 h-4 mr-2" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d={item.icon} 
                    />
                  </svg>
                  <span className="text-xs font-medium">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <button
          className="mt-6 mb-2 flex items-center w-full px-3 py-2 rounded-lg transition-colors text-xs font-bold text-gray-700 hover:bg-gray-100 focus:outline-none"
          onClick={() => setFaturamentoOpen((open) => !open)}
        >
          <FolderIcon />
          <span className="flex-1 text-left">Faturamento</span>
          <ChevronIcon open={faturamentoOpen} />
        </button>
        {faturamentoOpen && (
          <div className="mb-2">
            {faturamento.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <button
                  key={item.name}
                  className={`w-full flex items-center px-3 py-2 mb-1 rounded-lg transition-colors text-xs ${
                    isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={() => handleNavigation(item.href)}
                >
                  <svg 
                    className="w-4 h-4 mr-2" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d={item.icon} 
                    />
                  </svg>
                  <span className="text-xs font-medium">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 z-50">
            <SidebarContent />
          </div>
        </div>
      )}
      {/* Desktop sidebar - sempre visível em telas grandes */}
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:left-0 lg:z-30">
        <SidebarContent />
      </div>
    </>
  );
};

export default Sidebar;