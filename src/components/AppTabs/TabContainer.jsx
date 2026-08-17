import React, { Suspense, lazy } from 'react';
import { useTabContext } from './TabContext';
import LoadingSpinner from '../LoadingSpinner';

// Componente de cada página que abre em aba.
// As chaves precisam bater com as de TABBED_PAGES (TabContext).
const PAGE_COMPONENTS = {
  // ---- Financeiro › Contas a Pagar ----
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

  // ---- Financeiro › Contas a Receber ----
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

  // ---- Financeiro › demais ----
  '/conciliacao-stone': lazy(() => import('../../pages/ConciliacaoStone')),
  '/dre': lazy(() => import('../../pages/DRE')),
  '/automacao-financeiro': lazy(() => import('../../pages/AutomacaoFinanceiro')),

  // ---- Solicitações Crosby ----
  '/solicitacoes-crosby': lazy(() => import('../../pages/SolicitacoesCrosby')),
  '/solicitacoes-crosby/compras-manutencao': lazy(
    () => import('../../pages/SolicitacoesCrosbyComprasManutencao'),
  ),

  // ---- Clientes ----
  '/cadastrar-cliente': lazy(() => import('../../pages/CadastrarCliente')),
  '/consulta-cliente': lazy(() => import('../../pages/ConsultaCliente')),
  '/clientes-totvs': lazy(() => import('../../pages/ClientesTotvs')),
  '/creditos-clientes': lazy(() => import('../../pages/CreditosClientes')),
  '/top-clientes': lazy(() => import('../../pages/TopClientes')),

  // ---- Painel de Vendas ----
  '/painel-vendas': lazy(() => import('../../pages/PainelVendas')),
  '/crm-vendas': lazy(() => import('../../pages/CRMVendas')),
  '/forecast': lazy(() => import('../../pages/Forecast')),
  '/new-forecast': lazy(() => import('../../pages/NewForecast')),
  '/crm/competicao': lazy(() => import('../../pages/PainelCompeticao')),
  '/ranking-compras-franquias': lazy(
    () => import('../../pages/RankingComprasFranquias'),
  ),
  '/totvs': lazy(() => import('../FaturamentoPanel')),
  '/catalogo-admin': lazy(() => import('../../pages/CatalogoAdmin')),

  // ---- Multimarcas ----
  '/inadimplentes-multimarcas': lazy(
    () => import('../../pages/InadimplentesMultimarcas'),
  ),
  '/minhas-solicitacoes-baixa': lazy(
    () => import('../../pages/MinhasSolicitacoesBaixa'),
  ),
  '/titulos-clientes': lazy(() => import('../../pages/TitulosClientes')),
  '/clientes-mtm': lazy(() => import('../../pages/ClientesMTM')),
  '/analise-credito-mtm': lazy(
    () => import('../../pages/AnaliseCreditoMultimarcas'),
  ),

  // ---- Minha Franquia ----
  '/contas-pagar-franquias': lazy(
    () => import('../../pages/ContasPagarFranquias'),
  ),
  '/voucher-usage': lazy(() => import('../../pages/VoucherUsage')),
  '/notas-fiscais': lazy(() => import('../../pages/NotasFiscais')),
  '/consulta-nfs': lazy(() => import('../../pages/ConsultaNFs')),
  '/aniversariantes-franquia': lazy(
    () => import('../../pages/AniversariantesFranquia'),
  ),
  '/pos-vendas-franquia': lazy(() => import('../../pages/PosVendasFranquia')),
  '/clientes-cashback-franquia': lazy(
    () => import('../../pages/ClientesCashbackFranquia'),
  ),

  // ---- Ranking ----
  '/ranking-faturamento': lazy(() => import('../../pages/RankingFaturamento')),
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
