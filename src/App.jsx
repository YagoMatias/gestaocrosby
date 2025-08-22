import React, { memo, Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import PrivateRoute from './components/PrivateRoute';
import LoadingSpinner from './components/LoadingSpinner';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { TrendUp } from '@phosphor-icons/react';

// Lazy loading de todas as páginas para otimizar bundle
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ContasAPagar = lazy(() => import('./pages/ContasAPagar'));
const ContasAReceber = lazy(() => import('./pages/ContasAReceber'));
const FluxoCaixa = lazy(() => import('./pages/FluxoCaixa'));
const ExtratoFinanceiro = lazy(() => import('./pages/ExtratoFinanceiro'));

const Varejo = lazy(() => import('./pages/Varejo'));
const Franquias = lazy(() => import('./pages/Franquias'));
const Multimarcas = lazy(() => import('./pages/Multimarcas'));
const Revenda = lazy(() => import('./pages/Revenda'));


const RankingFaturamento = lazy(() => import('./pages/RankingFaturamento'));
const Consolidado = lazy(() => import('./pages/Consolidado'));
const AuditoriaCMV = lazy(() => import('./pages/AuditoriaCMV'));
const ComprasFranquias = lazy(() => import('./pages/ComprasFranquias'));
const PainelAdmin = lazy(() => import('./pages/PainelAdmin'));
const UserPanel = lazy(() => import('./pages/UserPanel'));
const DreDemo = lazy(() => import('./pages/DreDemo'));
const ManifestacaoNF = lazy(() => import('./pages/ManifestacaoNF'));
const SaldoBancario = lazy(() => import('./pages/SaldoBancario'));
const ImportacaoRet = lazy(() => import('./pages/ImportacaoRet'));
const AuthTest = lazy(() => import('./components/AuthTest'));

// Componente de fallback para loading
const PageLoadingFallback = memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <LoadingSpinner size="lg" text="Carregando página..." />
  </div>
));

PageLoadingFallback.displayName = 'PageLoadingFallback';

// Helper para criar rotas privadas com Suspense
const createPrivateRoute = (Component, allowedRoles) => (
  <PrivateRoute allowedRoles={allowedRoles}>
    <Suspense fallback={<PageLoadingFallback />}>
      <Component />
    </Suspense>
  </PrivateRoute>
);

// Componente memoizado para evitar re-renderizações desnecessárias
const AppRoutes = memo(() => {
  const [sidebarOpen, setSidebarOpen] = useState(); // Começa visível por padrão

  const handleToggleSidebar = () => setSidebarOpen((open) => !open);
  const handleCloseSidebar = () => setSidebarOpen(true);

  return (
    <div className="h-screen flex">
      {/* Sidebar responsivo */}
      <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
      <div className="flex-1 flex flex-col">
        {/* Header sempre visível no topo */}
        <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        {/* Main com transição suave */}
        <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
        }`}>
          <Routes>
            {/* Rota de login - sem lazy loading pois é primeira página */}
            <Route path="/" element={<LoginForm />} />
            
            {/* Rotas protegidas com lazy loading */}
            <Route 
              path="/home" 
              element={createPrivateRoute(Home, ['admin', 'manager', 'user', 'guest', 'owner'])} 
            />
            <Route 
              path="/dashboard" 
              element={createPrivateRoute(Dashboard, ['admin', 'manager', 'user', 'guest', 'owner'])} 
            />
            <Route 
              path="/contas-a-pagar" 
              element={createPrivateRoute(ContasAPagar, ['owner', 'admin', 'manager','user'])} 
            />
            <Route 
              path="/contas-a-receber" 
              element={createPrivateRoute(ContasAReceber, ['owner', 'admin', 'manager','user'])} 
            />
            <Route 
              path="/fluxo-caixa" 
              element={createPrivateRoute(FluxoCaixa, ['owner', 'admin', 'manager','user'])} 
            />
            <Route 
              path="/saldo-bancario" 
              element={createPrivateRoute(SaldoBancario, ['owner', 'admin', 'manager','user'])} 
            />
            <Route 
              path="/importacao-ret" 
              element={createPrivateRoute(ImportacaoRet, ['owner', 'admin', 'manager','user'])} 
            />
            <Route 
              path="/extrato-financeiro" 
              element={createPrivateRoute(ExtratoFinanceiro, ['owner', 'admin', 'manager', 'user'])} 
            />
            
            <Route 
              path="/varejo" 
              element={createPrivateRoute(Varejo, ['owner', 'admin', 'manager'])} 
            />
            <Route 
              path="/franquias" 
              element={createPrivateRoute(Franquias, ['owner', 'admin', 'manager'])} 
            />
            <Route 
              path="/multimarcas" 
              element={createPrivateRoute(Multimarcas, ['owner', 'admin', 'manager'])} 
            />
            <Route 
              path="/revenda" 
              element={createPrivateRoute(Revenda, ['owner', 'admin', 'manager'])} 
            />

            
            <Route 
              path="/dre-demo" 
              element={createPrivateRoute(DreDemo, ['owner', 'admin', 'manager'])} 
            />
            <Route 
              path="/manifestacao-nf" 
              element={createPrivateRoute(ManifestacaoNF, ['owner', 'admin', 'manager','user'])} 
            />
            <Route 
              path="/ranking-faturamento" 
              element={createPrivateRoute(RankingFaturamento, ['admin', 'manager', 'guest', 'owner','user'])} 
            />
            {/* Rota removida: /ranking-vendedores */}
            <Route 
              path="/consolidado" 
              element={createPrivateRoute(Consolidado, ['owner', 'admin', 'manager'])} 
            />
            <Route 
              path="/auditoria-cmv" 
              element={createPrivateRoute(AuditoriaCMV, ['owner', 'admin', 'manager'])} 
            />
            <Route 
              path="/compras-franquias" 
              element={createPrivateRoute(ComprasFranquias, ['admin', 'manager', 'guest', 'owner','user'])} 
            />
            <Route 
              path="/painel-admin" 
              element={createPrivateRoute(PainelAdmin, ['owner'])} 
            />
            <Route 
              path="/user-panel" 
              element={createPrivateRoute(UserPanel, ['admin', 'manager', 'user', 'guest', 'owner'])} 
            />
            <Route 
              path="/auth-test" 
              element={createPrivateRoute(AuthTest, ['owner'])} 
            />
          </Routes>
        </main>
      </div>
    </div>
  );
});

AppRoutes.displayName = 'AppRoutes';

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;