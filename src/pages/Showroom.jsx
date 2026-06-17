// Showroom — página com tabs internas (Pedidos do Wix por enquanto;
// futuras: agenda, expedição, etc).
import React, { useState } from 'react';
import { Storefront, Package, ShoppingCart } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import ShowroomPedidos from './ShowroomPedidos';
import ShowroomCarrinhos from './ShowroomCarrinhos';

const TABS = [
  { v: 'pedidos', label: 'Pedidos', icon: Package },
  { v: 'carrinhos', label: 'Carrinhos Abandonados', icon: ShoppingCart },
];

export default function Showroom() {
  const [aba, setAba] = useState('pedidos');
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 py-6">
      <div className="max-w-7xl mx-auto px-6">
        <PageTitle
          title="Showroom"
          subtitle="Pedidos online, agenda e expedição do showroom Crosby"
          icon={Storefront}
        />

        {/* Abas */}
        <div className="flex items-center gap-2 mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const ativo = aba === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setAba(t.v)}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  ativo
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Icon size={16} weight={ativo ? 'duotone' : 'regular'} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo da aba */}
        {aba === 'pedidos' && <ShowroomPedidos />}
        {aba === 'carrinhos' && <ShowroomCarrinhos />}
      </div>
    </div>
  );
}
