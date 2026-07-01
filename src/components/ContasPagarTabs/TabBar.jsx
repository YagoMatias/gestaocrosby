import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from '@phosphor-icons/react';
import { useTabContext } from './TabContext';

export default function TabBar() {
  const { tabs, activeTab, switchTab, closeTab, CONTAS_PAGAR_PAGES } =
    useTabContext();
  const navigate = useNavigate();

  if (tabs.length === 0) return null;

  const handleSwitch = (path) => {
    switchTab(path);
    navigate(path);
  };

  const handleClose = (path) => {
    const remaining = tabs.filter((t) => t !== path);
    closeTab(path);
    if (remaining.length > 0) {
      const next = path === activeTab ? remaining[remaining.length - 1] : activeTab;
      navigate(next);
    } else {
      navigate('/home');
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 flex items-end px-2 pt-1 gap-0.5 overflow-x-auto scrollbar-hide">
      {tabs.map((path) => {
        const isActive = path === activeTab;
        return (
          <div
            key={path}
            onClick={() => handleSwitch(path)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg cursor-pointer select-none text-sm font-medium transition-colors whitespace-nowrap font-barlow ${
              isActive
                ? 'bg-blue-50 text-blue-700 border border-b-0 border-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{CONTAS_PAGAR_PAGES[path]}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose(path);
              }}
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
    </div>
  );
}
