import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useLocation } from 'react-router-dom';
import { TABS_STORAGE_KEY } from '../../utils/appTabs';

// Páginas que abrem em aba, agrupadas pelas seções da Sidebar.
// label: texto da aba (único — duas seções podem ter "Consulta")
// group: seção de origem, exibida no tooltip
// dot: cor do marcador, alinhada à cor da seção na Sidebar
const TABBED_PAGES = {
  // ---- Financeiro › Contas a Pagar ----
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

  // ---- Financeiro › Contas a Receber ----
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

  // ---- Financeiro › demais ----
  '/conciliacao-stone': {
    label: 'Conciliação',
    group: 'Financeiro',
    dot: 'bg-blue-500',
  },
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

  // ---- Solicitações Crosby ----
  '/solicitacoes-crosby': {
    label: 'Solicitações Crosby',
    group: 'Solicitações Crosby',
    dot: 'bg-orange-500',
  },
  '/solicitacoes-crosby/compras-manutencao': {
    label: 'Compras & Manutenção',
    group: 'Solicitações Crosby',
    dot: 'bg-orange-500',
  },

  // ---- Clientes ----
  '/cadastrar-cliente': {
    label: 'Cadastrar Cliente',
    group: 'Clientes',
    dot: 'bg-teal-500',
  },
  '/consulta-cliente': {
    label: 'Consulta Cliente',
    group: 'Clientes',
    dot: 'bg-teal-500',
  },
  '/clientes-totvs': {
    label: 'Clientes TOTVS',
    group: 'Clientes',
    dot: 'bg-teal-500',
  },
  '/creditos-clientes': {
    label: 'Créditos Clientes',
    group: 'Clientes',
    dot: 'bg-teal-500',
  },
  '/top-clientes': {
    label: 'Top Clientes',
    group: 'Clientes',
    dot: 'bg-teal-500',
  },

  // ---- Painel de Vendas ----
  '/painel-vendas': {
    label: 'Painel de Vendas',
    group: 'Painel de Vendas',
    dot: 'bg-sky-500',
  },
  '/crm-vendas': {
    label: 'CRM de Vendas',
    group: 'Painel de Vendas',
    dot: 'bg-sky-500',
  },
  '/forecast': {
    label: 'Forecast',
    group: 'Painel de Vendas',
    dot: 'bg-sky-500',
  },
  '/new-forecast': {
    label: 'New Forecast',
    group: 'Painel de Vendas',
    dot: 'bg-sky-500',
  },
  '/crm/competicao': {
    label: 'Painel Competição',
    group: 'Painel de Vendas',
    dot: 'bg-sky-500',
  },
  '/ranking-compras-franquias': {
    label: 'Compras Franquias',
    group: 'Painel de Vendas',
    dot: 'bg-sky-500',
  },
  '/totvs': {
    label: 'Faturamento TOTVS',
    group: 'Painel de Vendas',
    dot: 'bg-sky-500',
  },
  '/catalogo-admin': {
    label: 'Catálogo Virtual',
    group: 'Painel de Vendas',
    dot: 'bg-sky-500',
  },

  // ---- Multimarcas ----
  '/inadimplentes-multimarcas': {
    label: 'Inadimplentes Multimarcas',
    group: 'Multimarcas',
    dot: 'bg-purple-500',
  },
  '/minhas-solicitacoes-baixa': {
    label: 'Minhas Solicit. Baixa',
    group: 'Multimarcas',
    dot: 'bg-purple-500',
  },
  '/titulos-clientes': {
    label: 'Portal de Títulos MTM',
    group: 'Multimarcas',
    dot: 'bg-purple-500',
  },
  '/clientes-mtm': {
    label: 'Clientes MTM',
    group: 'Multimarcas',
    dot: 'bg-purple-500',
  },
  '/analise-credito-mtm': {
    label: 'Análise de Crédito MTM',
    group: 'Multimarcas',
    dot: 'bg-purple-500',
  },

  // ---- Minha Franquia ----
  '/contas-pagar-franquias': {
    label: 'Portal de Títulos',
    group: 'Minha Franquia',
    dot: 'bg-amber-500',
  },
  '/voucher-usage': {
    label: 'Vouchers',
    group: 'Minha Franquia',
    dot: 'bg-amber-500',
  },
  '/notas-fiscais': {
    label: 'Notas Fiscais',
    group: 'Minha Franquia',
    dot: 'bg-amber-500',
  },
  '/consulta-nfs': {
    label: 'Consulta NFs',
    group: 'Minha Franquia',
    dot: 'bg-amber-500',
  },
  '/aniversariantes-franquia': {
    label: 'Aniversariantes',
    group: 'Minha Franquia',
    dot: 'bg-amber-500',
  },
  '/pos-vendas-franquia': {
    label: 'Pós-Vendas',
    group: 'Minha Franquia',
    dot: 'bg-amber-500',
  },
  '/clientes-cashback-franquia': {
    label: 'Clientes com Cashback',
    group: 'Minha Franquia',
    dot: 'bg-amber-500',
  },

  // ---- Ranking ----
  '/ranking-faturamento': {
    label: 'Ranking Faturamento',
    group: 'Ranking',
    dot: 'bg-yellow-500',
  },
};

