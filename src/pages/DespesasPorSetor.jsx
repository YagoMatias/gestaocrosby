import React from 'react';
import ContasAPagar from './ContasAPagar';

export default function DespesasPorSetor() {
  // Bloquear centros de custo 999, 28 e 10
  return <ContasAPagar __modoEmissao __blockedCostCenters={[999, 28, 10]} />;
}
