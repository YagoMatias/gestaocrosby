import React, { Suspense, lazy } from 'react';
import { useTabContext } from './TabContext';
import LoadingSpinner from '../LoadingSpinner';

// Cada página do Financeiro que pode abrir em aba.
// As chaves precisam bater com as de FINANCEIRO_PAGES (TabContext).
const PAGE_COMPONENTS = {
  // Contas a Pagar
  '/contas-a-pagar': lazy(() => import('../../pages/ContasAPagar')),
  '/dash-contas-a-pagar': lazy(() => import('../../pages/DashContasAPagar')),
  '/emprestimos': lazy(() => import('../../pages/Emprestimos')),
  '/despesa-filial': lazy(() => import('../../pages/DespesaFilial')),
  '/despesas-fixas': lazy(() => import('../../pages/DespesasFixas')),
  '/despesas-industria': lazy(() => import('../../pages/DespesasIndustria')),
  '/renegociacoes': lazy(() => import('../../pages/Renegociacoes')),
  '/cto': lazy(() => import('../../pages/CTO')),
  '/liberacao-pagamento': lazy(() => import('../../pages/LiberacaoPagamento')),
  '/pagamentos-fabricas': lazy(() => import('../../pages/PagamentosFabricas')),

  // Conciliação
  '/conciliacao-stone': lazy(() => import('../../pages/ConciliacaoStone')),

  // Contas a Receber
  '/contas-a-receber': lazy(() => import('../../pages/ContasAReceber')),
  '/dash-contas-a-receber': lazy(() => import('../../pages/DashContasAReceber')),
  '/dash-inadimplencia': lazy(() => import('../../pages/DashInadimplencia')),
  '/metas-inadimplencia': lazy(() => import('../../pages/MetasInadimplencia')),
  '/esteira-protesto': lazy(() => import('../../pages/EsteiraProtesto')),
  '/call-center': lazy(() => import('../../pages/CallCenter')),
  '/pmr': lazy(() => import('../../pages/DashboardPMR')),
  '/batida-carteira': lazy(() => import('../../pages/BatidaCarteira')),
  '/solicitacao-baixa': lazy(() => import('../../pages/SolicitacaoBaixa')),
  '/analise-credito': lazy(() => import('../../pages/AnaliseCredito')),

  // Demais itens do Financeiro
  '/dre': lazy(() => import('../../pages/DRE')),
  '/automacao-financeiro': lazy(() => import('../../pages/AutomacaoFinanceiro')),
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

export { PAGE_COMPONENTS };
