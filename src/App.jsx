import React, { memo, Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import PrivateRoute from './components/PrivateRoute';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Lazy loading de todas as páginas para otimizar bundle
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ContasAPagar = lazy(() => import('./pages/ContasAPagar'));
const ContasAPagarEmissao = lazy(() => import('./pages/ContasAPagarEmissao'));
const ContasAReceber = lazy(() => import('./pages/ContasAReceber'));
const ContasAReceberEmissao = lazy(() =>
  import('./pages/ContasAReceberEmissao'),
);
const DespesasPorSetor = lazy(() => import('./pages/DespesasPorSetor'));
const FluxoCaixa = lazy(() => import('./pages/FluxoCaixa'));
const ExtratoFinanceiro = lazy(() => import('./pages/ExtratoFinanceiro'));
const Conciliacao = lazy(() => import('./pages/Conciliacao'));
const SaldoBancarioTotvs = lazy(() => import('./pages/SaldoBancarioTotvs'));
const Clientes = lazy(() => import('./pages/Clientes'));

const MetasVarejo = lazy(() => import('./pages/MetasVarejo'));

const RankingFaturamento = lazy(() => import('./pages/RankingFaturamento'));
const AuditoriaCMV = lazy(() => import('./pages/AuditoriaCMV'));
const ComprasFranquias = lazy(() => import('./pages/ComprasFranquias'));
const Credev = lazy(() => import('./pages/Credev'));
const PainelAdmin = lazy(() => import('./pages/PainelAdmin'));
const UserPanel = lazy(() => import('./pages/UserPanel'));
const ManifestacaoNF = lazy(() => import('./pages/ManifestacaoNF'));
const SaldoBancario = lazy(() => import('./pages/SaldoBancario'));
const ImportacaoRet = lazy(() => import('./pages/ImportacaoRet'));
const AuthTest = lazy(() => import('./components/AuthTest'));
const FinanceiroPorCanal = lazy(() => import('./pages/FinanceiroPorCanal'));
const Endividamento = lazy(() => import('./pages/Endividamento'));
const ReceitaLiquida = lazy(() => import('./pages/ReceitaLiquida'));
const PMR = lazy(() => import('./pages/pmr'));
const CMVConsolidado = lazy(() => import('./pages/CMVConsolidado'));
const CMVMultimarcas = lazy(() => import('./pages/CMVMultimarcas'));
const CMVRevenda = lazy(() => import('./pages/CMVRevenda'));
const CMVFranquia = lazy(() => import('./pages/CMVFranquia'));
const CMVVarejo = lazy(() => import('./pages/CMVVarejo'));
const DRE = lazy(() => import('./pages/DRE'));

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
  const [sidebarOpen, setSidebarOpen] = useState(''); // Começa visível por padrão

  const handleToggleSidebar = () => setSidebarOpen((open) => !open);
  const handleCloseSidebar = () => setSidebarOpen('');

  // Lista de rotas protegidas (evita centenas de blocos repetidos)
  const protectedRoutes = [
    {
      path: '/clientes',
      component: Clientes,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/financeiro-por-canal',
      component: FinanceiroPorCanal,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/endividamento',
      component: Endividamento,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/dash-contas-a-receber',
      component: PMR,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/conciliacao',
      component: Conciliacao,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/saldo-bancario-totvs',
      component: SaldoBancarioTotvs,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/home',
      component: Home,
      roles: ['admin', 'manager', 'user', 'guest', 'owner'],
    },
    {
      path: '/dashboard',
      component: Dashboard,
      roles: ['admin', 'manager', 'user', 'guest', 'owner'],
    },
    {
      path: '/contas-a-pagar',
      component: ContasAPagar,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/contas-a-pagar-emissao',
      component: ContasAPagarEmissao,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/despesas-por-setor',
      component: DespesasPorSetor,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/contas-a-receber',
      component: ContasAReceber,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/contas-a-receber-emissao',
      component: ContasAReceberEmissao,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/fluxo-caixa',
      component: FluxoCaixa,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/saldo-bancario',
      component: SaldoBancario,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/importacao-ret',
      component: ImportacaoRet,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/extrato-financeiro',
      component: ExtratoFinanceiro,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/receita-liquida',
      component: ReceitaLiquida,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/metas-varejo',
      component: MetasVarejo,
      roles: ['owner', 'admin', 'manager', 'user', 'guest'],
    },
    {
      path: '/manifestacao-nf',
      component: ManifestacaoNF,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/ranking-faturamento',
      component: RankingFaturamento,
      roles: ['admin', 'manager', 'guest', 'owner', 'user'],
    },
    {
      path: '/auditoria-cmv',
      component: AuditoriaCMV,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/cmv-consolidado',
      component: CMVConsolidado,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/cmv-multimarcas',
      component: CMVMultimarcas,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/cmv-revenda',
      component: CMVRevenda,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/cmv-franquia',
      component: CMVFranquia,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/cmv-varejo',
      component: CMVVarejo,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/dre',
      component: DRE,
      roles: ['owner', 'admin', 'manager', 'user'],
    },
    {
      path: '/compras-franquias',
      component: ComprasFranquias,
      roles: ['admin', 'manager', 'guest', 'owner', 'user'],
    },
    {
      path: '/credev',
      component: Credev,
      roles: ['admin', 'manager', 'guest', 'owner', 'user'],
    },
    { path: '/painel-admin', component: PainelAdmin, roles: ['owner'] },
    {
      path: '/user-panel',
      component: UserPanel,
      roles: ['admin', 'manager', 'user', 'guest', 'owner'],
    },
    { path: '/auth-test', component: AuthTest, roles: ['owner'] },
  ];

  // Componente de layout para rotas protegidas
  const ProtectedLayout = ({ Component, allowedRoles }) => (
    <div className="h-screen flex">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
        onToggle={handleToggleSidebar}
      />
      <div className="flex-1 flex flex-col">
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
        />
        <main
          className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
            sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
          }`}
        >
          <ErrorBoundary>
            {createPrivateRoute(Component, allowedRoles)}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );

  return (
    <Routes>
      {/* Rota de login - sem layout */}
      <Route path="/" element={<LoginForm />} />

      {/* Gera rotas protegidas dinamicamente */}
      {protectedRoutes.map(({ path, component, roles }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedLayout Component={component} allowedRoles={roles} />
          }
        />
      ))}
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
