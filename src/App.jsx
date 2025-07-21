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
import React from 'react';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/home" element={<Home />} />
        <Route path="/transacoes" element={<Transacoes />} />
        <Route path="/extrato-financeiro" element={<ExtratoFinanceiro />} />
        <Route path="/extrato-totvs" element={<ExtratoTOTVS />} />
        <Route path="/varejo" element={<Varejo />} />
        <Route path="/franquias" element={<Franquias />} />
        <Route path="/multimarcas" element={<Multimarcas />} />
        <Route path="/revenda" element={<Revenda />} />
        <Route path="/consulta-fatura" element={<ConsultaFatura />} />
        <Route path="/fundo-propaganda" element={<FundoPropaganda />} />
      </Routes>
    </Router>
  );
}

export default App;