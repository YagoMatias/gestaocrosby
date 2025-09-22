// Duplicação mínima de ContasAPagar.jsx alterando apenas a origem dos dados para a rota de Emissão
import React from 'react';
import ContasAPagar from './ContasAPagar';

export default function ContasAPagarEmissaoWrapper() {
  // O componente original já usa useApiClient().financial.contasPagar
  // Vamos sobrepor globalmente fetch dentro do módulo ContasAPagar via prop opcional
  // Sem alterar o arquivo grande, reutilizamos o componente e instruímos a rota
  // por meio de uma prop convencionada.
  return <ContasAPagar __modoEmissao />;
}
