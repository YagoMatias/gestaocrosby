// Forecast — menu novo abaixo do DRE, pedido da Niziany (27/10/2026).
// Por enquanto só a tela base; o conteúdo vem com as orientações dela.
import React from 'react';
import { ChartLineUp } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';

export default function Forecast() {
  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-3 px-2 gap-4">
      <PageTitle
        title="Forecast"
        subtitle="Projeções e acompanhamento"
        icon={ChartLineUp}
        iconColor="text-[#000638]"
      />
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-sm text-gray-600">
        <p className="font-semibold text-gray-800 mb-1">Tela em construção</p>
        <p>
          O menu Forecast foi criado. O conteúdo desta página será montado
          conforme as orientações do fiscal.
        </p>
      </div>
    </div>
  );
}
