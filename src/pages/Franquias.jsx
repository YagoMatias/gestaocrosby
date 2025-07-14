import React from 'react';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const Franquias = () => {
  return (
    <Layout>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
            <h1 className="text-3xl font-bold mb-6 text-center">Faturamento - Franquias</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-center">
                Conteúdo da página Franquias será implementado aqui.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Franquias; 