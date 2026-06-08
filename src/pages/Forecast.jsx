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
} from '@phosphor-icons/react';

const FaturamentoCanal = lazy(() => import('./FaturamentoCanal'));
const FaturamentoHistorico = lazy(() => import('./FaturamentoHistorico'));
const DashboardVendas = lazy(() => import('./DashboardVendas'));

const ABAS = [
  {
    id: 'forecast',
    label: 'Forecast',
    descricao: 'Promessa Mensal/Semanal · Comparativo · Vendedores',
    icon: ChartBar,
    cor: 'text-violet-600',
    bg: 'bg-violet-50',
    ringActive: 'ring-violet-500',
    Component: FaturamentoCanal,
  },
  {
    id: 'historico',
    label: 'Faturamento Detalhado',
    descricao: 'Cadastro diário por canal · Importação CSV',
    icon: CurrencyDollar,
    cor: 'text-amber-600',
    bg: 'bg-amber-50',
    ringActive: 'ring-amber-500',
    Component: FaturamentoHistorico,
  },
  {
    id: 'dashboard',
    label: 'Dashboard Vendas',
    descricao: 'KPIs · Distribuição por canal · Ranking',
    icon: ChartPieSlice,
    cor: 'text-emerald-600',
    bg: 'bg-emerald-50',
    ringActive: 'ring-emerald-500',
    Component: DashboardVendas,
  },
];
const STORAGE_KEY = 'forecast.aba-ativa';
const VALID_IDS = new Set(ABAS.map((a) => a.id));

export default function Forecast() {
  const location = useLocation();
  const navigate = useNavigate();

  // Detecta aba inicial: pathname > query ?aba=… > localStorage > default 'forecast'
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
    return 'forecast';
  };
  const [abaAtiva, setAbaAtiva] = useState(getInitial);

  // Reage a mudanças no URL (ex: usuário cola ?aba=dashboard)
  useEffect(() => {
    const qs = new URLSearchParams(location.search).get('aba');
    if (qs && VALID_IDS.has(qs) && qs !== abaAtiva) {
      setAbaAtiva(qs);
    }
  }, [location.search, abaAtiva]);

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
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1700px] mx-auto px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {ABAS.map((a) => {
              const Icon = a.icon;
              const ativo = a.id === abaAtiva;
              return (
                <button
                  key={a.id}
                  onClick={() => trocar(a.id)}
                  className={`group relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm transition-all
                    ${ativo
                      ? `${a.bg} ring-2 ${a.ringActive} shadow-sm`
                      : 'bg-gray-50 hover:bg-gray-100 ring-1 ring-gray-200'
                    }`}
                  title={a.descricao}
                >
                  <div className={`p-1.5 rounded ${ativo ? 'bg-white' : 'bg-white/60'}`}>
                    <Icon size={16} weight={ativo ? 'duotone' : 'regular'} className={a.cor} />
                  </div>
                  <div className="text-left">
                    <div className={`font-bold leading-tight ${ativo ? 'text-gray-900' : 'text-gray-600'}`}>
                      {a.label}
                    </div>
                    <div className={`text-[10px] leading-tight ${ativo ? 'text-gray-500' : 'text-gray-400'} hidden md:block`}>
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
