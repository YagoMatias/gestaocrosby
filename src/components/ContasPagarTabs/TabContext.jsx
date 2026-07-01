import React, { createContext, useContext, useState, useCallback } from 'react';

const CONTAS_PAGAR_PAGES = {
  '/contas-a-pagar': 'Consulta',
  '/dash-contas-a-pagar': 'Dashboard',
  '/emprestimos': 'Empréstimos',
  '/despesa-filial': 'Controle de Filiais',
  '/despesas-fixas': 'Despesas Fixas',
  '/despesas-industria': 'Despesas de Indústria',
  '/liberacao-pagamento': 'Liberação de Pagamento',
  '/pagamentos-fabricas': 'Pagamentos Fábricas',
};

const TabContext = createContext(null);

export function TabProvider({ children }) {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);

  const openTab = useCallback((path) => {
    if (!CONTAS_PAGAR_PAGES[path]) return;
    setTabs((prev) => {
      if (prev.includes(path)) return prev;
      return [...prev, path];
    });
    setActiveTab(path);
  }, []);

  const closeTab = useCallback((path) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t !== path);
      setActiveTab((current) => {
        if (current !== path) return current;
        return next.length > 0 ? next[next.length - 1] : null;
      });
      return next;
    });
  }, []);

  const switchTab = useCallback((path) => {
    setActiveTab(path);
  }, []);

  const isContasPagarPath = useCallback((path) => {
    return !!CONTAS_PAGAR_PAGES[path];
  }, []);

  const isTabMode = tabs.length > 0;

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTab,
        openTab,
        closeTab,
        switchTab,
        isTabMode,
        isContasPagarPath,
        CONTAS_PAGAR_PAGES,
      }}
    >
      {children}
    </TabContext.Provider>
  );
}

export function useTabContext() {
  return useContext(TabContext);
}

export { CONTAS_PAGAR_PAGES };
