import React from 'react';
import ClientesCashbackFranquia from '../ClientesCashbackFranquia';
import { LOJAS_VAREJO } from './lojasVarejo';

// Versão dedicada do Varejo — mesma tela, pré-filtrada nas lojas próprias.
export default function ClientesCashbackVarejo() {
  return <ClientesCashbackFranquia lojasFixas={LOJAS_VAREJO} />;
}
