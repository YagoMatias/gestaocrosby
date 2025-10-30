import ContasAPagar from './ContasAPagar';

// Página de Produção - wrapper com despesas fixas pré-filtradas
const Producao = () => {
  // Códigos de despesa para despesas fixas
  const DESPESAS_FIXAS = [1001, 1004, 1003, 1002, 1005, 1006];

  return (
    <ContasAPagar
      __pageTitle="Produção"
      __despesasFixas={DESPESAS_FIXAS}
      __blockedCostCenters={[]}
    />
  );
};

export default Producao;
