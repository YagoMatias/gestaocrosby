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
import Consolidado from './pages/Consolidado';
import React from 'react';
import PrivateRoute from './components/PrivateRoute';
import ComprasFranquias from './pages/ComprasFranquias';
import PainelAdmin from './pages/PainelAdmin';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/home" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR', 'FINANCEIRO', 'FRANQUIA']}><Home /></PrivateRoute>} />
        <Route path="/transacoes" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR', 'FINANCEIRO']}><Transacoes /></PrivateRoute>} />
        <Route path="/extrato-financeiro" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR', 'FINANCEIRO']}><ExtratoFinanceiro /></PrivateRoute>} />
        <Route path="/extrato-totvs" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR', 'FINANCEIRO']}><ExtratoTOTVS /></PrivateRoute>} />
        <Route path="/varejo" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR']}><Varejo /></PrivateRoute>} />
        <Route path="/franquias" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR']}><Franquias /></PrivateRoute>} />
        <Route path="/multimarcas" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR']}><Multimarcas /></PrivateRoute>} />
        <Route path="/revenda" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR']}><Revenda /></PrivateRoute>} />
        <Route path="/consulta-fatura" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR', 'FINANCEIRO']}><ConsultaFatura /></PrivateRoute>} />
        <Route path="/fundo-propaganda" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR', 'FINANCEIRO']}><FundoPropaganda /></PrivateRoute>} />
        <Route path="/ranking-faturamento" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR', 'FRANQUIA']}><RankingFaturamento /></PrivateRoute>} />
        <Route path="/consolidado" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR']}><Consolidado /></PrivateRoute>} />
        <Route path="/compras-franquias" element={<PrivateRoute allowedRoles={['ADM', 'DIRETOR']}><ComprasFranquias /></PrivateRoute>} />
        <Route path="/painel-admin" element={<PrivateRoute allowedRoles={['ADM']}><PainelAdmin /></PrivateRoute>} />
      </Routes>
    </Router>
  );
}

export default App;