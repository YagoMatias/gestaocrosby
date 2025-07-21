import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useIsMobile } from './use-mobile';

const Header = ({ onMenuClick, sidebarOpen = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Mostra o menu apenas no mobile OU quando o sidebar está fechado no desktop
  const shouldShowMenu = isMobile || !sidebarOpen;
  // Mostra o logo apenas no mobile quando o sidebar está fechado
  const shouldShowLogo = isMobile && !sidebarOpen;

  const handleLogout = () => {
    logout();
    navigate('/');
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
          <div className="flex items-center mr-4">
            <svg 
              className="w-6 h-6 text-gray-500 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
              />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              {user?.name || 'Usuário'}
            </span>
          </div>
          <button
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            onClick={handleLogout}
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header; 