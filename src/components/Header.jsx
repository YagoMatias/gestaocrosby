import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useIsMobile } from './use-mobile';
import { User, SignOut, Gear } from '@phosphor-icons/react';

const Header = ({ onMenuClick, sidebarOpen = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Mostra o menu apenas no mobile OU quando o sidebar está fechado no desktop
  const shouldShowMenu = isMobile || !sidebarOpen;
  // Mostra o logo apenas no mobile quando o sidebar está fechado
  const shouldShowLogo = isMobile && !sidebarOpen;

  const handleLogout = () => {
    logout();
    navigate('/');
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

  const handleUserPanelClick = () => {
    setShowDropdown(false);
    navigate('/user-panel');
  };

  return (
    <header className="w-screen bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center">
          {shouldShowMenu && (
            <button
              className="p-2 mr-4 text-gray-500 hover:text-gray-700 transition-colors"
              onClick={onMenuClick}
            >
              <svg 
                className="w-7 h-7" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" 
                />
              </svg>
            </button>
          )}
          {shouldShowLogo && (
            <div className="ml-0">
              <img
                src="/cr.png"
                alt="Logo Crosby"
                className="h-8 w-auto"
              />
            </div>
          )}
        </div>

        <div className="flex items-center">
          {/* Dropdown do usuário */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <User size={20} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                {user?.name || 'Usuário'}
              </span>
              <svg 
                className={`w-4 h-4 text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={handleUserPanelClick}
                >
                  <Gear size={16} className="text-gray-500" />
                  Painel do Usuário
                </button>
                <div className="border-t border-gray-200 my-1"></div>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={handleLogout}
                >
                  <SignOut size={16} className="text-red-500" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 