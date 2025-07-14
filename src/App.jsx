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
        <Route path="/faturamento/varejo" element={<Varejo />} />
        <Route path="/faturamento/franquias" element={<Franquias />} />
        <Route path="/faturamento/multimarcas" element={<Multimarcas />} />
        <Route path="/faturamento/revenda" element={<Revenda />} />
      </Routes>
    </Router>
  );
}

export default App;