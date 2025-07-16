import React from 'react';
import Layout from '../components/Layout';

const Home = () => (
  <Layout>
    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-8 flex flex-col md:flex-row items-center gap-8 mt-8">
      <div className="flex-1 flex flex-col items-center md:items-start">
        <h1 className="text-3xl md:text-5xl font-bold mb-4 text-[#000638] text-center md:text-left">Bem-vindo!</h1>
        <p className="text-lg md:text-2xl text-gray-700 mb-6 text-center md:text-left">Você está logado no sistema Gestão Crosby.</p>
      </div>
      <div className="flex-1 flex justify-center">
        <img src="/crosbyazul.png" alt="Logo" className="w-40 md:w-72" />
      </div>
    </div>
  </Layout>
);

export default Home; 