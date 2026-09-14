import React from 'react';
import AniversariantesFranquia from '../AniversariantesFranquia';
import { LOJAS_VAREJO } from './lojasVarejo';

// Versão dedicada do Varejo — mesma tela, pré-filtrada nas lojas próprias.
export default function AniversariantesVarejo() {
  return <AniversariantesFranquia lojasFixas={LOJAS_VAREJO} />;
}
