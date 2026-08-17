import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useLocation } from 'react-router-dom';
import { FINANCEIRO_TABS_STORAGE_KEY } from '../../utils/financeiroTabs';

// Todas as páginas do módulo Financeiro que abrem em aba.
// label: texto exibido na aba (único, para não confundir CP x CR)
// group: seção do menu Financeiro a que pertence
// dot: cor do marcador da aba (mesma cor usada na Sidebar)
const FINANCEIRO_PAGES = {
  // Contas a Pagar
  '/contas-a-pagar': {
    label: 'Consulta (Pagar)',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },
  '/dash-contas-a-pagar': {
    label: 'Dashboard (Pagar)',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },
  '/emprestimos': {
    label: 'Empréstimos',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },
  '/despesa-filial': {
    label: 'Controle de Filiais',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },
  '/despesas-fixas': {
    label: 'Despesas Fixas',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },
  '/despesas-industria': {
    label: 'Despesas de Indústria',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },
  '/renegociacoes': {
    label: 'Renegociações',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },
  '/cto': {
    label: 'CTO',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },
  '/liberacao-pagamento': {
    label: 'Liberação de Pagamento',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },
  '/pagamentos-fabricas': {
    label: 'Pagamentos Fábricas',
    group: 'Contas a Pagar',
    dot: 'bg-red-500',
  },

  // Conciliação
  '/conciliacao-stone': {
    label: 'Conciliação',
    group: 'Financeiro',
    dot: 'bg-blue-500',
  },

  // Contas a Receber
  '/contas-a-receber': {
    label: 'Consulta (Receber)',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },
  '/dash-contas-a-receber': {
    label: 'Dashboard (Receber)',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },
  '/dash-inadimplencia': {
    label: 'Dashboard Inadimplência',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },
  '/metas-inadimplencia': {
    label: 'Metas Inadimplência',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },
  '/esteira-protesto': {
    label: 'Esteira de Protesto',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },
  '/call-center': {
    label: 'Call Center',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },
  '/pmr': {
    label: 'Dashboard PMR',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },
  '/batida-carteira': {
    label: 'Batida de Carteira',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },
  '/solicitacao-baixa': {
    label: 'Solicitação de Baixa',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },
  '/analise-credito': {
    label: 'Análise de Crédito',
    group: 'Contas a Receber',
    dot: 'bg-green-500',
  },

  // Demais itens do Financeiro
  '/dre': {
    label: 'DRE',
    group: 'Financeiro',
    dot: 'bg-purple-500',
  },
  '/automacao-financeiro': {
    label: 'Automação Financeiro',
    group: 'Financeiro',
    dot: 'bg-emerald-500',
  },
};

// As abas abertas ficam no sessionStorage: sobrevivem ao F5 e à navegação,
// e são descartadas quando o usuário fecha a aba do navegador. Guardamos
// apenas os caminhos — nenhum dado de página — então cada tela refaz suas
// consultas do zero ao recarregar.
function readStoredTabs() {
  try {
    const raw = sessionStorage.getItem(FINANCEIRO_TABS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tabs)) return null;
    // Ignora rotas que não existem mais (ex.: página removida num deploy)
    const tabs = parsed.tabs.filter((path) => FINANCEIRO_PAGES[path]);
    if (tabs.length === 0) return null;
    const activeTab = tabs.includes(parsed.activeTab)
      ? parsed.activeTab
      : tabs[tabs.length - 1];
    return { tabs, activeTab };
  } catch {
    // Modo anônimo / storage bloqueado: segue só com as abas em memória
    return null;
  }
}

function buildInitialState(pathname) {
  const stored = readStoredTabs();
  const tabs = stored ? [...stored.tabs] : [];
  let activeTab = stored ? stored.activeTab : null;

  // A URL manda: a página que o usuário está vendo é a aba ativa.
  if (FINANCEIRO_PAGES[pathname]) {
    if (!tabs.includes(pathname)) tabs.push(pathname);
    activeTab = pathname;
  }

  if (activeTab && !tabs.includes(activeTab)) {
    activeTab = tabs.length > 0 ? tabs[tabs.length - 1] : null;
  }

  return { tabs, activeTab };
}

const TabContext = createContext(null);

export function TabProvider({ children }) {
  const { pathname } = useLocation();
  // Restaura as abas da sessão e já abre a da URL atual — evita renderizar
  // a tela vazia por um frame quando se entra direto numa página.
  const [initialState] = useState(() => buildInitialState(pathname));
  const [tabs, setTabs] = useState(initialState.tabs);
  const [activeTab, setActiveTab] = useState(initialState.activeTab);

  useEffect(() => {
    try {
      if (tabs.length === 0) {
        sessionStorage.removeItem(FINANCEIRO_TABS_STORAGE_KEY);
      } else {
        sessionStorage.setItem(
          FINANCEIRO_TABS_STORAGE_KEY,
          JSON.stringify({ tabs, activeTab }),
        );
      }
    } catch {
      // Sem storage disponível — as abas continuam funcionando em memória
    }
  }, [tabs, activeTab]);

  const openTab = useCallback((path) => {
    if (!FINANCEIRO_PAGES[path]) return;
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

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTab(null);
  }, []);

  const switchTab = useCallback((path) => {
    setActiveTab(path);
  }, []);

  const isFinanceiroPath = useCallback((path) => {
    return !!FINANCEIRO_PAGES[path];
  }, []);

  // Qualquer navegação para uma página do Financeiro abre/ativa a aba —
  // seja pela Sidebar, por um link interno ou pela URL direta/refresh.
  useEffect(() => {
    if (FINANCEIRO_PAGES[pathname]) {
      openTab(pathname);
    }
  }, [pathname, openTab]);

  const isTabMode = tabs.length > 0;

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTab,
        openTab,
        closeTab,
        closeAllTabs,
        switchTab,
        isTabMode,
        isFinanceiroPath,
        FINANCEIRO_PAGES,
      }}
    >
      {children}
    </TabContext.Provider>
  );
}

export function useTabContext() {
  return useContext(TabContext);
}

export { FINANCEIRO_PAGES };
