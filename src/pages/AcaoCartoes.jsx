import React from 'react';
import PageTitle from '../components/ui/PageTitle';
import { CreditCard } from '@phosphor-icons/react';
import SEOHead from '../components/ui/SEOHead';

const AcaoCartoes = () => {
  return (
    <div className="w-full">
      <SEOHead
        title="Acão Cartões - Crosby"
        description="Análise detalhada da Ação dos Cartões"
      />

      <div className="max-w-7xl mx-auto p-6">
        <PageTitle
          title="Acão Cartões"
          subtitle="Dashboard completo da Ação dos Cartões"
          icon={CreditCard}
          iconColor="text-green-600"
        />
      </div>
    </div>
  );
};

export default AcaoCartoes;
