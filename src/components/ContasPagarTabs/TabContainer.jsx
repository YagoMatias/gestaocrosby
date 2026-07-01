import React, { Suspense, lazy, useMemo } from 'react';
import { useTabContext } from './TabContext';
import LoadingSpinner from '../LoadingSpinner';

const PAGE_COMPONENTS = {
  '/contas-a-pagar': lazy(() => import('../../pages/ContasAPagar')),
  '/dash-contas-a-pagar': lazy(() => import('../../pages/DashContasAPagar')),
  '/emprestimos': lazy(() => import('../../pages/Emprestimos')),
  '/despesa-filial': lazy(() => import('../../pages/DespesaFilial')),
  '/despesas-fixas': lazy(() => import('../../pages/DespesasFixas')),
  '/despesas-industria': lazy(() => import('../../pages/DespesasIndustria')),
  '/liberacao-pagamento': lazy(() => import('../../pages/LiberacaoPagamento')),
  '/pagamentos-fabricas': lazy(() => import('../../pages/PagamentosFabricas')),
};

export default function TabContainer() {
  const { tabs, activeTab } = useTabContext();

  if (tabs.length === 0) return null;

  return (
    <>
      {tabs.map((path) => {
        const Component = PAGE_COMPONENTS[path];
        if (!Component) return null;
        return (
          <div
            key={path}
            style={{ display: path === activeTab ? 'block' : 'none' }}
            className="flex-1 min-h-0 overflow-auto"
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <LoadingSpinner size="lg" text="Carregando..." />
                </div>
              }
            >
              <Component />
            </Suspense>
          </div>
        );
      })}
    </>
  );
}
