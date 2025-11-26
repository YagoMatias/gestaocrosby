import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';

const RenegociacaoDividas = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#000638]">
            Renegociação de Dívidas
          </h1>
          <p className="text-gray-600 mt-2">
            Gerencie e renegocie as dívidas da sua franquia
          </p>
        </div>
      </div>
    </div>
  );
};

export default RenegociacaoDividas;
