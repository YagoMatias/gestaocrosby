import React, { memo, Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import PrivateRoute from './components/PrivateRoute';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AcaoCartoes from './pages/AcaoCartoes';

// Lazy loading de todas as páginas para otimizar bundle
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BIExterno = lazy(() => import('./pages/BIExterno'));
const ContasAPagar = lazy(() => import('./pages/ContasAPagar'));
const Producao = lazy(() => import('./pages/Producao'));
const CheckInCard = lazy(() => import('./pages/CheckInCard'));
const MeusCartoes = lazy(() => import('./pages/MeusCartoes'));
const ContasAPagarEmissao = lazy(() => import('./pages/ContasAPagarEmissao'));
const ContasAReceber = lazy(() => import('./pages/ContasAReceber'));
const ContasAReceberEmissao = lazy(() =>
  import('./pages/ContasAReceberEmissao'),
);
const ContasPagarFranquias = lazy(() => import('./pages/ContasPagarFranquias'));
const SolicitacaoCredito = lazy(() => import('./pages/SolicitacaoCredito'));
const AnaliseCredito = lazy(() => import('./pages/AnaliseCredito'));
const RenegociacaoDividas = lazy(() => import('./pages/RenegociacaoDividas'));
const NotasFiscais = lazy(() => import('./pages/NotasFiscais'));
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
const CredevRevenda = lazy(() => import('./pages/CredevRevenda'));
const CredevVarejo = lazy(() => import('./pages/CredevVarejo'));
const CredevMultimarcas = lazy(() => import('./pages/CredevMultimarcas'));
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
const DashboardFaturamento = lazy(() => import('./pages/DashboardFaturamento'));
const DashboardVarejo = lazy(() => import('./pages/DashboardVarejo'));
const DashboardMultimarcas = lazy(() => import('./pages/DashboardMultimarcas'));
const DashboardFranquias = lazy(() => import('./pages/DashboardFranquias'));
const DashboardRevenda = lazy(() => import('./pages/DashboardRevenda'));
const CrosbyBot = lazy(() => import('./pages/CrosbyBot'));
const AnaliseCashback = lazy(() => import('./pages/AnaliseCashback'));
const InadimplentesMultimarcas = lazy(() =>
  import('./pages/InadimplentesMultimarcas'),
);
const InadimplentesRevenda = lazy(() => import('./pages/InadimplentesRevenda'));
const InadimplentesFranquias = lazy(() =>
  import('./pages/InadimplentesFranquias'),
);
const CMVVarejo = lazy(() => import('./pages/CMVVarejo'));
const DRE = lazy(() => import('./pages/DRE'));
const AuditoriaTransacoes = lazy(() => import('./pages/AuditoriaTransacoes'));
const GerenciadorDashboards = lazy(() =>
  import('./pages/GerenciadorDashboards'),
);
const GerenciadorAcessos = lazy(() => import('./pages/GerenciadorAcessos'));
const GerenciadorAvisos = lazy(() => import('./pages/GerenciadorAvisos'));
const AnaliseTransacao = lazy(() => import('./pages/AnaliseTransacao'));
const Widgets = lazy(() => import('./pages/Widgets'));

// Componente de fallback para loading
const PageLoadingFallback = memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <LoadingSpinner size="lg" text="Carregando página..." />
  </div>
));

PageLoadingFallback.displayName = 'PageLoadingFallback';

