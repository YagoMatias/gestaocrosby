// Página: Financeiro → Dr Ygor → Extratos Bancários
// Mesmo módulo do Extrato Bancário (FluxoCaixaExt), preso ao escopo 'dr_ygor':
// contas, importações, lançamentos e transferências ficam separados dos
// extratos do grupo Crosby. Serve para conferir as retiradas/repasses do
// Dr Ygor Dantas (contestação das retiradas de 2025).
// Backend: /api/dr-ygor/extratos-bancarios (routes/fluxoCaixaExt.routes.js → criarRouter('dr_ygor')).
import React from 'react';
import FluxoCaixaExt from './FluxoCaixaExt';

const DrYgorExtratosBancarios = () => (
  <FluxoCaixaExt
    escopo="dr_ygor"
    titulo="Dr Ygor · Extratos Bancários"
    subtitulo="Extratos das contas ligadas ao Dr Ygor Dantas, separados dos extratos do grupo: tudo que entrou, tudo que saiu (retiradas e repasses) e as transferências entre as contas importadas aqui"
    mostrarBot={false}
  />
);

export default DrYgorExtratosBancarios;
