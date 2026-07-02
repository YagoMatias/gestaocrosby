// Portal de Títulos Varejo — reusa TitulosClientes com filtro fixo pelas
// filiais das lojas próprias de varejo (11 branches, sem franquia/MTM).
//
// Filiais varejo alinhadas com o restante do sistema:
//   2  João Pessoa · 5  Nova Cruz · 55 Parnamirim · 65 Canguaretama
//   87 Cidade Jardim · 88 Guararapes · 90 Ayrton Senna · 93 Imperatriz
//   94 Patos · 95 Midway · 97 Teresina
// (Shopping Recife 98 já foi removido de todas as listas de varejo em 2026-07.)
import React from 'react';
import TitulosClientes from './TitulosClientes';

const VAREJO_BRANCHES = [2, 5, 55, 65, 87, 88, 90, 93, 94, 95, 97];

export default function TitulosClientesVarejo() {
  return (
    <TitulosClientes
      hardcodedBranches={VAREJO_BRANCHES}
      title="Portal de Títulos Varejo"
      subtitle="Consulta de títulos dos clientes das lojas próprias"
    />
  );
}
