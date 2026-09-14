import React from 'react';
import PosVendasFranquia from '../PosVendasFranquia';
import { LOJAS_VAREJO } from './lojasVarejo';

// Versão dedicada do Varejo — mesma tela, pré-filtrada nas lojas próprias.
export default function PosVendasVarejo() {
  return <PosVendasFranquia lojasFixas={LOJAS_VAREJO} />;
}
