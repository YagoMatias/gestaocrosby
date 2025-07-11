import React, { useState } from 'react';
import { House, CurrencyDollar, ChartBar, GraduationCap, Trophy, X, CaretDown, CaretUp, Bank, CreditCard, Receipt, FileText } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', icon: <House size={20} weight="duotone" />, to: '/home' },
  { label: 'Transações', icon: <CurrencyDollar size={20} weight="duotone" />, to: '/transacoes' },
  // Financeiro será tratado separadamente como dropdown
  { label: 'Trainings', icon: <GraduationCap size={20} weight="duotone" /> },
  { label: 'Competitions', icon: <Trophy size={20} weight="duotone" /> },
];

const financeiroSubItems = [
  { label: 'Extrato Financeiro', icon: <Bank size={18} />, to: '/extrato-financeiro' },
  { label: 'Extrato TOTVS', icon: <Bank size={18} />, to: '/extrato-totvs' },
  { label: 'Contas a Pagar', icon: <CreditCard size={18} />, to: '#' },
  { label: 'Contas a Receber', icon: <Receipt size={18} />, to: '#' },
  { label: 'DRE', icon: <FileText size={18} />, to: '#' },
];

const Sidebar = ({ open = false, onClose }) => {
  const [financeiroOpen, setFinanceiroOpen] = useState(false);

  return (
    <aside
      className={`bg-white border-r border-gray-200 w-60 min-h-screen flex flex-col py-6 px-3 fixed left-0 top-0 z-10
        transition-transform duration-300 md:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:block`}
      style={{ boxShadow: open ? '2px 0 8px rgba(0,0,0,0.04)' : 'none' }}
    >
      {/* Botão de fechar no mobile/tablet */}
      <div className="flex items-center justify-between mb-8 px-2">
        <img src="/crosbyazul.png" alt="Logo" />
        <button
          className="md:hidden p-2 rounded focus:outline-none hover:bg-gray-100"
          onClick={onClose}
          aria-label="Fechar menu"
          type="button"
        >
          <X size={24} color="#555" weight="bold" />
        </button>
      </div>
      <div className="flex flex-col flex-1">
        <nav>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.label}>
                {item.to ? (
                  <Link
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-black`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <a
                    href="#"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-black`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </a>
                )}
              </li>
            ))}
            {/* Dropdown Financeiro */}
            <li>
              <button
                type="button"
                className="flex items-center w-full gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-black focus:outline-none"
                onClick={() => setFinanceiroOpen((open) => !open)}
              >
                <ChartBar size={20} weight="duotone" />
                <span>Financeiro</span>
                {financeiroOpen ? <CaretUp size={16} /> : <CaretDown size={16} />}
              </button>
              {financeiroOpen && (
                <ul className="ml-7 mt-1 space-y-1">
                  {financeiroSubItems.map((sub) => (
                    <li key={sub.label}>
                      {sub.to && sub.to !== '#' ? (
                        <Link
                          to={sub.to}
                          className="flex items-center gap-2 px-2 py-1 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-black text-sm font-normal"
                        >
                          {sub.icon}
                          <span>{sub.label}</span>
                        </Link>
                      ) : (
                        <a
                          href={sub.to}
                          className="flex items-center gap-2 px-2 py-1 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-black text-sm font-normal"
                        >
                          {sub.icon}
                          <span>{sub.label}</span>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar; 