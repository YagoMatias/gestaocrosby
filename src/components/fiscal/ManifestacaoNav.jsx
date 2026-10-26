import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartBar, ClipboardText } from '@phosphor-icons/react';

// Navegação da Manifestação do Destinatário (pedido da Niziany, 26/10/2026,
// no modelo do Dryland): "Painel" = resumo por empresa; "Pendentes" = a
// relação das notas emitidas contra os CNPJs.
const ITENS = [
  {
    key: 'painel',
    label: 'Painel',
    href: '/fiscal/escrituracao-por-empresa',
    icon: ChartBar,
  },
  {
    key: 'pendentes',
    label: 'Pendentes',
    href: '/manifestacao-destinatario',
    icon: ClipboardText,
  },
];

export default function ManifestacaoNav({ ativo }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap justify-center gap-2 mb-1">
      {ITENS.map(({ key, label, href, icon: Icon }) => {
        const on = ativo === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => !on && navigate(href)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border transition font-barlow ${
              on
                ? 'bg-[#000638] text-white border-[#000638] shadow'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#000638] hover:text-[#000638]'
            }`}
          >
            <Icon size={14} weight={on ? 'fill' : 'regular'} /> {label}
          </button>
        );
      })}
    </div>
  );
}