// Teto de abas abertas. Cada aba fica montada para preservar filtros e
// resultados, então sem limite o consumo de memória e de consultas cresce
// sem parar. Ao passar do teto, a aba usada há mais tempo é descartada.
const MAX_TABS = 10;

// As abas abertas ficam no sessionStorage: sobrevivem ao F5 e à navegação,
// e são descartadas quando o usuário fecha a aba do navegador. Guardamos
// apenas os caminhos — nenhum dado de página — então cada tela refaz suas
// consultas do zero ao recarregar.
function readStoredTabs() {
  try {
    const raw = sessionStorage.getItem(TABS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tabs)) return null;
    // Ignora rotas que não existem mais (ex.: página removida num deploy)
    const tabs = parsed.tabs.filter((path) => TABBED_PAGES[path]);
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
  let tabs = stored ? [...stored.tabs] : [];
  let activeTab = stored ? stored.activeTab : null;

  // A URL manda: a página que o usuário está vendo é a aba ativa.
  if (TABBED_PAGES[pathname]) {
    if (!tabs.includes(pathname)) tabs.push(pathname);
    activeTab = pathname;
  }

  // Aplica o teto também na restauração — o storage pode ter vindo de uma
  // sessão anterior ao limite. Mantém as mais recentes e a ativa.
  if (tabs.length > MAX_TABS) {
    tabs = tabs.slice(-MAX_TABS);
    if (activeTab && !tabs.includes(activeTab)) tabs[0] = activeTab;
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
  // Aba descartada pelo limite, para avisar o usuário por alguns segundos
  const [evictedLabel, setEvictedLabel] = useState(null);

  // Espelho síncrono de `tabs` e ordem de uso (path -> nº de acesso).
  // Ficam em ref para o openTab não precisar se recriar a cada mudança.
  const tabsRef = useRef(initialState.tabs);
  const usageRef = useRef(new Map());
  const usageSeqRef = useRef(0);
  const seededRef = useRef(false);
  if (!seededRef.current) {
    seededRef.current = true;
    initialState.tabs.forEach((path, i) => usageRef.current.set(path, i + 1));
    usageSeqRef.current = initialState.tabs.length;
  }

  const touch = useCallback((path) => {
    usageSeqRef.current += 1;
    usageRef.current.set(path, usageSeqRef.current);
  }, []);

  useEffect(() => {
    try {
      if (tabs.length === 0) {
        sessionStorage.removeItem(TABS_STORAGE_KEY);
      } else {
        sessionStorage.setItem(
          TABS_STORAGE_KEY,
          JSON.stringify({ tabs, activeTab }),
        );
      }
    } catch {
      // Sem storage disponível — as abas continuam funcionando em memória
    }
  }, [tabs, activeTab]);

  const openTab = useCallback(
    (path) => {
      if (!TABBED_PAGES[path]) return;
      touch(path);
      setActiveTab(path);

      const current = tabsRef.current;
      if (current.includes(path)) return;

      let next = [...current, path];
      if (next.length > MAX_TABS) {
        // Descarta a aba usada há mais tempo — nunca a que acabou de abrir
        const victim = next
          .filter((t) => t !== path)
          .reduce((oldest, t) =>
            (usageRef.current.get(t) ?? 0) < (usageRef.current.get(oldest) ?? 0)
              ? t
              : oldest,
          );
        usageRef.current.delete(victim);
        next = next.filter((t) => t !== victim);
        setEvictedLabel(TABBED_PAGES[victim]?.label ?? null);
      }

      tabsRef.current = next;
      setTabs(next);
    },
    [touch],
  );

  const closeTab = useCallback((path) => {
    const next = tabsRef.current.filter((t) => t !== path);
    tabsRef.current = next;
    usageRef.current.delete(path);
    setTabs(next);
    setActiveTab((current) => {
      if (current !== path) return current;
      return next.length > 0 ? next[next.length - 1] : null;
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    tabsRef.current = [];
    usageRef.current.clear();
    setTabs([]);
    setActiveTab(null);
  }, []);

  const switchTab = useCallback(
    (path) => {
      touch(path);
      setActiveTab(path);
    },
    [touch],
  );

  // O aviso de aba descartada some sozinho
  useEffect(() => {
    if (!evictedLabel) return undefined;
    const timer = setTimeout(() => setEvictedLabel(null), 5000);
    return () => clearTimeout(timer);
  }, [evictedLabel]);

  const isTabbedPath = useCallback((path) => {
    return !!TABBED_PAGES[path];
  }, []);

  // Qualquer navegação para uma página com aba abre/ativa a aba —
  // seja pela Sidebar, por um link interno ou pela URL direta/refresh.
  useEffect(() => {
    if (TABBED_PAGES[pathname]) {
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
        isTabbedPath,
        evictedLabel,
        MAX_TABS,
        TABBED_PAGES,
      }}
    >
      {children}
    </TabContext.Provider>
  );
}

export function useTabContext() {
  return useContext(TabContext);
}

export { TABBED_PAGES, MAX_TABS };