// Helper para criar rotas privadas com Suspense
const createPrivateRoute = (Component) => (
  <PrivateRoute>
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
    { path: '/clientes', component: Clientes },
    { path: '/auditoria-transacoes', component: AuditoriaTransacoes },
    { path: '/gerenciador-dashboards', component: GerenciadorDashboards },
    { path: '/widgets', component: Widgets },
    { path: '/financeiro-por-canal', component: FinanceiroPorCanal },
    { path: '/endividamento', component: Endividamento },
    { path: '/dash-contas-a-receber', component: PMR },
    { path: '/conciliacao', component: Conciliacao },
    { path: '/saldo-bancario-totvs', component: SaldoBancarioTotvs },
    { path: '/home', component: Home },
    { path: '/dashboard', component: Dashboard },
    { path: '/bi-externo', component: BIExterno },
    { path: '/contas-a-pagar', component: ContasAPagar },
    { path: '/producao', component: Producao },
    { path: '/contas-a-pagar-emissao', component: ContasAPagarEmissao },
    { path: '/despesas-por-setor', component: DespesasPorSetor },
    { path: '/contas-a-receber', component: ContasAReceber },
    { path: '/contas-a-receber-emissao', component: ContasAReceberEmissao },
    { path: '/contas-pagar-franquias', component: ContasPagarFranquias },
    { path: '/solicitacao-credito', component: SolicitacaoCredito },
    { path: '/analise-credito', component: AnaliseCredito },
    { path: '/renegociacao-dividas', component: RenegociacaoDividas },
    { path: '/notas-fiscais', component: NotasFiscais },
    { path: '/fluxo-caixa', component: FluxoCaixa },
    { path: '/saldo-bancario', component: SaldoBancario },
    { path: '/importacao-ret', component: ImportacaoRet },
    { path: '/extrato-financeiro', component: ExtratoFinanceiro },
    { path: '/receita-liquida', component: ReceitaLiquida },
    { path: '/metas-varejo', component: MetasVarejo },
    { path: '/manifestacao-nf', component: ManifestacaoNF },
    { path: '/ranking-faturamento', component: RankingFaturamento },
    { path: '/auditoria-cmv', component: AuditoriaCMV },
    { path: '/cmv-consolidado', component: CMVConsolidado },
    { path: '/cmv-multimarcas', component: CMVMultimarcas },
    { path: '/cmv-revenda', component: CMVRevenda },
    { path: '/cmv-franquia', component: CMVFranquia },
    { path: '/cmv-varejo', component: CMVVarejo },
    { path: '/dre', component: DRE },
    { path: '/compras-franquias', component: ComprasFranquias },
    { path: '/credev', component: Credev },
    { path: '/credev-revenda', component: CredevRevenda },
    { path: '/credev-varejo', component: CredevVarejo },
    { path: '/credev-multimarcas', component: CredevMultimarcas },
    { path: '/inadimplentes-multimarcas', component: InadimplentesMultimarcas },
    { path: '/inadimplentes-revenda', component: InadimplentesRevenda },
    { path: '/inadimplentes-franquias', component: InadimplentesFranquias },
    { path: '/dashboard-faturamento', component: DashboardFaturamento },
    { path: '/dashboard-varejo', component: DashboardVarejo },
    { path: '/dashboard-multimarcas', component: DashboardMultimarcas },
    { path: '/dashboard-franquias', component: DashboardFranquias },
    { path: '/dashboard-revenda', component: DashboardRevenda },
    { path: '/crosby-bot', component: CrosbyBot },
    { path: '/analise-cashback', component: AnaliseCashback },
    { path: '/painel-admin', component: PainelAdmin },
    { path: '/gerenciador-acessos', component: GerenciadorAcessos },
    { path: '/gerenciador-avisos', component: GerenciadorAvisos },
    { path: '/user-panel', component: UserPanel },
    { path: '/auth-test', component: AuthTest },
    { path: '/acao-cartoes', component: AcaoCartoes },
    { path: '/check-in-card', component: CheckInCard },
    { path: '/meus-cartoes', component: MeusCartoes },
    { path: '/analise-transacao', component: AnaliseTransacao },
  ];

  // Componente de layout para rotas protegidas
  const ProtectedLayout = ({ Component }) => (
    <div className="h-screen ">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
        onToggle={handleToggleSidebar}
      />
      <div className="flex-1 flex flex-col w-screen">
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
        />
        <main
          className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out ${
            sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'
          }`}
        >
          <ErrorBoundary>{createPrivateRoute(Component)}</ErrorBoundary>
        </main>
      </div>
    </div>
  );

  return (
    <Routes>
      {/* Rota de login - sem layout */}
      <Route path="/" element={<LoginForm />} />

      {/* Gera rotas protegidas dinamicamente */}
      {protectedRoutes.map(({ path, component }) => (
        <Route
          key={path}
          path={path}
          element={<ProtectedLayout Component={component} />}
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
