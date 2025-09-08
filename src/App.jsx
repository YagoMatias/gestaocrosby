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
const Conciliacao = lazy(() => import('./pages/Conciliacao'));
const SaldoBancarioTotvs = lazy(() => import('./pages/SaldoBancarioTotvs'));

const Varejo = lazy(() => import('./pages/Varejo'));
const Franquias = lazy(() => import('./pages/Franquias'));
const Multimarcas = lazy(() => import('./pages/Multimarcas'));
const Revenda = lazy(() => import('./pages/Revenda'));


const RankingFaturamento = lazy(() => import('./pages/RankingFaturamento'));
const Consolidado = lazy(() => import('./pages/Consolidado'));
const AuditoriaCMV = lazy(() => import('./pages/AuditoriaCMV'));
const ComprasFranquias = lazy(() => import('./pages/ComprasFranquias'));
const Credev = lazy(() => import('./pages/Credev'));
const PainelAdmin = lazy(() => import('./pages/PainelAdmin'));
const UserPanel = lazy(() => import('./pages/UserPanel'));
const DreDemo = lazy(() => import('./pages/DreDemo'));
const ManifestacaoNF = lazy(() => import('./pages/ManifestacaoNF'));
const SaldoBancario = lazy(() => import('./pages/SaldoBancario'));
const ImportacaoRet = lazy(() => import('./pages/ImportacaoRet'));
const AuthTest = lazy(() => import('./components/AuthTest'));
const FinanceiroPorCanal = lazy(() => import('./pages/FinanceiroPorCanal'));
const Endividamento = lazy(() => import('./pages/Endividamento'));
const ReceitaLiquida = lazy(() => import('./pages/ReceitaLiquida'));
const DashContasAReceber = lazy(() => import('./pages/DashContasAReceber'));

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
    <Routes>
      {/* Rota de login - sem layout (Sidebar/Header) */}
      <Route path="/" element={<LoginForm />} />
      
      {/* Rotas protegidas com layout completo */}
      <Route 
        path="/financeiro-por-canal" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(FinanceiroPorCanal, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />

      <Route 
        path="/endividamento" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Endividamento, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />

      <Route 
        path="/dash-contas-a-receber" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(DashContasAReceber, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />

      <Route 
        path="/conciliacao" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Conciliacao, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/saldo-bancario-totvs" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(SaldoBancarioTotvs, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/home" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Home, ['admin', 'manager', 'user', 'guest', 'owner'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Dashboard, ['admin', 'manager', 'user', 'guest', 'owner'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/contas-a-pagar" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(ContasAPagar, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/contas-a-receber" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(ContasAReceber, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/fluxo-caixa" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(FluxoCaixa, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/saldo-bancario" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(SaldoBancario, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/importacao-ret" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(ImportacaoRet, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/extrato-financeiro" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(ExtratoFinanceiro, ['owner', 'admin', 'manager', 'user'])}
              </main>
            </div>
          </div>
        } 
      />

      <Route 
        path="/receita-liquida" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(ReceitaLiquida, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />
      
      <Route 
        path="/varejo" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Varejo, ['owner', 'admin', 'manager', 'user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/franquias" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Franquias, ['owner', 'admin', 'manager', 'user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/multimarcas" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Multimarcas, ['owner', 'admin', 'manager', 'user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/revenda" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Revenda, ['owner', 'admin', 'manager', 'user'])}
              </main>
            </div>
          </div>
        } 
      />

      
      <Route 
        path="/dre-demo" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(DreDemo, ['owner', 'admin', 'manager'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/manifestacao-nf" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(ManifestacaoNF, ['owner', 'admin', 'manager','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/ranking-faturamento" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(RankingFaturamento, ['admin', 'manager', 'guest', 'owner','user'])}
              </main>
            </div>
          </div>
        } 
      />
      {/* Rota removida: /ranking-vendedores */}
      <Route 
        path="/consolidado" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Consolidado, ['owner', 'admin', 'manager', 'user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/auditoria-cmv" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(AuditoriaCMV, ['owner', 'admin', 'manager', 'user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/compras-franquias" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(ComprasFranquias, ['admin', 'manager', 'guest', 'owner','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/credev" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(Credev, ['admin', 'manager', 'guest', 'owner','user'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/painel-admin" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(PainelAdmin, ['owner'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/user-panel" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(UserPanel, ['admin', 'manager', 'user', 'guest', 'owner'])}
              </main>
            </div>
          </div>
        } 
      />
      <Route 
        path="/auth-test" 
        element={
          <div className="h-screen flex">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} onToggle={handleToggleSidebar} />
            <div className="flex-1 flex flex-col">
              <Header sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
              <main className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
              }`}>
                {createPrivateRoute(AuthTest, ['owner'])}
              </main>
            </div>
          </div>
        } 
      />
    </Routes>
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