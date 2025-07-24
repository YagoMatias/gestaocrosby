import React from 'react';
import Layout from '../components/Layout';

const Consolidado = () => {
  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Consolidado</h1>
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-700">
          <p>Bem-vindo à página Consolidado!<br/>Aqui você poderá visualizar o consolidado de CMV, faturamento e outros indicadores.</p>
        </div>
      </div>
    </Layout>
  );
};

export default Consolidado; 