// Aba "Reunião" do varejo — container com sub-abas
// Inicialmente: "Competição"
// Futuro: outras métricas pra reuniões (ranking semanal, top vendedoras, etc)
import React, { useState } from 'react';
import { HandFist, TrendUp, Target, ChatCircle, Users, Hourglass, ChartPieSlice, Trophy, Megaphone } from 'phosphor-react';
import VarejoCompeticao from './VarejoCompeticao';
import VarejoCrescimento from './VarejoCrescimento';
import VarejoMetas from './VarejoMetas';
import VarejoConversao from './VarejoConversao';
import VarejoDesempenho from './VarejoDesempenho';
import VarejoAvisos from './VarejoAvisos';

const SUBABAS = [
  {
    id: 'competicao',
    label: 'Competição',
    icon: HandFist,
    color: 'text-red-600',
  },
  {
    id: 'crescimento',
    label: 'Crescimento',
    icon: TrendUp,
    color: 'text-emerald-600',
  },
  {
    id: 'metas',
    label: 'Metas',
    icon: Target,
    color: 'text-blue-700',
  },
  {
    id: 'conversao',
    label: 'Conversão',
    icon: ChartPieSlice,
    color: 'text-indigo-600',
  },
  {
    id: 'desempenho',
    label: 'Desempenho',
    icon: Trophy,
    color: 'text-yellow-600',
  },
  {
    id: 'avisos',
    label: 'Avisos',
    icon: Megaphone,
    color: 'text-indigo-600',
  },
];

export default function VarejoReuniao({ isAdmin, userLogin }) {
  const [subaba, setSubaba] = useState('competicao');

  return (
    <div className="space-y-4">
      {/* Sub-abas */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {SUBABAS.map((s) => {
          const Icon = s.icon;
          const active = subaba === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSubaba(s.id)}
              className={`px-4 py-2 inline-flex items-center gap-2 text-sm font-medium transition border-b-2 -mb-px ${
                active
                  ? `${s.color || 'text-blue-600'} border-current`
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} weight={active ? 'duotone' : 'regular'} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo da sub-aba */}
      {subaba === 'competicao' && (
        <VarejoCompeticao isAdmin={isAdmin} userLogin={userLogin} />
      )}
      {subaba === 'crescimento' && <VarejoCrescimento />}
      {subaba === 'metas' && <VarejoMetas />}
      {subaba === 'conversao' && <VarejoConversao />}
      {subaba === 'desempenho' && <VarejoDesempenho />}
      {subaba === 'avisos' && <VarejoAvisos />}
    </div>
  );
}
