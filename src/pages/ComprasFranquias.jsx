import React, { Suspense, lazy, memo } from 'react';
import { useComprasFranquias } from '../hooks/useComprasFranquias';
import { useResponsive } from '../hooks/useResponsive';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import SEOHead from '../components/ui/SEOHead';

// Lazy loading dos componentes para melhor performance
const FormularioFiltros = lazy(() => import('../components/ComprasFranquias/FormularioFiltros'));
const TabelaRanking = lazy(() => import('../components/ComprasFranquias/TabelaRanking'));

/**
 * Página principal de Compras Franquias
 * Otimizada com lazy loading, memoização e custom hooks
 */
const ComprasFranquias = memo(() => {
  // Custom hooks para gerenciar dados e responsividade
  const {
    dadosAgrupados,
    loading,
    erro,
    buscarDados,
    setErro
  } = useComprasFranquias();

  const { 
    isMobile, 
    isTablet, 
    containerClass, 
    maxWidthClass 
  } = useResponsive();

  // Valores iniciais dos filtros (empresas pré-selecionadas)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d) => d.toISOString().split('T')[0];
  const initialFilterValues = {
    dt_inicio: fmt(firstDay),
    dt_fim: fmt(today),
    empresasSelecionadas: [
    { cd_empresa: '2' },
    { cd_empresa: '75' },
    { cd_empresa: '31' },
    { cd_empresa: '6' },
    { cd_empresa: '11' },
    ]
  };

  // Handler para submissão do formulário
  const handleSubmitFiltros = React.useCallback((filtrosData) => {
    buscarDados(filtrosData);
  }, [buscarDados]);

  return (
    <>
      {/* SEO e Meta Tags */}
      <SEOHead
        title="Compras Franquias - Gestão Crosby"
        description="Consulte o ranking de compras e vendas das franquias no sistema Gestão Crosby"
        keywords="compras, franquias, ranking, vendas, gestão, ERP"
      />

        <ErrorBoundary
          message="Erro ao carregar a página de Compras Franquias"
          onError={(error, errorInfo) => {
            console.error('ComprasFranquias Error:', error, errorInfo);
          }}
        >
          <div className={`w-full ${maxWidthClass} mx-auto ${containerClass} py-4 sm:py-6 lg:py-8`}>
            {/* Cabeçalho da página */}
            <header className="mb-6 lg:mb-8" role="banner">
              <h1 className={`
                ${isMobile ? 'text-2xl' : isTablet ? 'text-3xl' : 'text-4xl'} 
                font-bold text-center text-[#000638] mb-2
              `}>
                Compras Franquias
              </h1>
              <p className={`
                text-center text-gray-600 
                ${isMobile ? 'text-sm' : 'text-base'}
              `}>
                Consulte o ranking de compras e vendas das franquias
              </p>
            </header>

            {/* Área principal de conteúdo */}
            <main role="main">
              {/* Formulário de Filtros com Suspense */}
              <section aria-labelledby="filtros-heading">
                <h2 id="filtros-heading" className="sr-only">
                  Filtros de Consulta
                </h2>
                <ErrorBoundary fallback={(error, retry) => (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <p className="text-yellow-800 mb-2">Erro ao carregar filtros</p>
                    <button onClick={retry} className="text-yellow-600 hover:text-yellow-800 underline">
                      Tentar novamente
                        </button>
                  </div>
                )}>
                  <Suspense 
                    fallback={
                      <div className="flex justify-center items-center py-8" role="status" aria-label="Carregando filtros">
                        <LoadingSpinner size="md" text="Carregando filtros..." />
              </div>
                    }
                  >
                    <FormularioFiltros
                      onSubmit={handleSubmitFiltros}
                      loading={loading}
                      erro={erro}
                      initialValues={initialFilterValues}
                    />
                  </Suspense>
                </ErrorBoundary>
              </section>

              {/* Tabela de Resultados com Suspense */}
              <section aria-labelledby="resultados-heading">
                <h2 id="resultados-heading" className="sr-only">
                  Resultados da Consulta
                </h2>
                <ErrorBoundary fallback={(error, retry) => (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-red-800 mb-2">Erro ao carregar resultados</p>
                    <button onClick={retry} className="text-red-600 hover:text-red-800 underline">
                      Tentar novamente
              </button>
            </div>
                )}>
                  <Suspense 
                    fallback={
                      <div className="flex justify-center items-center py-12" role="status" aria-label="Carregando resultados">
                        <LoadingSpinner size="lg" text="Carregando resultados..." />
        </div> 
                    }
                  >
                    <TabelaRanking
                      dados={dadosAgrupados}
                      loading={loading}
                      erro={erro}
                      className="mt-6 lg:mt-8"
                    />
                  </Suspense>
                </ErrorBoundary>
              </section>
            </main>
          </div>
        </ErrorBoundary>
    </>
  );
});

// Adiciona displayName para melhor debugging
ComprasFranquias.displayName = 'ComprasFranquias';

export default ComprasFranquias; 