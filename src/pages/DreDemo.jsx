import React from 'react';
import Layout from '../components/Layout';
import { 
  Wrench
} from '@phosphor-icons/react';

const DreDemo = () => {
  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center py-16">
        <h1 className="text-3xl font-bold mb-8 text-center text-[#000638]">
          DRE - Demonstração do Resultado do Exercício
        </h1>

        {/* Card de Em Desenvolvimento */}
        <div className="bg-white p-12 rounded-2xl shadow-lg border border-[#000638]/10 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-6">
              <Wrench 
                size={64} 
                className="text-[#fe0000] animate-spin" 
                style={{ 
                  animation: 'spin 2s linear infinite'
                }}
              />
            </div>
            
            <h2 className="text-2xl font-bold text-[#000638] mb-2">
              Em Desenvolvimento
            </h2>
            
            <p className="text-gray-600 text-lg">
              Esta funcionalidade está sendo construída e estará disponível em breve.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DreDemo;