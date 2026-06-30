// Hub do Forecast — agrupa 3 visões numa página só com abas:
//   - Forecast (Promessa Mensal/Semanal/Vendedores/Comparativo)
//   - Faturamento Histórico (cadastro diário por canal)
//   - Dashboard Vendas (KPIs + pizza + ranking)
//
// Estado da aba persistido via querystring (?aba=…) e localStorage.
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChartBar,
  CurrencyDollar,
  ChartPieSlice,
  Spinner,
  Calculator,
} from '@phosphor-icons/react';

const FaturamentoCanal = lazy(() => import('./FaturamentoCanal'));
const FaturamentoHistorico = lazy(() => import('./FaturamentoHistorico'));
const DashboardVendas = lazy(() => import('./DashboardVendas'));
const OrcamentoTrimestral = lazy(() => import('./OrcamentoTrimestral'));

const ABAS = [
  {
    id: 'forecast',
    label: 'Forecast',
    descricao: 'Promessa Mensal/Semanal · Comparativo · Vendedores',
    icon: ChartBar,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-100',
    activeBar: 'bg-gradient-to-r from-violet-500 to-violet-600',
    activeRing: 'ring-violet-200',
    activeText: 'text-violet-700',
    Component: FaturamentoCanal,
  },
  {
    id: 'historico',
    label: 'Faturamento Detalhado',
    descricao: 'Cadastro diário por canal · Importação CSV',
    icon: CurrencyDollar,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    activeBar: 'bg-gradient-to-r from-amber-500 to-orange-500',
    activeRing: 'ring-amber-200',
    activeText: 'text-amber-700',
    Component: FaturamentoHistorico,
  },
  {
    id: 'dashboard',
    label: 'Dashboard Vendas',
    descricao: 'KPIs · Distribuição por canal · Ranking',
    icon: ChartPieSlice,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    activeBar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    activeRing: 'ring-emerald-200',
    activeText: 'text-emerald-700',
    Component: DashboardVendas,
  },
  {
    id: 'orcamento',
    label: 'Orçamento',
    descricao: 'Budget tráfego + marketing por canal × trimestre',
    icon: Calculator,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    activeBar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    activeRing: 'ring-blue-200',
    activeText: 'text-blue-700',
    Component: OrcamentoTrimestral,
  },
];
const STORAGE_KEY = 'forecast.aba-ativa';
const VALID_IDS = new Set(ABAS.map((a) => a.id));

export default function Forecast() {
  const location = useLocation();
  const navigate = useNavigate();

  // Detecta aba inicial: pathname > query ?aba=… > localStorage > default 'dashboard'
  // Default = 'dashboard' (instantâneo, vem do banco) em vez de 'forecast'
  // (FaturamentoCanal dispara 12+ fetches pesados TOTVS no mount).
  const PATH_MAP = {
    '/forecast/faturamento-historico': 'historico',
    '/dashboard-vendas': 'dashboard',
  };
  const getInitial = () => {
    if (PATH_MAP[location.pathname]) return PATH_MAP[location.pathname];
    const qs = new URLSearchParams(location.search).get('aba');
    if (qs && VALID_IDS.has(qs)) return qs;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_IDS.has(stored)) return stored;
    return 'dashboard';
  };
  const [abaAtiva, setAbaAtiva] = useState(getInitial);

  // Reage a mudanças no URL (ex: usuário cola ?aba=dashboard).
  // Não depende de `abaAtiva` — durante `trocar()`, setAbaAtiva acontece
  // antes de location.search atualizar, e ter abaAtiva como dep causaria
  // uma execução extra que poderia reverter pra aba anterior em races.
  useEffect(() => {
    const qs = new URLSearchParams(location.search).get('aba');
    if (qs && VALID_IDS.has(qs)) {
      setAbaAtiva((prev) => (qs !== prev ? qs : prev));
    }
  }, [location.search]);

  const trocar = (id) => {
    setAbaAtiva(id);
    localStorage.setItem(STORAGE_KEY, id);
    navigate(`/forecast?aba=${id}`, { replace: true });
  };

  const aba = ABAS.find((a) => a.id === abaAtiva) || ABAS[0];
  const Comp = aba.Component;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Barra de abas (sticky no topo) ── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/80 shadow-sm">
        <div className="max-w-[1700px] mx-auto px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {ABAS.map((a) => {
              const Icon = a.icon;
              const ativo = a.id === abaAtiva;
              return (
                <button
                  key={a.id}
                  onClick={() => trocar(a.id)}
                  className={`group relative inline-flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-xl text-sm transition-all duration-200 overflow-hidden
                    ${ativo
                      ? `bg-white ring-2 ${a.activeRing} shadow-md shadow-gray-200/60 -translate-y-0.5`
                      : 'bg-gray-50/70 hover:bg-white hover:shadow-sm ring-1 ring-gray-200 hover:ring-gray-300'
                    }`}
                  title={a.descricao}
                >
                  {ativo && (
                    <span className={`absolute top-0 left-0 right-0 h-0.5 ${a.activeBar}`} />
                  )}
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all
                    ${ativo
                      ? `${a.iconBg} scale-105`
                      : 'bg-white ring-1 ring-gray-200 group-hover:bg-gray-50'
                    }`}>
                    <Icon
                      size={18}
                      weight={ativo ? 'fill' : 'duotone'}
                      className={ativo ? a.iconColor : 'text-gray-400 group-hover:text-gray-600'}
                    />
                  </div>
                  <div className="text-left">
                    <div className={`font-bold leading-tight tracking-tight ${
                      ativo ? a.activeText : 'text-gray-600 group-hover:text-gray-800'
                    }`}>
                      {a.label}
                    </div>
                    <div className={`text-[10px] leading-tight mt-0.5 ${
                      ativo ? 'text-gray-500' : 'text-gray-400'
                    } hidden md:block`}>
                      {a.descricao}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Conteúdo da aba ── */}
      <Suspense
        fallback={
          <div className="py-20 text-center text-gray-400">
            <Spinner size={28} className="animate-spin inline-block mr-2" />
            Carregando…
          </div>
        }
      >
        <Comp />
      </Suspense>
    </div>
  );
}
