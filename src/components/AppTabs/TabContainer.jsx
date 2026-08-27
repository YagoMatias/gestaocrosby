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
  '/dash-contas-a-receber': lazy(
    () => import('../../pages/DashContasAReceber'),
  ),
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
  '/automacao-financeiro': lazy(
    () => import('../../pages/AutomacaoFinanceiro'),
  ),

  // ---- Financeiro › Fiscal ----
  '/manifestacao-destinatario': lazy(
    () => import('../../pages/ManifestacaoDestinatario'),
  ),

  // ---- Solicitações Crosby ----
  '/solicitacoes-crosby': lazy(() => import('../../pages/SolicitacoesCrosby')),
  '/solicitacoes-crosby/compras-manutencao': lazy(
    () => import('../../pages/SolicitacoesCrosbyComprasManutencao'),
  ),
  '/tecnologia/chamados-dryland': lazy(
    () => import('../../pages/ChamadosDryland'),
  ),

  // ---- RH ----
  '/rh/vagas': lazy(() => import('../../pages/rh/Vagas')),

  // ---- Showroom ----
  '/showroom': lazy(() => import('../../pages/Showroom')),

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
  '/clientes-inativos-franquia': lazy(
    () => import('../../pages/ClientesInativosFranquia'),
  ),

  // ---- Varejo ----
  '/dashboard-varejo': lazy(() => import('../../pages/DashboardVarejo')),
  '/metas-varejo': lazy(() => import('../../pages/MetasVarejo')),
  '/titulos-clientes-varejo': lazy(
    () => import('../../pages/TitulosClientesVarejo'),
  ),
  '/voucher-varejo': lazy(() => import('../../pages/VoucherVarejo')),
  '/promocoes': lazy(() => import('../../pages/Promocoes')),
  '/credev-varejo': lazy(() => import('../../pages/CredevVarejo')),

  // ---- Varejo › BlueCred ----
  '/dashboard-bluecred': lazy(() => import('../../pages/DashboardBluecred')),
  '/cobranca-bluecard': lazy(() => import('../../pages/CobrancaBluecard')),
  '/documento-bluecred': lazy(() => import('../../pages/DocumentoBluecred')),
  '/clientes-bluecred': lazy(() => import('../../pages/ClientesBluecred')),
  '/antecipacao-bluecred': lazy(() => import('../../pages/AntecipacaoBoletos')),

  // ---- Marketing ----
  '/bluecard/leads': lazy(() => import('../../pages/BluecardLeads')),
  '/crosby-bot': lazy(() => import('../../pages/CrosbyBot')),

  // ---- Revenda ----
  '/inadimplentes-revenda': lazy(
    () => import('../../pages/InadimplentesRevenda'),
  ),

  // ---- Franquias ----
  '/compras-franquias': lazy(() => import('../../pages/ComprasFranquias')),
  '/inadimplentes-franquias': lazy(
    () => import('../../pages/InadimplentesFranquias'),
  ),
  '/estoque/expedicao-showroom': lazy(
    () => import('../../pages/ExpedicaoShowroom'),
  ),

  // ---- Expedição ----
  '/duplicata-vendas': lazy(() => import('../../pages/DuplicataVendas')),

  // ---- Antecipações ----
  '/faturas-clientes-antecipacao': lazy(
    () => import('../../pages/FaturasClientesConfianca'),
  ),
  '/nf-clientes-antecipacao': lazy(
    () => import('../../pages/NotasFiscaisClientesConfianca'),
  ),
  '/comprovantes-antecipacao': lazy(
    () => import('../../pages/ComprovantesConfianca'),
  ),
  '/clientes-antecipacao': lazy(() => import('../../pages/ClientesConfianca')),
  '/licitacao-titulos': lazy(() => import('../../pages/LicitacaoTitulos')),
  '/solicitacoes-remessa': lazy(
    () => import('../../pages/SolicitacoesRemessa'),
  ),
  '/minhas-remessas': lazy(() => import('../../pages/MinhasRemessas')),

  // ---- Recuperação de Crédito ----
  '/recuperacao-credito': lazy(() => import('../../pages/RecuperacaoCredito')),

  // ---- Tecnologia ----
  '/tecnologia/controle-chip': lazy(() => import('../../pages/ControleChips')),
  '/tecnologia/inventario-patrimonio': lazy(
    () => import('../../pages/InventarioPatrimonio'),
  ),
  '/tecnologia/leitura-rfid': lazy(() => import('../../pages/LeituraRFID')),
  '/tecnologia/pdv-rfid': lazy(() => import('../../pages/PDVRfid')),
  '/tecnologia/etiquetas-preco': lazy(
    () => import('../../pages/EtiquetasPreco'),
  ),
  '/tecnologia/cotacao-compras': lazy(
    () => import('../../pages/CotacaoCompras'),
  ),
  '/tecnologia/monitoramento-totvs': lazy(
    () => import('../../pages/MonitoramentoTotvs'),
  ),
  '/tecnologia/clientes-por-empresa': lazy(
    () => import('../../pages/ClientesPorEmpresa'),
  ),
  '/tecnologia/criar-vouchers': lazy(() => import('../../pages/CriarVouchers')),

  // ---- Administração ----
  '/painel-admin': lazy(() => import('../../pages/PainelAdmin')),
  '/gerenciador-acessos': lazy(() => import('../../pages/GerenciadorAcessos')),
  '/gerenciador-avisos': lazy(() => import('../../pages/GerenciadorAvisos')),
  '/api-claude': lazy(() => import('../../pages/ApiClaude')),
  '/crosby-manage': lazy(() => import('../../pages/CrosbyManage')),

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
