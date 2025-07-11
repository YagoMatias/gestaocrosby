import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import Home from './pages/Home';
import Transacoes from './pages/Transacoes';
import ExtratoFinanceiro from './pages/ExtratoFinanceiro';
import React from 'react';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/home" element={<Home />} />
        <Route path="/transacoes" element={<Transacoes />} />
        <Route path="/extrato-financeiro" element={<ExtratoFinanceiro />} />
      </Routes>
    </Router>
  );
}

export default App;