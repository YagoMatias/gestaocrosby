import React from 'react';
import ClientesInativosFranquia from '../ClientesInativosFranquia';
import { LOJAS_VAREJO } from './lojasVarejo';

// Versão dedicada do Varejo — mesma tela, pré-filtrada nas lojas próprias.
export default function ClientesInativosVarejo() {
  return <ClientesInativosFranquia lojasFixas={LOJAS_VAREJO} />;
}
