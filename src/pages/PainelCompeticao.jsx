// Painel Competição — placar de vendas dos 4 canais (Varejo, Revenda,
// Multimarcas, Franquias): campeões do mês e da semana + top 5 de cada canal,
// com link para o placar completo do canal (/forecast-canal/:canal).
// Auto-atualiza a cada 30 minutos.
import React from 'react';
import { Trophy } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { CompeticaoTodosCanais } from '../components/forecast/CompeticaoCanais';

export default function PainelCompeticao() {
  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-3 px-2 gap-4">
      <PageTitle
        title="Painel Competição"
        subtitle="Competição de vendas por canal"
        icon={Trophy}
        iconColor="text-[#000638]"
      />
      <CompeticaoTodosCanais />
    </div>
  );
}
