import React from 'react';
import { List, X } from '@phosphor-icons/react';
import { SignOut } from '@phosphor-icons/react';

const Header = ({ onToggleSidebar, sidebarOpen, onLogout }) => (
  <header className="w-full h-16 bg-white border-b border-gray-200 flex justify-between items-center px-4 fixed left-0 top-0 md:ml-60 z-20">
    {/* Botão de menu para mobile/tablet */}
    <button
      className="md:hidden mr-4 p-2 rounded bg-gray-100 focus:outline-none transition"
      onClick={onToggleSidebar}
      aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
      type="button"
    >
      {sidebarOpen ? (
        <X size={24} color="#555" weight="bold" />
      ) : (
        <List size={24} color="#555" weight="bold" />
      )}
    </button>
    {/* Título centralizado em desktop */}
    <h1 className="hidden md:block text-3xl md:text-2xl font-semibold mb-4 text-[#000638] text-center md:text-left">Bem-vindo à Gestão Crosby!</h1>
    {/* Logo à direita no mobile e botão de logout */}
    <div className="flex items-center gap-3">
      <img src="/cr.png" alt="Logo" className="md:hidden w-25 h-10" />
      {/* Botão de Logout */}
      <button
        className="flex items-center gap-2 bg-[#000638] hover:bg-[#fe0000] text-white px-4 py-2 rounded-xl transition h-10 text-sm font-semibold shadow-md tracking-wide uppercase"
        onClick={onLogout}
        type="button"
        title="Logout"
      >
        <SignOut size={20} weight="bold" />
        Logout
      </button>
    </div>
  </header>
);

export default Header; 