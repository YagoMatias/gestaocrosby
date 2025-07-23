import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import Home from './pages/Home';
import Transacoes from './pages/Transacoes';
import ExtratoFinanceiro from './pages/ExtratoFinanceiro';
import ExtratoTOTVS from './pages/ExtratoTOTVS';
import Varejo from './pages/Varejo';
import Franquias from './pages/Franquias';
import Multimarcas from './pages/Multimarcas';
import Revenda from './pages/Revenda';
import ConsultaFatura from './pages/ConsultaFatura';
import FundoPropaganda from './pages/FundoPropaganda';
import RankingFaturamento from './pages/RankingFaturamento';
import React from 'react';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/transacoes" element={<PrivateRoute><Transacoes /></PrivateRoute>} />
        <Route path="/extrato-financeiro" element={<PrivateRoute><ExtratoFinanceiro /></PrivateRoute>} />
        <Route path="/extrato-totvs" element={<PrivateRoute><ExtratoTOTVS /></PrivateRoute>} />
        <Route path="/varejo" element={<PrivateRoute><Varejo /></PrivateRoute>} />
        <Route path="/franquias" element={<PrivateRoute><Franquias /></PrivateRoute>} />
        <Route path="/multimarcas" element={<PrivateRoute><Multimarcas /></PrivateRoute>} />
        <Route path="/revenda" element={<PrivateRoute><Revenda /></PrivateRoute>} />
        <Route path="/consulta-fatura" element={<PrivateRoute><ConsultaFatura /></PrivateRoute>} />
        <Route path="/fundo-propaganda" element={<PrivateRoute><FundoPropaganda /></PrivateRoute>} />
        <Route path="/ranking-faturamento" element={<PrivateRoute><RankingFaturamento /></PrivateRoute>} />
      </Routes>
    </Router>
  );
}

export default App;