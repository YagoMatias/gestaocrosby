import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Storefront,
  ArrowUUpLeft,
  Gear,
  Trophy,
  ChartLineUp,
} from '@phosphor-icons/react';
import { useAuth } from '../components/AuthContext';
import LoginNoticesModal from '../components/LoginNoticesModal';

// Atalhos mostrados só dentro do app de desktop (PDV Crosby em Electron, que
// expõe window.pdv). No site a Home continua como sempre foi.
const ATALHOS_PDV = [
  { nome: 'PDV Crosby', desc: 'Vender, trocar e emitir NFC-e', href: '/tecnologia/pdv-crosby', icon: Storefront, cor: 'text-emerald-600 bg-emerald-50' },
  { nome: 'Devoluções de Mercadoria', desc: 'Abrir, conferir e gerar no TOTVS', href: '/devolucoes-mercadoria', icon: ArrowUUpLeft, cor: 'text-rose-600 bg-rose-50' },
  { nome: 'Configurações dos Aparelhos', desc: 'Impressora, RFID portal, RFID .bat e TEF', href: '/tecnologia/pdv-perifericos', icon: Gear, cor: 'text-slate-700 bg-slate-100' },
  { nome: 'Ranking de Faturamento', desc: 'Desempenho das lojas', href: '/ranking-faturamento', icon: Trophy, cor: 'text-amber-600 bg-amber-50' },
  { nome: 'New Forecast', desc: 'Previsto x realizado e projeção', href: '/new-forecast', icon: ChartLineUp, cor: 'text-cyan-700 bg-cyan-50' },
];

const Home = () => {
  const { user } = useAuth();
  const [showNoticesModal, setShowNoticesModal] = useState(true);
  const noApp = typeof window !== 'undefined' && !!window.pdv;
  // app Android "Balanço RFID": a Home é a própria tela de contagem
  const noAppBalanco = typeof window !== 'undefined' && !!window.HeadcoachRfid;
  const podeVer = (href) =>
    user?.allowedPages === '*' ||
    (Array.isArray(user?.allowedPages) && user.allowedPages.includes(href));

  if (noAppBalanco) return <Navigate to="/balanco-rfid" replace />;

  return (
    <>
      {/* Modal de avisos ao fazer login */}
      {showNoticesModal && (
        <LoginNoticesModal onClose={() => setShowNoticesModal(false)} />
      )}

      <div className="justify-center w-4/5 bg-white rounded-2xl shadow-2xl p-8 flex flex-col md:flex-row items-center gap-8 mt-8 mx-auto">
        <div className="flex-1 flex flex-col items-center md:items-start">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-[#000638] text-center md:text-left font-barlow">
            Bem-vindo {user?.name.split(' ')[0]}!
          </h1>
          <p className="text-lg md:text-2xl text-gray-700 mb-6 text-center md:text-left font-barlow">
            {noApp
              ? 'Você está no PDV CROSBY — HEADCOACH.'
              : 'Você está logado no sistema HEADCOACH CROSBY.'}
          </p>
        </div>
        <div className="flex-1 flex justify-center">
          <img src="/crosbyazul.png" alt="Logo" className="w-40 md:w-72" />
        </div>
      </div>

      {noApp && (
        <div className="w-4/5 mx-auto mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ATALHOS_PDV.filter((a) => podeVer(a.href)).map(({ nome, desc, href, icon: Icon, cor }) => (
            <Link
              key={href}
              to={href}
              className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex items-start gap-4 hover:-translate-y-0.5 hover:shadow-xl transition"
            >
              <div className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 ${cor}`}>
                <Icon size={26} weight="duotone" />
              </div>
              <div>
                <h3 className="font-barlow font-bold text-[#000638] text-lg leading-tight">{nome}</h3>
                <p className="text-sm text-gray-500 mt-1">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default Home;
