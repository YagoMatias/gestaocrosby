import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from '@phosphor-icons/react';
import { useTabContext } from './TabContext';

export default function TabBar() {
  const {
    tabs,
    activeTab,
    switchTab,
    closeTab,
    closeAllTabs,
    isFinanceiroPath,
    FINANCEIRO_PAGES,
  } = useTabContext();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (tabs.length === 0) return null;

  // A barra também aparece fora do Financeiro; nesse caso fechar uma aba
  // não deve arrastar o usuário para dentro de outra.
  const viewingTab = isFinanceiroPath(pathname);

  const handleSwitch = (path) => {
    switchTab(path);
    navigate(path);
  };

  const handleClose = (path) => {
    const remaining = tabs.filter((t) => t !== path);
    closeTab(path);
    if (!viewingTab) return;
    if (remaining.length > 0) {
      const next =
        path === activeTab ? remaining[remaining.length - 1] : activeTab;
      navigate(next);
    } else {
      navigate('/home');
    }
  };

  const handleCloseAll = () => {
    closeAllTabs();
    if (viewingTab) navigate('/home');
  };

  return (
    <div className="bg-white border-b border-gray-200 flex items-end px-2 pt-1 gap-0.5 overflow-x-auto scrollbar-hide">
      {tabs.map((path) => {
        const page = FINANCEIRO_PAGES[path];
        if (!page) return null;
        const isActive = path === activeTab;
        return (
          <div
            key={path}
            onClick={() => handleSwitch(path)}
            onAuxClick={(e) => {
              // botão do meio fecha a aba, como no navegador
              if (e.button === 1) {
                e.preventDefault();
                handleClose(path);
              }
            }}
            title={`${page.group} › ${page.label}`}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg cursor-pointer select-none text-sm font-medium transition-colors whitespace-nowrap shrink-0 font-barlow ${
              isActive
                ? 'bg-blue-50 text-blue-700 border border-b-0 border-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${page.dot} ${
                isActive ? '' : 'opacity-50'
              }`}
            />
            <span>{page.label}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose(path);
              }}
              title="Fechar aba"
              className={`p-0.5 rounded transition-colors ${
                isActive
                  ? 'hover:bg-blue-100 text-blue-400 hover:text-blue-600'
                  : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100'
              }`}
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        );
      })}

      {tabs.length > 1 && (
        <button
          onClick={handleCloseAll}
          title="Fechar todas as abas"
          className="ml-2 mb-0.5 px-2 py-1 rounded text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap font-barlow shrink-0"
        >
          Fechar todas
        </button>
      )}
    </div>
  );
}
