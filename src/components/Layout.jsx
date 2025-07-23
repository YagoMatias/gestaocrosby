import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleToggleSidebar = () => setSidebarOpen((open) => !open);
  const handleCloseSidebar = () => setSidebarOpen(false);

  return (
    <div className="h-screen flex">
      {/* Sidebar: overlay em telas pequenas, fixo em grandes */}
      <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} />
      <div className=" flex-1 flex flex-col">
        {/* Header sempre visível no topo */}
        <Header onMenuClick={handleToggleSidebar} sidebarOpen={sidebarOpen} />
        {/* main: padding-left só em telas grandes para acomodar sidebar fixo */}
        <main className=" flex-1 flex flex-col min-h-0 lg:pl-64 transition-all duration-300">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout; 