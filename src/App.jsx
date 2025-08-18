import React, { memo, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import PrivateRoute from './components/PrivateRoute';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Lazy loading de todas as páginas para otimizar bundle
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ContasAPagar = lazy(() => import('./pages/ContasAPagar'));
const ContasAReceber = lazy(() => import('./pages/ContasAReceber'));
const FluxoCaixa = lazy(() => import('./pages/FluxoCaixa'));
const ExtratoFinanceiro = lazy(() => import('./pages/ExtratoFinanceiro'));
const ExtratoTOTVS = lazy(() => import('./pages/ExtratoTOTVS'));
const Varejo = lazy(() => import('./pages/Varejo'));
const Franquias = lazy(() => import('./pages/Franquias'));
const Multimarcas = lazy(() => import('./pages/Multimarcas'));
const Revenda = lazy(() => import('./pages/Revenda'));
const ConsultaFatura = lazy(() => import('./pages/ConsultaFatura'));
const FundoPropaganda = lazy(() => import('./pages/FundoPropaganda'));
const RankingFaturamento = lazy(() => import('./pages/RankingFaturamento'));
const Consolidado = lazy(() => import('./pages/Consolidado'));
const ComprasFranquias = lazy(() => import('./pages/ComprasFranquias'));
const PainelAdmin = lazy(() => import('./pages/PainelAdmin'));
const UserPanel = lazy(() => import('./pages/UserPanel'));
const DreDemo = lazy(() => import('./pages/DreDemo'));
const ManifestacaoNF = lazy(() => import('./pages/ManifestacaoNF'));
const SaldoBancario = lazy(() => import('./pages/SaldoBancario'));
const ImportacaoRet = lazy(() => import('./pages/ImportacaoRet'));

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
  return (
    <ErrorBoundary>
      <Routes>
        {/* Rota de login - sem lazy loading pois é primeira página */}
        <Route path="/" element={<LoginForm />} />
        
        {/* Rotas protegidas com lazy loading */}
        <Route 
          path="/home" 
          element={createPrivateRoute(Home, ['ADM', 'DIRETOR', 'FINANCEIRO', 'FRANQUIA'])} 
        />
        <Route 
          path="/dashboard" 
          element={createPrivateRoute(Dashboard, ['ADM', 'DIRETOR', 'FINANCEIRO', 'FRANQUIA'])} 
        />
        <Route 
          path="/contas-a-pagar" 
          element={createPrivateRoute(ContasAPagar, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/contas-a-receber" 
          element={createPrivateRoute(ContasAReceber, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/fluxo-caixa" 
          element={createPrivateRoute(FluxoCaixa, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/saldo-bancario" 
          element={createPrivateRoute(SaldoBancario, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/importacao-ret" 
          element={createPrivateRoute(ImportacaoRet, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/extrato-financeiro" 
          element={createPrivateRoute(ExtratoFinanceiro, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/extrato-totvs" 
          element={createPrivateRoute(ExtratoTOTVS, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/varejo" 
          element={createPrivateRoute(Varejo, ['ADM', 'DIRETOR'])} 
        />
        <Route 
          path="/franquias" 
          element={createPrivateRoute(Franquias, ['ADM', 'DIRETOR'])} 
        />
        <Route 
          path="/multimarcas" 
          element={createPrivateRoute(Multimarcas, ['ADM', 'DIRETOR'])} 
        />
        <Route 
          path="/revenda" 
          element={createPrivateRoute(Revenda, ['ADM', 'DIRETOR'])} 
        />
        <Route 
          path="/consulta-fatura" 
          element={createPrivateRoute(ConsultaFatura, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/fundo-propaganda" 
          element={createPrivateRoute(FundoPropaganda, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/dre-demo" 
          element={createPrivateRoute(DreDemo, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/manifestacao-nf" 
          element={createPrivateRoute(ManifestacaoNF, ['ADM', 'DIRETOR', 'FINANCEIRO'])} 
        />
        <Route 
          path="/ranking-faturamento" 
          element={createPrivateRoute(RankingFaturamento, ['ADM', 'DIRETOR', 'FRANQUIA'])} 
        />
        {/* Rota removida: /ranking-vendedores */}
        <Route 
          path="/consolidado" 
          element={createPrivateRoute(Consolidado, ['ADM', 'DIRETOR'])} 
        />
        <Route 
          path="/compras-franquias" 
          element={createPrivateRoute(ComprasFranquias, ['ADM', 'DIRETOR', 'FRANQUIA'])} 
        />
        <Route 
          path="/painel-admin" 
          element={createPrivateRoute(PainelAdmin, ['ADM'])} 
        />
        <Route 
          path="/user-panel" 
          element={createPrivateRoute(UserPanel, ['ADM', 'DIRETOR', 'FINANCEIRO', 'FRANQUIA'])} 
        />
      </Routes>
    </ErrorBoundary>
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