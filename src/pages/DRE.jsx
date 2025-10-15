import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  CaretDown,
  CaretRight,
  Dot,
  TrendUp,
  TrendDown,
  CurrencyDollar,
  Folder,
  FileText,
  Funnel,
} from '@phosphor-icons/react';
import { getCategoriaPorCodigo } from '../config/categoriasDespesas';

const DRE = () => {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState('');
  const [vendasBrutas, setVendasBrutas] = useState(0);
  const [devolucoes, setDevolucoes] = useState(0);
  const [descontos, setDescontos] = useState(0);
  const [totalDeducoes, setTotalDeducoes] = useState(0);
  const [cmv, setCmv] = useState(0);
  const [receitaLiquida, setReceitaLiquida] = useState(0);
  const [lucroBruto, setLucroBruto] = useState(0);

  // Estados para totais por canal
  const [totaisVarejo, setTotaisVarejo] = useState({
    totalBruto: 0,
    totalDevolucoes: 0,
    totalCMV: 0,
    totalLiquido: 0,
  });
  const [totaisMultimarcas, setTotaisMultimarcas] = useState({
    totalBruto: 0,
    totalDevolucoes: 0,
    totalCMV: 0,
    totalLiquido: 0,
  });
  const [totaisFranquias, setTotaisFranquias] = useState({
    totalBruto: 0,
    totalDevolucoes: 0,
    totalCMV: 0,
    totalLiquido: 0,
  });
  const [totaisRevenda, setTotaisRevenda] = useState({
    totalBruto: 0,
    totalDevolucoes: 0,
    totalCMV: 0,
    totalLiquido: 0,
  });
  // Despesas Operacionais (Contas a Pagar - Emissão)
  const [planoDespesasNodes, setPlanoDespesasNodes] = useState([]);
  const [planoDespesasTotal, setPlanoDespesasTotal] = useState(0);
  // Despesas Financeiras separadas do plano de despesas
  const [planoDespesasFinanceirasNodes, setPlanoDespesasFinanceirasNodes] =
    useState([]);
  const [planoDespesasFinanceirasTotal, setPlanoDespesasFinanceirasTotal] =
    useState(0);

  // Lista de despesas (cd_despesaitem) a serem excluídas do cálculo/visualização
  const [despesasExcluidas, setDespesasExcluidas] = useState(
    new Set([
      117, 124, 270, 271, 272, 5006, 5007, 5013, 5014, 11006, 11008, 11004,
      11003, 11009, 11009, 11007, 11005, 11001, 14000, 13000,
    ]),
  );

  // Utilitário: verifica se um código de despesa deve ser excluído
  const shouldExcluirDespesa = (cd) => {
    const n = Number(cd);
    if (Number.isNaN(n)) return false;
    return despesasExcluidas.has(n);
  };

  // API simples para gerenciar exclusões (pode ser chamada de outras partes da app)
  const excluirDespesaPorCodigo = (codigos) => {
    setDespesasExcluidas((prev) => {
      const next = new Set(prev);
      (Array.isArray(codigos) ? codigos : [codigos]).forEach((c) => {
        const n = Number(c);
        if (!Number.isNaN(n)) next.add(n);
      });
      return next;
    });
  };

  const definirDespesasExcluidas = (lista) => {
    const next = new Set(
      (lista || []).map((c) => Number(c)).filter((n) => !Number.isNaN(n)),
    );
    setDespesasExcluidas(next);
  };

  const limparDespesasExcluidas = () => setDespesasExcluidas(new Set());

  // Estados para impostos reais
  const [icms, setIcms] = useState(0);
  const [pis, setPis] = useState(0);
  const [cofins, setCofins] = useState(0);
  const [totalImpostos, setTotalImpostos] = useState(0);

  // Estados para impostos por canal
  const [impostosVarejo, setImpostosVarejo] = useState({
    icms: 0,
    pis: 0,
    cofins: 0,
  });
  const [impostosMultimarcas, setImpostosMultimarcas] = useState({
    icms: 0,
    pis: 0,
    cofins: 0,
  });
  const [impostosFranquias, setImpostosFranquias] = useState({
    icms: 0,
    pis: 0,
    cofins: 0,
  });
  const [impostosRevenda, setImpostosRevenda] = useState({
    icms: 0,
    pis: 0,
    cofins: 0,
  });

  // Estados para receitas líquidas por canal
  const [receitaLiquidaVarejo, setReceitaLiquidaVarejo] = useState(0);
  const [receitaLiquidaMultimarcas, setReceitaLiquidaMultimarcas] = useState(0);
  const [receitaLiquidaFranquias, setReceitaLiquidaFranquias] = useState(0);
  const [receitaLiquidaRevenda, setReceitaLiquidaRevenda] = useState(0);

  // Estados para CMV por canal
  const [cmvVarejo, setCmvVarejo] = useState(0);
  const [cmvMultimarcas, setCmvMultimarcas] = useState(0);
  const [cmvFranquias, setCmvFranquias] = useState(0);
  const [cmvRevenda, setCmvRevenda] = useState(0);

  // Estados para lucro bruto por canal
  const [lucroBrutoVarejo, setLucroBrutoVarejo] = useState(0);
  const [lucroBrutoMultimarcas, setLucroBrutoMultimarcas] = useState(0);
  const [lucroBrutoFranquias, setLucroBrutoFranquias] = useState(0);
  const [lucroBrutoRevenda, setLucroBrutoRevenda] = useState(0);
  const [periodo, setPeriodo] = useState({
    dt_inicio: '',
    dt_fim: '',
    empresas: [1, 2, 3, 4, 5], // Empresas padrão
  });
  const [filtroMensal, setFiltroMensal] = useState('ANO');

  const obterDiasDoMes = (mesNumero, anoNumero) => {
    // Retorna o último dia do mês considerando ano bissexto
    return new Date(anoNumero, mesNumero, 0).getDate();
  };

  const handleFiltroMensalChange = (mesSigla) => {
    setFiltroMensal(mesSigla);
    if (mesSigla === 'ANO') return; // Não altera datas diretamente

    const mesesMap = {
      JAN: 1,
      FEV: 2,
      MAR: 3,
      ABR: 4,
      MAI: 5,
      JUN: 6,
      JUL: 7,
      AGO: 8,
      SET: 9,
      OUT: 10,
      NOV: 11,
      DEZ: 12,
    };

    const mesNumero = mesesMap[mesSigla];
    if (!mesNumero) return;

    const anoBase = (() => {
      if (periodo.dt_inicio) {
        const [y] = periodo.dt_inicio.split('-');
        const n = parseInt(y, 10);
        if (n > 1900) return n;
      }
      return new Date().getFullYear();
    })();

    const primeiroDia = `${anoBase}-${String(mesNumero).padStart(2, '0')}-01`;
    const ultimoDiaNum = obterDiasDoMes(mesNumero, anoBase);
    const ultimoDia = `${anoBase}-${String(mesNumero).padStart(
      2,
      '0',
    )}-${String(ultimoDiaNum).padStart(2, '0')}`;

    setPeriodo((prev) => ({
      ...prev,
      dt_inicio: primeiroDia,
      dt_fim: ultimoDia,
    }));
  };

  const [expandedNodes, setExpandedNodes] = useState({
    'vendas-bruta': true,
    'deducoes-vendas': true,
    'impostos-vendas': true,
    'receita-liquida': true,
    'lucro-bruto': true,
    'despesas-operacionais': true,
    'resultado-operacional': true,
    'outras-receitas-despesas': true,
    'despesas-financeiras': true,
    'lucro-antes-impostos': true,
    'impostos-lucro': true,
    'lucro-liquido': true,
  });

  // Estados para controle de expansão no estilo Contas a Pagar
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(new Set());
  const [todosExpandidos, setTodosExpandidos] = useState(false);

  // Inicializar período padrão
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    setPeriodo((prev) => ({
      ...prev,
      dt_inicio: primeiroDia,
      dt_fim: ultimoDia,
    }));
  }, []);

  // Função para buscar vendas brutas das 4 rotas de Faturamento Materializadas
  const buscarVendasBrutas = useCallback(async () => {
    if (!periodo.dt_inicio || !periodo.dt_fim) return;

    setLoading(true);
    setError('');

    try {
      // Parâmetros padronizados para as novas rotas materializadas
      const paramsFaturamento = {
        dataInicio: periodo.dt_inicio,
        dataFim: periodo.dt_fim,
      };

      // Parâmetros para as rotas de CMV (mantidas para calcular CMV)
      const empresasFixas = [
        91, 2, 5, 6, 7, 11, 31, 55, 65, 75, 85, 90, 91, 92, 93, 94, 95, 96, 97,
        98, 99,
      ];
      const empresasVarejo = [
        2, 5, 55, 65, 90, 91, 92, 93, 94, 95, 96, 97, 98, 200, 500, 550, 650,
        890, 910, 920, 930, 940, 950, 960, 970, 980,
      ];

      const paramsCMVVarejo = {
        dataInicio: periodo.dt_inicio,
        dataFim: periodo.dt_fim,
        cd_grupoempresa: empresasVarejo,
      };

      const paramsCMVMultimarcas = {
        dataInicio: periodo.dt_inicio,
        dataFim: periodo.dt_fim,
        cd_grupoempresa: empresasFixas,
      };

      const paramsCMVFranquias = {
        dataInicio: periodo.dt_inicio,
        dataFim: periodo.dt_fim,
        cd_grupoempresa: empresasFixas,
      };

      const paramsCMVRevenda = {
        dataInicio: periodo.dt_inicio,
        dataFim: periodo.dt_fim,
        cd_grupoempresa: empresasFixas,
      };

      // Buscar dados de FATURAMENTO (Receitas) das 4 rotas materializadas
      setLoadingStatus('Buscando dados de faturamento do Varejo...');
      const faturamentoVarejo = await api.sales.faturamentoVarejo(
        paramsFaturamento,
      );

      setLoadingStatus('Buscando dados de faturamento do Multimarcas...');
      const faturamentoMultimarcas = await api.sales.faturamentoMtm(
        paramsFaturamento,
      );

      setLoadingStatus('Buscando dados de faturamento das Franquias...');
      const faturamentoFranquias = await api.sales.faturamentoFranquias(
        paramsFaturamento,
      );

      setLoadingStatus('Buscando dados de faturamento da Revenda...');
      const faturamentoRevenda = await api.sales.faturamentoRevenda(
        paramsFaturamento,
      );

      // Buscar dados de CMV das 4 rotas materializadas (para calcular CMV)
      setLoadingStatus('Buscando CMV do Varejo...');
      const cmvVarejo = await api.sales.cmvVarejo(paramsCMVVarejo);

      setLoadingStatus('Buscando CMV do Multimarcas...');
      const cmvMultimarcas = await api.sales.cmvMultimarcas(
        paramsCMVMultimarcas,
      );

      setLoadingStatus('Buscando CMV das Franquias...');
      const cmvFranquias = await api.sales.cmvFranquias(paramsCMVFranquias);

      setLoadingStatus('Buscando CMV da Revenda...');
      const cmvRevenda = await api.sales.cmvRevenda(paramsCMVRevenda);

      setLoadingStatus('Processando dados...');

      // Calcular dados de faturamento usando views materializadas
      // Estrutura das views: valor_sem_desconto, valor_com_desconto,
      //                      valor_sem_desconto_saida, valor_sem_desconto_entrada,
      //                      valor_com_desconto_saida, valor_com_desconto_entrada
      const calcularDadosFaturamento = (responseFaturamento) => {
        if (!responseFaturamento?.success || !responseFaturamento?.data)
          return {
            receitaBruta: 0, // valor_sem_desconto (SOMA TOTAL)
            devolucoesBrutas: 0, // valor_sem_desconto_entrada
            receitaLiquida: 0, // valor_com_desconto
            devolucoesLiquidas: 0, // valor_com_desconto_entrada
            descontos: 0, // valor_sem_desconto - valor_com_desconto
          };

        const data = Array.isArray(responseFaturamento.data)
          ? responseFaturamento.data
          : [];

        let receitaBruta = 0;
        let devolucoesBrutas = 0;
        let receitaLiquida = 0;
        let devolucoesLiquidas = 0;

        for (const row of data) {
          // RECEITAS BRUTAS = apenas a coluna VALOR_SEM_DESCONTO (soma total)
          receitaBruta += parseFloat(row?.valor_sem_desconto || 0);

          // Outros valores da view materializada
          devolucoesBrutas += parseFloat(row?.valor_sem_desconto_entrada || 0);
          receitaLiquida += parseFloat(row?.valor_com_desconto || 0);
          devolucoesLiquidas += parseFloat(
            row?.valor_com_desconto_entrada || 0,
          );
        }

        // Descontos = Receita Bruta - Receita Líquida (direto da diferença das colunas)
        const descontos = receitaBruta - receitaLiquida;

        return {
          receitaBruta,
          devolucoesBrutas,
          receitaLiquida,
          devolucoesLiquidas,
          descontos,
        };
      };

      // Calcular CMV usando views materializadas de CMV
      // CUSTO DE MERCADORIA VENDIDA = somatório apenas da coluna CMV
      const calcularCMV = (responseCMV) => {
        if (!responseCMV?.success || !responseCMV?.data)
          return {
            cmv: 0,
            produtosSaida: 0,
            produtosEntrada: 0,
          };

        const data = Array.isArray(responseCMV.data) ? responseCMV.data : [];

        let cmvTotal = 0;
        let produtosSaida = 0;
        let produtosEntrada = 0;

        for (const row of data) {
          // CMV Total = somatório da coluna 'cmv' das views materializadas
          cmvTotal += parseFloat(row?.cmv || 0);
          produtosSaida += parseFloat(row?.produtos_saida || 0);
          produtosEntrada += parseFloat(row?.produtos_entrada || 0);
        }

        return {
          cmv: cmvTotal,
          produtosSaida,
          produtosEntrada,
        };
      };

      // Calcular dados de faturamento por canal
      const dadosFaturamentoVarejo =
        calcularDadosFaturamento(faturamentoVarejo);
      const dadosFaturamentoMultimarcas = calcularDadosFaturamento(
        faturamentoMultimarcas,
      );
      const dadosFaturamentoFranquias =
        calcularDadosFaturamento(faturamentoFranquias);
      const dadosFaturamentoRevenda =
        calcularDadosFaturamento(faturamentoRevenda);

      // Calcular CMV por canal
      const dadosCMVVarejo = calcularCMV(cmvVarejo);
      const dadosCMVMultimarcas = calcularCMV(cmvMultimarcas);
      const dadosCMVFranquias = calcularCMV(cmvFranquias);
      const dadosCMVRevenda = calcularCMV(cmvRevenda);

      // ========== RECEITAS BRUTAS ==========
      // Receita Bruta = Soma das saídas sem desconto de todos os canais
      const totalReceitaBruta =
        dadosFaturamentoVarejo.receitaBruta +
        dadosFaturamentoMultimarcas.receitaBruta +
        dadosFaturamentoFranquias.receitaBruta +
        dadosFaturamentoRevenda.receitaBruta;

      // Vendas Brutas (para DRE) = Receita Bruta (saídas sem desconto)
      const totalVendasBrutas = totalReceitaBruta;

      // ========== DEDUÇÕES SOBRE VENDAS ==========

      // 1) DEVOLUÇÕES = Soma das devoluções líquidas (com desconto já aplicado)
      const totalDevolucoesLiquidas =
        dadosFaturamentoVarejo.devolucoesLiquidas +
        dadosFaturamentoMultimarcas.devolucoesLiquidas +
        dadosFaturamentoFranquias.devolucoesLiquidas +
        dadosFaturamentoRevenda.devolucoesLiquidas;

      // 2) DESCONTOS CONCEDIDOS = Soma dos descontos de todos os canais
      const totalDescontos =
        dadosFaturamentoVarejo.descontos +
        dadosFaturamentoMultimarcas.descontos +
        dadosFaturamentoFranquias.descontos +
        dadosFaturamentoRevenda.descontos;

      // Receita Líquida (antes dos impostos) = Soma das saídas com desconto
      const totalReceitaLiquidaSemImpostos =
        dadosFaturamentoVarejo.receitaLiquida +
        dadosFaturamentoMultimarcas.receitaLiquida +
        dadosFaturamentoFranquias.receitaLiquida +
        dadosFaturamentoRevenda.receitaLiquida;

      // ========== CMV ==========
      // CUSTO DE MERCADORIA VENDIDA = somatório da coluna 'cmv' das views materializadas
      // Rotas utilizadas: cmv-varejo, cmv-multimarcas, cmv-franquias, cmv-revenda
      const totalCMV =
        dadosCMVVarejo.cmv +
        dadosCMVMultimarcas.cmv +
        dadosCMVFranquias.cmv +
        dadosCMVRevenda.cmv;

      console.log('📊 CMV calculado das views materializadas:', {
        varejo: dadosCMVVarejo.cmv,
        multimarcas: dadosCMVMultimarcas.cmv,
        franquias: dadosCMVFranquias.cmv,
        revenda: dadosCMVRevenda.cmv,
        total: totalCMV,
        observacao:
          'Usa apenas a coluna CMV das views cmv_varejo, cmv_mtm, cmv_franquias, cmv_revenda',
      });

      // Criar estrutura de totais por canal para compatibilidade com o resto do código
      const totaisVarejo = {
        totalBruto: dadosFaturamentoVarejo.receitaBruta,
        totalDevolucoes: dadosFaturamentoVarejo.devolucoesLiquidas,
        totalLiquido: dadosFaturamentoVarejo.receitaLiquida,
        totalCMV: dadosCMVVarejo.cmv,
        descontos: dadosFaturamentoVarejo.descontos,
      };

      const totaisMultimarcas = {
        totalBruto: dadosFaturamentoMultimarcas.receitaBruta,
        totalDevolucoes: dadosFaturamentoMultimarcas.devolucoesLiquidas,
        totalLiquido: dadosFaturamentoMultimarcas.receitaLiquida,
        totalCMV: dadosCMVMultimarcas.cmv,
        descontos: dadosFaturamentoMultimarcas.descontos,
      };

      const totaisFranquias = {
        totalBruto: dadosFaturamentoFranquias.receitaBruta,
        totalDevolucoes: dadosFaturamentoFranquias.devolucoesLiquidas,
        totalLiquido: dadosFaturamentoFranquias.receitaLiquida,
        totalCMV: dadosCMVFranquias.cmv,
        descontos: dadosFaturamentoFranquias.descontos,
      };

      const totaisRevenda = {
        totalBruto: dadosFaturamentoRevenda.receitaBruta,
        totalDevolucoes: dadosFaturamentoRevenda.devolucoesLiquidas,
        totalLiquido: dadosFaturamentoRevenda.receitaLiquida,
        totalCMV: dadosCMVRevenda.cmv,
        descontos: dadosFaturamentoRevenda.descontos,
      };

      // ========== IMPOSTOS ZERADOS ==========
      // Impostos configurados como zero (rotas antigas de CMV removidas)
      setLoadingStatus('Configurando impostos...');

      const impostosZerados = { icms: 0, pis: 0, cofins: 0 };

      // Atualizar estados com impostos zerados por canal
      setImpostosVarejo(impostosZerados);
      setImpostosMultimarcas(impostosZerados);
      setImpostosFranquias(impostosZerados);
      setImpostosRevenda(impostosZerados);

      // Totais gerais (todos zerados)
      const icmsReal = 0;
      const pisReal = 0;
      const cofinsReal = 0;
      const totalImpostosReal = 0;

      console.log('💰 Impostos zerados (rotas antigas de CMV removidas):', {
        varejo: impostosZerados,
        multimarcas: impostosZerados,
        franquias: impostosZerados,
        revenda: impostosZerados,
        totais: {
          icms: icmsReal,
          pis: pisReal,
          cofins: cofinsReal,
          total: totalImpostosReal,
        },
      });

      // ========== CÁLCULO FINAL DA DRE ==========

      // Total das Deduções = Devoluções Líquidas + Descontos Concedidos + Impostos
      const totalDeducoesCalculado =
        totalDevolucoesLiquidas + totalDescontos + totalImpostosReal;

      console.log(
        '📊 Cálculo das Deduções sobre Vendas (Views Materializadas):',
        {
          devolucoes: totalDevolucoesLiquidas,
          descontos: totalDescontos,
          impostos: totalImpostosReal,
          totalDeducoes: totalDeducoesCalculado,
          formula: 'Devoluções Líquidas + Descontos Concedidos + Impostos',
          detalhamento: {
            vendas_brutas: totalVendasBrutas,
            devolucoes_liquidas: totalDevolucoesLiquidas,
            descontos_concedidos: totalDescontos,
            impostos: totalImpostosReal,
          },
        },
      );

      // Receita Líquida = Vendas Brutas - Deduções
      const receitaLiquidaCalculada =
        totalVendasBrutas - totalDeducoesCalculado;

      // Lucro Bruto = Receita Líquida - CMV
      const lucroBrutoCalculado = receitaLiquidaCalculada - totalCMV;

      // ================= CÁLCULOS POR CANAL =================

      // Calcular receitas líquidas por canal
      // Receita Líquida = Receita Bruta - (Devoluções + Descontos + Impostos)
      const receitaLiquidaVarejoCalc =
        totaisVarejo.totalBruto -
        (totaisVarejo.totalDevolucoes + totaisVarejo.descontos + 0 + 0 + 0);

      const receitaLiquidaMultimarcasCalc =
        totaisMultimarcas.totalBruto -
        (totaisMultimarcas.totalDevolucoes +
          totaisMultimarcas.descontos +
          0 +
          0 +
          0);

      const receitaLiquidaFranquiasCalc =
        totaisFranquias.totalBruto -
        (totaisFranquias.totalDevolucoes +
          totaisFranquias.descontos +
          0 +
          0 +
          0);

      const receitaLiquidaRevendaCalc =
        totaisRevenda.totalBruto -
        (totaisRevenda.totalDevolucoes + totaisRevenda.descontos + 0 + 0 + 0);

      // CMV por canal (já calculado)
      const cmvVarejoCalc = totaisVarejo.totalCMV;
      const cmvMultimarcasCalc = totaisMultimarcas.totalCMV;
      const cmvFranquiasCalc = totaisFranquias.totalCMV;
      const cmvRevendaCalc = totaisRevenda.totalCMV;

      // Calcular lucro bruto por canal: RECEITA LÍQUIDA - CMV
      const lucroBrutoVarejoCalc = receitaLiquidaVarejoCalc - cmvVarejoCalc;
      const lucroBrutoMultimarcasCalc =
        receitaLiquidaMultimarcasCalc - cmvMultimarcasCalc;
      const lucroBrutoFranquiasCalc =
        receitaLiquidaFranquiasCalc - cmvFranquiasCalc;
      const lucroBrutoRevendaCalc = receitaLiquidaRevendaCalc - cmvRevendaCalc;

      // Atualizar estados com valores por canal
      setReceitaLiquidaVarejo(receitaLiquidaVarejoCalc);
      setReceitaLiquidaMultimarcas(receitaLiquidaMultimarcasCalc);
      setReceitaLiquidaFranquias(receitaLiquidaFranquiasCalc);
      setReceitaLiquidaRevenda(receitaLiquidaRevendaCalc);

      setCmvVarejo(cmvVarejoCalc);
      setCmvMultimarcas(cmvMultimarcasCalc);
      setCmvFranquias(cmvFranquiasCalc);
      setCmvRevenda(cmvRevendaCalc);

      setLucroBrutoVarejo(lucroBrutoVarejoCalc);
      setLucroBrutoMultimarcas(lucroBrutoMultimarcasCalc);
      setLucroBrutoFranquias(lucroBrutoFranquiasCalc);
      setLucroBrutoRevenda(lucroBrutoRevendaCalc);

      console.log('📊 Receitas Líquidas por canal:', {
        varejo: receitaLiquidaVarejoCalc,
        multimarcas: receitaLiquidaMultimarcasCalc,
        franquias: receitaLiquidaFranquiasCalc,
        revenda: receitaLiquidaRevendaCalc,
        total: receitaLiquidaCalculada,
      });

      console.log('📊 CMV por canal:', {
        varejo: cmvVarejoCalc,
        multimarcas: cmvMultimarcasCalc,
        franquias: cmvFranquiasCalc,
        revenda: cmvRevendaCalc,
        total: totalCMV,
      });

      console.log('📊 Lucro Bruto por canal:', {
        varejo: lucroBrutoVarejoCalc,
        multimarcas: lucroBrutoMultimarcasCalc,
        franquias: lucroBrutoFranquiasCalc,
        revenda: lucroBrutoRevendaCalc,
        total: lucroBrutoCalculado,
        formula: 'Receita Líquida - CMV',
      });

      console.log('📊 Empresas utilizadas:', {
        varejo: empresasVarejo.length + ' empresas',
        multimarcas: empresasFixas.length + ' empresas',
        franquias: empresasFixas.length + ' empresas',
        revenda: empresasFixas.length + ' empresas',
      });

      console.log('📊 Dados recebidos das rotas MATERIALIZADAS:', {
        faturamento: {
          varejo: {
            success: faturamentoVarejo?.success,
            dataLength: Array.isArray(faturamentoVarejo?.data)
              ? faturamentoVarejo.data.length
              : 0,
          },
          multimarcas: {
            success: faturamentoMultimarcas?.success,
            dataLength: Array.isArray(faturamentoMultimarcas?.data)
              ? faturamentoMultimarcas.data.length
              : 0,
          },
          franquias: {
            success: faturamentoFranquias?.success,
            dataLength: Array.isArray(faturamentoFranquias?.data)
              ? faturamentoFranquias.data.length
              : 0,
          },
          revenda: {
            success: faturamentoRevenda?.success,
            dataLength: Array.isArray(faturamentoRevenda?.data)
              ? faturamentoRevenda.data.length
              : 0,
          },
        },
        cmv: {
          varejo: {
            success: cmvVarejo?.success,
            dataLength: Array.isArray(cmvVarejo?.data)
              ? cmvVarejo.data.length
              : 0,
          },
          multimarcas: {
            success: cmvMultimarcas?.success,
            dataLength: Array.isArray(cmvMultimarcas?.data)
              ? cmvMultimarcas.data.length
              : 0,
          },
          franquias: {
            success: cmvFranquias?.success,
            dataLength: Array.isArray(cmvFranquias?.data)
              ? cmvFranquias.data.length
              : 0,
          },
          revenda: {
            success: cmvRevenda?.success,
            dataLength: Array.isArray(cmvRevenda?.data)
              ? cmvRevenda.data.length
              : 0,
          },
        },
      });

      console.log('📊 Totais por Segmento (Views Materializadas):', {
        varejo: {
          receitaBruta: totaisVarejo.totalBruto,
          devolucoes: totaisVarejo.totalDevolucoes,
          descontos: totaisVarejo.descontos,
          cmv: totaisVarejo.totalCMV,
        },
        multimarcas: {
          receitaBruta: totaisMultimarcas.totalBruto,
          devolucoes: totaisMultimarcas.totalDevolucoes,
          descontos: totaisMultimarcas.descontos,
          cmv: totaisMultimarcas.totalCMV,
        },
        franquias: {
          receitaBruta: totaisFranquias.totalBruto,
          devolucoes: totaisFranquias.totalDevolucoes,
          descontos: totaisFranquias.descontos,
          cmv: totaisFranquias.totalCMV,
        },
        revenda: {
          receitaBruta: totaisRevenda.totalBruto,
          devolucoes: totaisRevenda.totalDevolucoes,
          descontos: totaisRevenda.descontos,
          cmv: totaisRevenda.totalCMV,
        },
      });

      console.log('📊 RECEITAS BRUTAS (coluna valor_sem_desconto):', {
        total: totalVendasBrutas,
        formula: 'Soma APENAS da coluna VALOR_SEM_DESCONTO de todos os canais',
        observacao: 'Usa a soma total (saída - entrada já calculada na view)',
      });

      console.log('📊 DEVOLUÇÕES (valor_com_desconto_entrada):', {
        total: totalDevolucoesLiquidas,
        formula: 'Soma das entradas com desconto de todos os canais',
      });

      console.log('📊 DESCONTOS CONCEDIDOS:', {
        total: totalDescontos,
        formula: 'valor_sem_desconto - valor_com_desconto (direto das colunas)',
        porCanal: {
          varejo: totaisVarejo.descontos,
          multimarcas: totaisMultimarcas.descontos,
          franquias: totaisFranquias.descontos,
          revenda: totaisRevenda.descontos,
        },
      });

      console.log('📊 CMV Total:', {
        total: totalCMV,
        formula: 'Soma do CMV de todas as rotas CMV materializadas',
        porCanal: {
          varejo: totaisVarejo.totalCMV,
          multimarcas: totaisMultimarcas.totalCMV,
          franquias: totaisFranquias.totalCMV,
          revenda: totaisRevenda.totalCMV,
        },
      });

      console.log('📊 Receita Líquida:', {
        vendasBrutas: totalVendasBrutas,
        totalDeducoes: totalDeducoesCalculado,
        receitaLiquida: receitaLiquidaCalculada,
        formula: 'Vendas Brutas - (Devoluções + Descontos + Impostos)',
      });

      console.log('📊 Lucro Bruto:', {
        receitaLiquida: receitaLiquidaCalculada,
        cmv: totalCMV,
        lucroBruto: lucroBrutoCalculado,
        formula: 'Receita Líquida - CMV',
      });

      setVendasBrutas(totalVendasBrutas);
      setDevolucoes(totalDevolucoesLiquidas);
      setDescontos(totalDescontos);
      setTotalDeducoes(totalDeducoesCalculado);

      // Salvar totais por canal nos estados
      setTotaisVarejo(totaisVarejo);
      setTotaisMultimarcas(totaisMultimarcas);
      setTotaisFranquias(totaisFranquias);
      setTotaisRevenda(totaisRevenda);
      setCmv(totalCMV);
      setReceitaLiquida(receitaLiquidaCalculada);
      setLucroBruto(lucroBrutoCalculado);

      // Estados dos impostos reais
      setIcms(icmsReal);
      setPis(pisReal);
      setCofins(cofinsReal);
      setTotalImpostos(totalImpostosReal);

      // ================= Plano de Contas (Contas a Pagar - Emissão) =================
      try {
        setLoadingStatus('Buscando Contas a Pagar (Emissão)...');
        // Usar exatamente as mesmas empresas do Varejo
        const todasEmpresasCodigos = [
          1, 2, 5, 6, 7, 11, 31, 55, 65, 75, 85, 90, 91, 92, 93, 94, 95, 96, 97,
          98, 99, 100, 101, 111, 200, 311, 500, 550, 600, 650, 700, 750, 850,
          890, 910, 920, 930, 940, 950, 960, 970, 980, 990,
        ];

        const paramsCP = {
          dt_inicio: periodo.dt_inicio,
          dt_fim: periodo.dt_fim,
          cd_empresa: todasEmpresasCodigos,
        };
        const contasPagar = await api.financial.contasPagarEmissao(paramsCP);

        // Buscar nomes das despesas e fornecedores
        setLoadingStatus('Buscando nomes das despesas e fornecedores...');

        // Normalizar formatos possíveis da resposta
        let dadosCP = [];
        if (Array.isArray(contasPagar?.data)) {
          dadosCP = contasPagar.data;
        } else if (
          contasPagar?.data?.data &&
          Array.isArray(contasPagar.data.data)
        ) {
          dadosCP = contasPagar.data.data;
        } else if (Array.isArray(contasPagar?.rows)) {
          dadosCP = contasPagar.rows;
        } else if (
          contasPagar?.data?.rows &&
          Array.isArray(contasPagar.data.rows)
        ) {
          dadosCP = contasPagar.data.rows;
        }

        // Função de categoria por faixa de código (igual Contas a Pagar)
        const getCategoriaByCodigo = (codigo) => {
          if (codigo >= 1000 && codigo <= 1999) {
            return 'CUSTO DAS MERCADORIAS VENDIDAS';
          } else if (codigo >= 2000 && codigo <= 2999) {
            return 'DESPESAS OPERACIONAIS';
          } else if (codigo >= 3000 && codigo <= 3999) {
            return 'DESPESAS COM PESSOAL';
          } else if (codigo >= 4001 && codigo <= 4999) {
            return 'ALUGUÉIS E ARRENDAMENTOS';
          } else if (codigo >= 5000 && codigo <= 5999) {
            return 'IMPOSTOS, TAXAS E CONTRIBUIÇÕES';
          } else if (codigo >= 6000 && codigo <= 6999) {
            return 'DESPESAS GERAIS';
          } else if (codigo >= 7000 && codigo <= 7999) {
            return 'DESPESAS FINANCEIRAS';
          } else if (codigo >= 8000 && codigo <= 8999) {
            return 'OUTRAS DESPESAS OPERACIONAIS';
          } else if (codigo >= 9000 && codigo <= 9999) {
            return 'DESPESAS C/ VENDAS';
          } else {
            return 'SEM CLASSIFICAÇÃO';
          }
        };

        // Buscar nomes para despesas e fornecedores e agrupar: Categoria -> Despesa -> Fornecedor
        const codigosDespesas = Array.from(
          new Set(
            (dadosCP || [])
              .map((x) => x.cd_despesaitem)
              .filter(Boolean)
              .filter((cd) => !shouldExcluirDespesa(cd)),
          ),
        );
        const codigosFornecedores = Array.from(
          new Set((dadosCP || []).map((x) => x.cd_fornecedor).filter(Boolean)),
        );

        console.log('🔍 Códigos únicos encontrados:', {
          totalItens: dadosCP.length,
          codigosDespesas: codigosDespesas.length,
          codigosFornecedores: codigosFornecedores.length,
          amostraCodigosDespesas: codigosDespesas.slice(0, 10),
          amostraCodigosFornecedores: codigosFornecedores.slice(0, 10),
        });

        let despesaMap = new Map();
        let fornecedorMap = new Map();
        try {
          const [despesasResp, fornecedoresResp] = await Promise.all([
            api.financial.despesa({ cd_despesaitem: codigosDespesas }),
            api.financial.fornecedor({ cd_fornecedor: codigosFornecedores }),
          ]);
          const despesasData = Array.isArray(despesasResp?.data)
            ? despesasResp.data
            : Array.isArray(despesasResp)
            ? despesasResp
            : [];
          const fornecedoresData = Array.isArray(fornecedoresResp?.data)
            ? fornecedoresResp.data
            : Array.isArray(fornecedoresResp)
            ? fornecedoresResp
            : [];
          despesaMap = new Map(
            despesasData
              .filter((d) => d && d.cd_despesaitem !== undefined)
              .map((d) => [d.cd_despesaitem, d]),
          );
          fornecedorMap = new Map(
            fornecedoresData
              .filter((f) => f && f.cd_fornecedor !== undefined)
              .map((f) => [f.cd_fornecedor, f]),
          );
          console.log('📊 Resultados das buscas de nomes:', {
            despesasEncontradas: despesaMap.size,
            fornecedoresEncontrados: fornecedorMap.size,
            despesasNaoEncontradas: codigosDespesas.filter(
              (cd) => !despesaMap.has(cd),
            ),
            fornecedoresNaoEncontrados: codigosFornecedores.filter(
              (cd) => !fornecedorMap.has(cd),
            ),
          });
        } catch (errMaps) {
          console.warn(
            'Falha ao enriquecer nomes de despesa/fornecedor:',
            errMaps,
          );
        }

        const gruposMap = new Map();
        let totalGeral = 0;

        // Contadores para análise de problemas
        const problemasAnalise = {
          semClassificacao: [],
          semDespesa: [],
          codigosDespesaInvalidos: [],
          codigosFornecedorInvalidos: [],
        };

        // Logs de diagnóstico para divergências reportadas
        try {
          const debugRegistroChave = {
            cd_empresa: '1',
            cd_fornecedor: '31124',
            nr_duplicata: '854',
            nr_parcela: '3',
            cd_despesaitem: '6031',
          };
          const itensChave = (dadosCP || []).filter(
            (x) =>
              String(x.cd_empresa) === debugRegistroChave.cd_empresa &&
              String(x.cd_fornecedor) === debugRegistroChave.cd_fornecedor &&
              String(x.nr_duplicata) === debugRegistroChave.nr_duplicata &&
              String(x.nr_parcela) === debugRegistroChave.nr_parcela &&
              String(x.cd_despesaitem) === debugRegistroChave.cd_despesaitem,
          );
          const somaChave = itensChave.reduce((acc, x) => {
            const vr = parseFloat(x.vl_rateio || 0) || 0;
            const vd = parseFloat(x.vl_duplicata || 0) || 0;
            const valor = vr !== 0 ? vr : vd;
            return acc + valor;
          }, 0);
          const itensCod6031 = (dadosCP || []).filter(
            (x) => String(x.cd_despesaitem) === '6031',
          );
          const soma6031 = itensCod6031.reduce((acc, x) => {
            const vr = parseFloat(x.vl_rateio || 0) || 0;
            const vd = parseFloat(x.vl_duplicata || 0) || 0;
            const valor = vr !== 0 ? vr : vd;
            return acc + valor;
          }, 0);
          // Quebras por empresa, fornecedor e por duplicata/parcela
          const somaPorEmpresaFornecedor = {};
          const somaPorDuplicataParcela = {};
          for (const x of itensCod6031) {
            const vr = parseFloat(x.vl_rateio || 0) || 0;
            const vd = parseFloat(x.vl_duplicata || 0) || 0;
            const valor = vr !== 0 ? vr : vd;
            const kEF = `${String(x.cd_empresa)}|${String(x.cd_fornecedor)}`;
            const kDP = `${String(x.nr_duplicata)}|${String(x.nr_parcela)}`;
            somaPorEmpresaFornecedor[kEF] =
              (somaPorEmpresaFornecedor[kEF] || 0) + valor;
            somaPorDuplicataParcela[kDP] =
              (somaPorDuplicataParcela[kDP] || 0) + valor;
          }
          const tabelaEF = Object.entries(somaPorEmpresaFornecedor)
            .map(([k, v]) => {
              const [empresa, fornecedor] = k.split('|');
              return { empresa, fornecedor, total: v };
            })
            .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
          const tabelaDP = Object.entries(somaPorDuplicataParcela)
            .map(([k, v]) => {
              const [duplicata, parcela] = k.split('|');
              return { duplicata, parcela, total: v };
            })
            .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
          console.log('🧪 DEBUG DRE - Registro chave e total por código 6031', {
            filtro: debugRegistroChave,
            ocorrenciasRegistroChave: itensChave.length,
            somaRegistroChave: somaChave,
            ocorrenciasCodigo6031: itensCod6031.length,
            somaCodigo6031: soma6031,
            amostraRegistroChave: itensChave.slice(0, 3),
          });
          console.table(tabelaEF);
          console.table(tabelaDP);
        } catch (e) {
          console.warn('Falha ao gerar logs de diagnóstico DRE:', e);
        }

        for (const item of dadosCP) {
          // Removido: não alteramos a lista durante o processamento

          // Bloquear itens com centro de custo 999
          const ccustoRaw =
            item.cd_ccusto ??
            item.ccusto ??
            item.cd_centrocusto ??
            item.centrocusto ??
            item.cc_custo ??
            item.centro_custo ??
            item.cd_ccusto_padrao;
          const ccustoNum = Number(ccustoRaw);
          if (!Number.isNaN(ccustoNum) && ccustoNum === 999) {
            // Ignorar este lançamento
            continue;
          }
          // Ignorar itens por código de despesa configurado
          const codigoDespesa = Number(item.cd_despesaitem) || 0;
          if (shouldExcluirDespesa(codigoDespesa)) {
            continue;
          }
          const valorRateio = parseFloat(item.vl_rateio || 0) || 0;
          const valorDuplicata = parseFloat(item.vl_duplicata || 0) || 0;
          const valor = valorRateio !== 0 ? valorRateio : valorDuplicata;
          totalGeral += valor;
          const categoriaExcecao = getCategoriaPorCodigo(codigoDespesa);
          const chaveGrupo =
            categoriaExcecao || getCategoriaByCodigo(codigoDespesa);

          // Analisar problemas de classificação
          if (chaveGrupo === 'SEM CLASSIFICAÇÃO') {
            problemasAnalise.semClassificacao.push({
              cd_despesaitem: item.cd_despesaitem,
              cd_fornecedor: item.cd_fornecedor,
              nr_duplicata: item.nr_duplicata,
              valor: valor,
              motivo: `Código ${codigoDespesa} não está em nenhuma faixa (1000-1999, 2000-2999, etc.) nem nas exceções`,
            });
          }

          // Verificar se código de despesa é inválido
          if (
            !item.cd_despesaitem ||
            item.cd_despesaitem === '' ||
            item.cd_despesaitem === null
          ) {
            problemasAnalise.codigosDespesaInvalidos.push({
              cd_fornecedor: item.cd_fornecedor,
              nr_duplicata: item.nr_duplicata,
              valor: valor,
              motivo: 'cd_despesaitem está vazio, null ou undefined',
            });
          }
          if (!gruposMap.has(chaveGrupo)) {
            gruposMap.set(chaveGrupo, {
              id: `grp-${chaveGrupo}`,
              label: chaveGrupo,
              description: '',
              value: 0,
              type: 'despesa',
              children: [],
              _despesas: new Map(),
            });
          }
          const grupo = gruposMap.get(chaveGrupo);

          const nomeDespesa = (
            despesaMap.get(item.cd_despesaitem)?.ds_despesaitem ||
            item.ds_despesaitem ||
            'SEM DESPESA'
          )
            .toString()
            .trim();

          // Analisar problemas de nome de despesa
          if (nomeDespesa === 'SEM DESPESA') {
            problemasAnalise.semDespesa.push({
              cd_despesaitem: item.cd_despesaitem,
              cd_fornecedor: item.cd_fornecedor,
              nr_duplicata: item.nr_duplicata,
              valor: valor,
              motivo: `Código ${item.cd_despesaitem} não encontrado na API /despesa nem tem ds_despesaitem no item original`,
              temNaAPI: despesaMap.has(item.cd_despesaitem),
              temNoItem: !!item.ds_despesaitem,
            });
          }
          if (!grupo._despesas.has(nomeDespesa)) {
            grupo._despesas.set(nomeDespesa, {
              id: `desp-${chaveGrupo}-${nomeDespesa}`,
              label: nomeDespesa,
              description: '',
              value: 0,
              type: 'despesa',
              children: [],
              _forn: new Map(),
              _fornCount: 0,
            });
          }
          const nodoDespesa = grupo._despesas.get(nomeDespesa);

          const fornInfo = fornecedorMap.get(item.cd_fornecedor);
          const nmFornecedor = (
            fornInfo?.nm_fornecedor ||
            item.nm_fornecedor ||
            item.cd_fornecedor ||
            'Fornecedor'
          ).toString();
          const fornKey = String(item.cd_fornecedor || nmFornecedor);
          if (!nodoDespesa._forn.has(fornKey)) {
            nodoDespesa._forn.set(fornKey, {
              id: `forn-${fornKey}`,
              label: nmFornecedor,
              description: [
                `Empresa: ${item.cd_empresa || '-'}`,
                `Fornecedor: ${item.cd_fornecedor || '-'}`,
              ].join(' | '),
              value: 0,
              type: 'despesa',
              children: [],
            });
            nodoDespesa._fornCount += 1;
          }
          const nodoFornecedor = nodoDespesa._forn.get(fornKey);
          nodoFornecedor.value += -valor;

          nodoDespesa.value += -valor;
          grupo.value += -valor;
        }

        // Materializar árvores e ordenar
        const grupos = Array.from(gruposMap.values()).map((g) => {
          const despesasArr = Array.from(g._despesas.values()).map((d) => {
            d.description = `${d._fornCount} fornecedor(es) | Total: ${Number(
              Math.abs(d.value),
            ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
            d.children = Array.from(d._forn.values()).sort(
              (a, b) => Math.abs(b.value) - Math.abs(a.value),
            );
            return d;
          });
          despesasArr.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
          g.children = despesasArr;
          delete g._despesas;
          return g;
        });
        grupos.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

        // Separar DESPESAS FINANCEIRAS do restante
        const gruposFinanceiros = grupos.filter(
          (g) => g.label === 'DESPESAS FINANCEIRAS',
        );
        const gruposOperacionais = grupos.filter(
          (g) => g.label !== 'DESPESAS FINANCEIRAS',
        );

        // Totais positivos (valores de grupos são negativos)
        const totalOperacionais = gruposOperacionais.reduce(
          (acc, g) => acc + Math.abs(g.value),
          0,
        );
        const totalFinanceiros = gruposFinanceiros.reduce(
          (acc, g) => acc + Math.abs(g.value),
          0,
        );

        setPlanoDespesasNodes(gruposOperacionais);
        setPlanoDespesasTotal(totalOperacionais);
        setPlanoDespesasFinanceirasNodes(gruposFinanceiros);
        setPlanoDespesasFinanceirasTotal(totalFinanceiros);

        // Log detalhado dos problemas encontrados
        console.log('🚨 ANÁLISE DE PROBLEMAS - DRE Despesas Operacionais:', {
          totalItensProcessados: dadosCP.length,
          problemas: {
            semClassificacao: {
              quantidade: problemasAnalise.semClassificacao.length,
              itens: problemasAnalise.semClassificacao,
              resumo: problemasAnalise.semClassificacao.reduce((acc, item) => {
                const codigo = item.cd_despesaitem;
                if (!acc[codigo]) acc[codigo] = { count: 0, valor: 0 };
                acc[codigo].count++;
                acc[codigo].valor += item.valor;
                return acc;
              }, {}),
            },
            semDespesa: {
              quantidade: problemasAnalise.semDespesa.length,
              itens: problemasAnalise.semDespesa,
              resumo: problemasAnalise.semDespesa.reduce((acc, item) => {
                const codigo = item.cd_despesaitem;
                if (!acc[codigo])
                  acc[codigo] = {
                    count: 0,
                    valor: 0,
                    temNaAPI: item.temNaAPI,
                    temNoItem: item.temNoItem,
                  };
                acc[codigo].count++;
                acc[codigo].valor += item.valor;
                return acc;
              }, {}),
            },
            codigosDespesaInvalidos: {
              quantidade: problemasAnalise.codigosDespesaInvalidos.length,
              itens: problemasAnalise.codigosDespesaInvalidos,
            },
          },
          recomendacoes: {
            paraSemClassificacao:
              'Adicionar códigos nas exceções de categoriasDespesas.js ou criar nova faixa',
            paraSemDespesa:
              'Verificar se códigos existem na tabela de despesas ou adicionar ds_despesaitem nos dados originais',
            paraCodigosInvalidos:
              'Verificar integridade dos dados de cd_despesaitem',
          },
        });

        // Notificação visual se houver problemas
        if (
          problemasAnalise.semClassificacao.length > 0 ||
          problemasAnalise.semDespesa.length > 0
        ) {
          const totalProblemas =
            problemasAnalise.semClassificacao.length +
            problemasAnalise.semDespesa.length;
          console.warn(
            `⚠️ ATENÇÃO: ${totalProblemas} itens com problemas de classificação encontrados. Verifique o console para detalhes.`,
          );
        }
      } catch (error) {
        console.error(
          'Erro ao buscar/gerar Plano de Contas (AP Emissão):',
          error,
        );
        setPlanoDespesasNodes([]);
        setPlanoDespesasTotal(0);
      }
    } catch (err) {
      console.error('Erro ao buscar vendas brutas:', err);
      setError(`Erro ao carregar dados: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  }, [api, periodo]);

  // Remover busca automática - só buscar quando clicar no botão

  // Dados do DRE com vendas brutas reais
  const dreData = useMemo(() => {
    console.log(
      '🔄 useMemo dreData - vendasBrutas:',
      vendasBrutas,
      'devolucoes:',
      devolucoes,
      'descontos:',
      descontos,
      'totalDeducoes:',
      totalDeducoes,
      'cmv:',
      cmv,
      'receitaLiquida:',
      receitaLiquida,
      'lucroBruto:',
      lucroBruto,
      'icms:',
      icms,
      'pis:',
      pis,
      'cofins:',
      cofins,
      'totalImpostos:',
      totalImpostos,
    );
    // Despesas Operacionais (exclui módulo de Despesas Financeiras)
    const despesasOperacionaisNode = {
      id: 'despesas-operacionais',
      label: 'Despesas Operacionais',
      description:
        'Linhas de Contas a Pagar (Emissão), para classificação posterior.',
      value: -planoDespesasTotal,
      type: 'despesa',
      children: planoDespesasNodes,
    };

    // Novo módulo pai de Despesas Financeiras
    const despesasFinanceirasNode = {
      id: 'despesas-financeiras',
      label: 'Despesas Financeiras',
      description: 'Encargos, juros e demais despesas financeiras.',
      value: -planoDespesasFinanceirasTotal,
      type: 'despesa',
      children: planoDespesasFinanceirasNodes,
    };

    return [
      {
        id: 'vendas-bruta',
        label: 'Receitas Brutas',
        description: 'Quanto você vendeu no período (sem tirar nada ainda).',
        value: vendasBrutas,
        type: 'receita',
        children: [
          {
            id: 'varejo',
            label: 'Varejo',
            description: 'Vendas do canal Varejo',
            value: totaisVarejo.totalBruto + totaisVarejo.totalDevolucoes,
            type: 'receita',
          },
          {
            id: 'multimarcas',
            label: 'Multimarcas',
            description: 'Vendas do canal Multimarcas',
            value:
              totaisMultimarcas.totalBruto + totaisMultimarcas.totalDevolucoes,
            type: 'receita',
          },
          {
            id: 'revenda',
            label: 'Revenda',
            description: 'Vendas do canal Revenda',
            value: totaisRevenda.totalBruto + totaisRevenda.totalDevolucoes,
            type: 'receita',
          },
          {
            id: 'franquias',
            label: 'Franquias',
            description: 'Vendas do canal Franquias',
            value: totaisFranquias.totalBruto + totaisFranquias.totalDevolucoes,
            type: 'receita',
          },
        ],
      },
      {
        id: 'deducoes-vendas',
        label: 'Deduções sobre Vendas',
        description:
          'Devoluções, descontos concedidos e impostos sobre vendas.',
        value: -(devolucoes + descontos + totalImpostos), // Soma dos valores individuais
        type: 'deducao',
        children: [
          {
            id: 'devolucoes',
            label: 'Devoluções',
            description: 'Clientes devolveram mercadorias',
            value: -devolucoes, // Valor negativo (dedução)
            type: 'deducao',
            children: [
              {
                id: 'devolucoes-varejo',
                label: 'Varejo',
                description: 'Devoluções do canal Varejo',
                value: -totaisVarejo.totalDevolucoes,
                type: 'deducao',
              },
              {
                id: 'devolucoes-multimarcas',
                label: 'Multimarcas',
                description: 'Devoluções do canal Multimarcas',
                value: -totaisMultimarcas.totalDevolucoes,
                type: 'deducao',
              },
              {
                id: 'devolucoes-revenda',
                label: 'Revenda',
                description: 'Devoluções do canal Revenda',
                value: -totaisRevenda.totalDevolucoes,
                type: 'deducao',
              },
              {
                id: 'devolucoes-franquias',
                label: 'Franquias',
                description: 'Devoluções do canal Franquias',
                value: -totaisFranquias.totalDevolucoes,
                type: 'deducao',
              },
            ],
          },
          {
            id: 'descontos',
            label: 'Descontos Concedidos',
            description: 'Descontos dados aos clientes',
            value: -(
              totaisVarejo.totalBruto -
              totaisVarejo.totalDevolucoes -
              (totaisVarejo.totalLiquido - totaisVarejo.totalDevolucoes) +
              (totaisMultimarcas.totalBruto -
                totaisMultimarcas.totalDevolucoes -
                (totaisMultimarcas.totalLiquido -
                  totaisMultimarcas.totalDevolucoes)) +
              (totaisRevenda.totalBruto -
                totaisRevenda.totalDevolucoes -
                (totaisRevenda.totalLiquido - totaisRevenda.totalDevolucoes)) +
              (totaisFranquias.totalBruto -
                totaisFranquias.totalDevolucoes -
                (totaisFranquias.totalLiquido -
                  totaisFranquias.totalDevolucoes))
            ),
            type: 'deducao',
            children: [
              {
                id: 'descontos-varejo',
                label: 'Varejo',
                description: 'Descontos do canal Varejo',
                value: -(
                  totaisVarejo.totalBruto -
                  totaisVarejo.totalDevolucoes -
                  (totaisVarejo.totalLiquido - totaisVarejo.totalDevolucoes)
                ),
                type: 'deducao',
              },
              {
                id: 'descontos-multimarcas',
                label: 'Multimarcas',
                description: 'Descontos do canal Multimarcas',
                value: -(
                  totaisMultimarcas.totalBruto -
                  totaisMultimarcas.totalDevolucoes -
                  (totaisMultimarcas.totalLiquido -
                    totaisMultimarcas.totalDevolucoes)
                ),
                type: 'deducao',
              },
              {
                id: 'descontos-revenda',
                label: 'Revenda',
                description: 'Descontos do canal Revenda',
                value: -(
                  totaisRevenda.totalBruto -
                  totaisRevenda.totalDevolucoes -
                  (totaisRevenda.totalLiquido - totaisRevenda.totalDevolucoes)
                ),
                type: 'deducao',
              },
              {
                id: 'descontos-franquias',
                label: 'Franquias',
                description: 'Descontos do canal Franquias',
                value: -(
                  totaisFranquias.totalBruto -
                  totaisFranquias.totalDevolucoes -
                  (totaisFranquias.totalLiquido -
                    totaisFranquias.totalDevolucoes)
                ),
                type: 'deducao',
              },
            ],
          },
          {
            id: 'impostos-vendas',
            label: 'Impostos sobre Vendas',
            description: 'ICMS, PIS, COFINS e outros impostos sobre vendas.',
            value: -totalImpostos, // Valor real calculado
            type: 'deducao',
            children: [
              {
                id: 'impostos-varejo',
                label: 'Varejo',
                description: 'Impostos do canal Varejo',
                value: -(
                  impostosVarejo.icms +
                  impostosVarejo.pis +
                  impostosVarejo.cofins
                ),
                type: 'deducao',
                children: [
                  {
                    id: 'icms-varejo',
                    label: 'ICMS',
                    description: 'ICMS do canal Varejo',
                    value: -impostosVarejo.icms,
                    type: 'deducao',
                  },
                  {
                    id: 'pis-varejo',
                    label: 'PIS',
                    description: 'PIS do canal Varejo',
                    value: -impostosVarejo.pis,
                    type: 'deducao',
                  },
                  {
                    id: 'cofins-varejo',
                    label: 'COFINS',
                    description: 'COFINS do canal Varejo',
                    value: -impostosVarejo.cofins,
                    type: 'deducao',
                  },
                ],
              },
              {
                id: 'impostos-multimarcas',
                label: 'Multimarcas',
                description: 'Impostos do canal Multimarcas',
                value: -(
                  impostosMultimarcas.icms +
                  impostosMultimarcas.pis +
                  impostosMultimarcas.cofins
                ),
                type: 'deducao',
                children: [
                  {
                    id: 'icms-multimarcas',
                    label: 'ICMS',
                    description: 'ICMS do canal Multimarcas',
                    value: -impostosMultimarcas.icms,
                    type: 'deducao',
                  },
                  {
                    id: 'pis-multimarcas',
                    label: 'PIS',
                    description: 'PIS do canal Multimarcas',
                    value: -impostosMultimarcas.pis,
                    type: 'deducao',
                  },
                  {
                    id: 'cofins-multimarcas',
                    label: 'COFINS',
                    description: 'COFINS do canal Multimarcas',
                    value: -impostosMultimarcas.cofins,
                    type: 'deducao',
                  },
                ],
              },
              {
                id: 'impostos-revenda',
                label: 'Revenda',
                description: 'Impostos do canal Revenda',
                value: -(
                  impostosRevenda.icms +
                  impostosRevenda.pis +
                  impostosRevenda.cofins
                ),
                type: 'deducao',
                children: [
                  {
                    id: 'icms-revenda',
                    label: 'ICMS',
                    description: 'ICMS do canal Revenda',
                    value: -impostosRevenda.icms,
                    type: 'deducao',
                  },
                  {
                    id: 'pis-revenda',
                    label: 'PIS',
                    description: 'PIS do canal Revenda',
                    value: -impostosRevenda.pis,
                    type: 'deducao',
                  },
                  {
                    id: 'cofins-revenda',
                    label: 'COFINS',
                    description: 'COFINS do canal Revenda',
                    value: -impostosRevenda.cofins,
                    type: 'deducao',
                  },
                ],
              },
              {
                id: 'impostos-franquias',
                label: 'Franquias',
                description: 'Impostos do canal Franquias',
                value: -(
                  impostosFranquias.icms +
                  impostosFranquias.pis +
                  impostosFranquias.cofins
                ),
                type: 'deducao',
                children: [
                  {
                    id: 'icms-franquias',
                    label: 'ICMS',
                    description: 'ICMS do canal Franquias',
                    value: -impostosFranquias.icms,
                    type: 'deducao',
                  },
                  {
                    id: 'pis-franquias',
                    label: 'PIS',
                    description: 'PIS do canal Franquias',
                    value: -impostosFranquias.pis,
                    type: 'deducao',
                  },
                  {
                    id: 'cofins-franquias',
                    label: 'COFINS',
                    description: 'COFINS do canal Franquias',
                    value: -impostosFranquias.cofins,
                    type: 'deducao',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'receita-liquida',
        label: 'Receita Líquida de Vendas',
        description: 'É o que realmente ficou das vendas.',
        value: receitaLiquida, // Valor real calculado
        type: 'resultado',
        children: [
          {
            id: 'receita-liquida-varejo',
            label: 'Varejo',
            description: 'Receita líquida do canal Varejo',
            value: receitaLiquidaVarejo,
            type: 'resultado',
          },
          {
            id: 'receita-liquida-multimarcas',
            label: 'Multimarcas',
            description: 'Receita líquida do canal Multimarcas',
            value: receitaLiquidaMultimarcas,
            type: 'resultado',
          },
          {
            id: 'receita-liquida-revenda',
            label: 'Revenda',
            description: 'Receita líquida do canal Revenda',
            value: receitaLiquidaRevenda,
            type: 'resultado',
          },
          {
            id: 'receita-liquida-franquias',
            label: 'Franquias',
            description: 'Receita líquida do canal Franquias',
            value: receitaLiquidaFranquias,
            type: 'resultado',
          },
        ],
      },
      {
        id: 'cmv',
        label: 'Custos da Mercadoria Vendida (CMV)',
        description:
          'Quanto custou comprar ou produzir o que você vendeu (matéria-prima, mercadorias para revenda, mão de obra da produção).',
        value: -cmv, // Valor negativo (custo)
        type: 'custo',
        children: [
          {
            id: 'cmv-varejo',
            label: 'Varejo',
            description: 'CMV do canal Varejo',
            value: -cmvVarejo,
            type: 'custo',
          },
          {
            id: 'cmv-multimarcas',
            label: 'Multimarcas',
            description: 'CMV do canal Multimarcas',
            value: -cmvMultimarcas,
            type: 'custo',
          },
          {
            id: 'cmv-revenda',
            label: 'Revenda',
            description: 'CMV do canal Revenda',
            value: -cmvRevenda,
            type: 'custo',
          },
          {
            id: 'cmv-franquias',
            label: 'Franquias',
            description: 'CMV do canal Franquias',
            value: -cmvFranquias,
            type: 'custo',
          },
        ],
      },
      {
        id: 'lucro-bruto',
        label: 'Lucro Bruto',
        description: 'Receita Líquida – CMV',
        value: lucroBruto, // Valor real calculado
        type: 'resultado',
        children: [
          {
            id: 'lucro-bruto-varejo',
            label: 'Varejo',
            description: 'Lucro bruto do canal Varejo',
            value: lucroBrutoVarejo,
            type: 'resultado',
          },
          {
            id: 'lucro-bruto-multimarcas',
            label: 'Multimarcas',
            description: 'Lucro bruto do canal Multimarcas',
            value: lucroBrutoMultimarcas,
            type: 'resultado',
          },
          {
            id: 'lucro-bruto-revenda',
            label: 'Revenda',
            description: 'Lucro bruto do canal Revenda',
            value: lucroBrutoRevenda,
            type: 'resultado',
          },
          {
            id: 'lucro-bruto-franquias',
            label: 'Franquias',
            description: 'Lucro bruto do canal Franquias',
            value: lucroBrutoFranquias,
            type: 'resultado',
          },
        ],
      },
      despesasOperacionaisNode,
      {
        id: 'resultado-operacional',
        label: 'Resultado Operacional',
        description: 'Lucro Bruto - Despesas Operacionais',
        value: lucroBruto - planoDespesasTotal,
        type: 'resultado',
        children: [],
      },
      despesasFinanceirasNode,
      {
        id: 'lucro-antes-impostos',
        label: 'Lucro Antes do IR/CSLL',
        description: 'Resultado antes dos impostos sobre o lucro.',
        value: lucroBruto - planoDespesasTotal - planoDespesasFinanceirasTotal,
        type: 'resultado',
        children: [],
      },
      {
        id: 'impostos-lucro',
        label: 'Impostos sobre o Lucro (IR/CSLL)',
        description: 'Se a empresa paga esse tipo de imposto.',
        value: 0,
        type: 'imposto',
        children: [
          {
            id: 'irpj',
            label: 'IRPJ',
            description: 'Imposto de Renda Pessoa Jurídica',
            value: 0,
            type: 'imposto',
          },
          {
            id: 'csll',
            label: 'CSLL',
            description: 'Contribuição Social sobre o Lucro Líquido',
            value: 0,
            type: 'imposto',
          },
        ],
      },
      {
        id: 'lucro-liquido',
        label: 'Lucro Líquido do Exercício',
        description:
          'Resultado Operacional - Despesas Financeiras - Impostos sobre o Lucro',
        value:
          lucroBruto - planoDespesasTotal - planoDespesasFinanceirasTotal - 0,
        type: 'resultado-final',
        children: [],
      },
    ];
  }, [
    vendasBrutas,
    devolucoes,
    descontos,
    totalDeducoes,
    cmv,
    receitaLiquida,
    lucroBruto,
    icms,
    pis,
    cofins,
    totalImpostos,
    planoDespesasTotal,
    planoDespesasNodes,
    planoDespesasFinanceirasNodes,
    totaisVarejo,
    totaisMultimarcas,
    totaisFranquias,
    totaisRevenda,
    // Impostos por canal
    impostosVarejo,
    impostosMultimarcas,
    impostosFranquias,
    impostosRevenda,
    // Receitas líquidas por canal
    receitaLiquidaVarejo,
    receitaLiquidaMultimarcas,
    receitaLiquidaFranquias,
    receitaLiquidaRevenda,
    // CMV por canal
    cmvVarejo,
    cmvMultimarcas,
    cmvFranquias,
    cmvRevenda,
    // Lucro bruto por canal
    lucroBrutoVarejo,
    lucroBrutoMultimarcas,
    lucroBrutoFranquias,
    lucroBrutoRevenda,
    planoDespesasFinanceirasTotal,
  ]);

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Funções de controle de expansão no estilo Contas a Pagar
  const toggleCategoria = (categoriaNome) => {
    const novaSet = new Set(categoriasExpandidas);
    if (novaSet.has(categoriaNome)) {
      novaSet.delete(categoriaNome);
    } else {
      novaSet.add(categoriaNome);
    }
    setCategoriasExpandidas(novaSet);
  };

  const toggleTodosTopicos = () => {
    if (todosExpandidos) {
      setCategoriasExpandidas(new Set());
    } else {
      const todasCategorias = new Set();
      // Seções de resultado que não devem ser expansíveis
      const resultadoSections = [
        'Receitas Brutas',
        'Receita Líquida de Vendas',
        'Lucro Bruto',
        'Resultado Operacional',
        'Lucro Antes do IR/CSLL',
        'Lucro Líquido do Exercício',
      ];

      dreData.forEach((item) => {
        // Só adiciona se não for uma seção de resultado
        if (!resultadoSections.includes(item.label)) {
          todasCategorias.add(item.label);
          if (item.children) {
            item.children.forEach((child) => {
              // Adiciona o subitem como chave composta
              todasCategorias.add(`${item.label}|${child.label}`);
              // Se o subitem tem children, adiciona eles também
              if (child.children) {
                child.children.forEach((grandchild) => {
                  todasCategorias.add(
                    `${item.label}|${child.label}|${grandchild.label}`,
                  );
                });
              }
            });
          }
        }
      });
      setCategoriasExpandidas(todasCategorias);
    }
    setTodosExpandidos(!todosExpandidos);
  };

  const formatCurrency = (value) => {
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));

    return value < 0 ? `-${formatted}` : formatted;
  };

  const getValueColor = (value, type) => {
    if (type === 'resultado-final') {
      return value >= 0 ? 'text-green-600' : 'text-red-600';
    }
    if (type === 'resultado') {
      return value >= 0 ? 'text-blue-600' : 'text-red-600';
    }
    return value < 0 ? 'text-red-500' : 'text-green-600';
  };

  const getIcon = (type, value) => {
    if (type === 'resultado-final') {
      return value >= 0 ? (
        <TrendUp className="w-2 h-2" />
      ) : (
        <TrendDown className="w-2 h-2" />
      );
    }
    if (type === 'resultado') {
      return value >= 0 ? (
        <Dot className="w-2 h-2" />
      ) : (
        <Dot className="w-2 h-2" />
      );
    }
    if (value < 0) {
      return <Dot className="w-2 h-2" />;
    }
    return <Dot className="w-2 h-2" />;
  };

  const getFolderIcon = (type) => {
    switch (type) {
      case 'receita':
        return <CurrencyDollar className="w-4 h-4 text-green-600" />;
      case 'deducao':
        return <Dot className="w-4 h-4 text-red-500" />;
      case 'custo':
        return <Dot className="w-4 h-4 text-orange-500" />;
      case 'despesa':
        return <Dot className="w-4 h-4 text-red-600" />;
      case 'imposto':
        return <Dot className="w-4 h-4 text-purple-600" />;
      case 'resultado':
        return <Dot className="w-4 h-4 text-blue-600" />;
      case 'resultado-final':
        return <TrendUp className="w-4 h-4 text-green-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderTreeItem = (
    item,
    level = 0,
    isLastInSection = false,
    isEven = true,
  ) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedNodes[item.id];
    const isLeaf = !hasChildren;

    if (isLeaf) {
      return (
        <div
          key={item.id}
          className="ms-3 ps-3 relative before:absolute before:top-0 before:start-0 before:w-0.5 before:-ms-px before:h-full before:bg-gray-100"
        >
          <div
            className={`hs-accordion-selectable hs-accordion-selected:bg-gray-100 px-2 rounded-md cursor-pointer hover:bg-gray-100/50 transition-colors ${
              isEven ? 'bg-gray-50/30' : 'bg-white'
            }`}
            role="treeitem"
          >
            <div className="flex items-center gap-x-3 py-1">
              {getFolderIcon(item.type)}
              <div className="grow flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-800 font-medium">
                    {item.label}
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {item.description}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${getValueColor(
                    item.value,
                    item.type,
                  )}`}
                >
                  {formatCurrency(item.value)}
                </span>
              </div>
            </div>
          </div>
          {/* Divider after leaf items */}
          {isLastInSection && (
            <div className="border-b border-gray-200 my-2"></div>
          )}
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className={`hs-accordion ${isExpanded ? 'active' : ''}`}
        role="treeitem"
        aria-expanded={isExpanded}
      >
        {/* Accordion Heading */}
        <div className="hs-accordion-heading py-0.5 flex items-center gap-x-0.5 w-full">
          <button
            className="hs-accordion-toggle size-6 flex justify-center items-center hover:bg-gray-100 rounded-md focus:outline-hidden focus:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none"
            aria-expanded={isExpanded}
            aria-controls={`dre-${item.id}`}
            onClick={() => toggleNode(item.id)}
          >
            <svg
              className="size-4 text-gray-800"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14"></path>
              <path
                className={isExpanded ? 'hidden' : 'block'}
                d="M12 5v14"
              ></path>
            </svg>
          </button>

          <div
            className={`grow hs-accordion-selectable hs-accordion-selected:bg-gray-100 px-1.5 rounded-md cursor-pointer hover:bg-gray-100/40 transition-colors ${
              isEven ? 'bg-gray-50/20' : 'bg-white'
            }`}
          >
            <div className="flex items-center gap-x-3">
              {getFolderIcon(item.type)}
              <div className="grow flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-800 font-medium">
                    {item.label}
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {item.description}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${getValueColor(
                    item.value,
                    item.type,
                  )}`}
                >
                  {formatCurrency(item.value)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Accordion Content */}
        <div
          id={`dre-${item.id}`}
          className={`hs-accordion-content w-full overflow-hidden transition-[height] duration-300 ${
            isExpanded ? '' : 'hidden'
          }`}
          role="group"
          aria-labelledby={`dre-${item.id}`}
        >
          <div className="hs-accordion-group ps-7 relative before:absolute before:top-0 before:start-3 before:w-0.5 before:-ms-px before:h-full before:bg-gray-100">
            {item.children.map((child, index) =>
              renderTreeItem(
                child,
                level + 1,
                index === item.children.length - 1,
                (index + 1) % 2 === 0,
              ),
            )}
          </div>
          {/* Divider after accordion items */}
          {isLastInSection && (
            <div className="border-b border-gray-200 my-2"></div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <PageTitle
        title="DRE - Demonstrativo de Resultado do Exercício"
        subtitle="Análise detalhada dos resultados financeiros do período"
        icon={TrendUp}
      />

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-3 mb-4 border border-gray-200">
        <div className="mb-6">
          <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
            <Funnel size={18} weight="bold" />
            Filtros
          </span>
          <span className="text-xs text-gray-500 mt-1">
            Selecione o período para análise
          </span>
        </div>
        {/* Filtro rápido por período (ANO/Meses) */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {[
              'ANO',
              'JAN',
              'FEV',
              'MAR',
              'ABR',
              'MAI',
              'JUN',
              'JUL',
              'AGO',
              'SET',
              'OUT',
              'NOV',
              'DEZ',
            ].map((mes) => (
              <button
                key={mes}
                type="button"
                onClick={() => handleFiltroMensalChange(mes)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filtroMensal === mes
                    ? 'bg-[#000638] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {mes}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Período Inicial
            </label>
            <input
              type="date"
              className="border rounded px-2 py-1.5 w-full text-xs"
              value={periodo.dt_inicio}
              onChange={(e) =>
                setPeriodo((prev) => ({ ...prev, dt_inicio: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Período Final
            </label>
            <input
              type="date"
              className="border rounded px-2 py-1.5 w-full text-xs"
              value={periodo.dt_fim}
              onChange={(e) =>
                setPeriodo((prev) => ({ ...prev, dt_fim: e.target.value }))
              }
            />
          </div>
          <div className="flex items-center">
            <button
              className="bg-[#000638] text-white text-xs px-3 py-2 rounded hover:bg-[#fe0000]"
              onClick={buscarVendasBrutas}
              disabled={loading}
            >
              {loading ? 'Carregando...' : 'Buscar Dados'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Tree View */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Demonstrativo de Resultado do Exercício
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Período:{' '}
            {(() => {
              const parseDateNoTZ = (iso) => {
                if (!iso) return null;
                try {
                  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
                  if (!y || !m || !d) return null;
                  return new Date(y, m - 1, d);
                } catch {
                  return null;
                }
              };
              const formatDateBR = (iso) => {
                const d = parseDateNoTZ(iso);
                if (!d) return '';
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = String(d.getFullYear());
                return `${dd}/${mm}/${yyyy}`;
              };
              return periodo.dt_inicio && periodo.dt_fim
                ? `${formatDateBR(periodo.dt_inicio)} a ${formatDateBR(
                    periodo.dt_fim,
                  )}`
                : 'Selecione um período';
            })()}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner
              size="lg"
              text={loadingStatus || 'Carregando dados do DRE...'}
            />
            {loadingStatus && (
              <div className="mt-4 w-full max-w-md">
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: loadingStatus.includes('Varejo')
                        ? '20%'
                        : loadingStatus.includes('Multimarcas')
                        ? '40%'
                        : loadingStatus.includes('Franquia')
                        ? '60%'
                        : loadingStatus.includes('Revenda')
                        ? '80%'
                        : loadingStatus.includes('impostos')
                        ? '95%'
                        : loadingStatus.includes('Processando')
                        ? '100%'
                        : '0%',
                    }}
                  ></div>
                </div>
                <div className="text-center mt-2 text-sm text-gray-600">
                  {loadingStatus.includes('Varejo') && '1/5 - Varejo'}
                  {loadingStatus.includes('Multimarcas') && '2/5 - Multimarcas'}
                  {loadingStatus.includes('Franquia') && '3/5 - Franquia'}
                  {loadingStatus.includes('Revenda') && '4/5 - Revenda'}
                  {loadingStatus.includes('impostos') && '5/5 - Impostos'}
                  {loadingStatus.includes('Processando') && 'Finalizando...'}
                </div>
              </div>
            )}
          </div>
        ) : vendasBrutas > 0 ? (
          <>
            {/* DRE Tree View - Estilo Contas a Pagar */}
            <div className="space-y-2 flex justify-center items-center flex-col">
              {/* Botões de ação */}
              <div className="flex justify-between items-center">
                {/* Botão discreto para expandir/colapsar todos */}
                <button
                  onClick={toggleTodosTopicos}
                  className="text-xs text-gray-500 hover:text-gray-700 px-0.5 py-0.5 rounded transition-colors flex items-center gap-1"
                  title={
                    todosExpandidos
                      ? 'Colapsar todos os tópicos'
                      : 'Expandir todos os tópicos'
                  }
                >
                  {todosExpandidos ? (
                    <>
                      <span>−</span>
                      <span>Colapsar tudo</span>
                    </>
                  ) : (
                    <>
                      <span>+</span>
                      <span>Expandir tudo</span>
                    </>
                  )}
                </button>
              </div>

              {/* Módulos da DRE */}
              {dreData.map((modulo, moduloIndex) => {
                const isModuloExpanded = categoriasExpandidas.has(modulo.label);

                // Seções de resultado que não devem ser expansíveis
                const resultadoSections = [
                  // 'Receitas Brutas',
                  // 'Receita Líquida de Vendas',
                  // 'Lucro Bruto',
                  // 'Resultado Operacional',
                  // 'Lucro Antes do IR/CSLL',
                  // 'Lucro Líquido do Exercício',
                ];

                const isResultadoSection = resultadoSections.includes(
                  modulo.label,
                );

                return (
                  <div
                    key={`modulo-${moduloIndex}-${modulo.id}`}
                    className={`w-1/2 ${
                      isResultadoSection
                        ? 'bg-blue-50 rounded-lg'
                        : 'border border-gray-200 rounded-lg overflow-hidden'
                    }`}
                  >
                    {/* Cabeçalho do módulo principal */}
                    <div
                      className={`${
                        isResultadoSection
                          ? 'bg-blue-50 cursor-default'
                          : 'bg-gray-50 hover:bg-gray-100 cursor-pointer'
                      } transition-colors px-2 py-1.5 flex items-center justify-between`}
                      onClick={
                        isResultadoSection
                          ? undefined
                          : () => toggleCategoria(modulo.label)
                      }
                    >
                      <div className="flex items-center space-x-2">
                        {!isResultadoSection &&
                          (isModuloExpanded ? (
                            <CaretDown size={10} className="text-gray-600" />
                          ) : (
                            <CaretRight size={10} className="text-gray-600" />
                          ))}
                        <div>
                          <h3 className="font-medium text-xs text-gray-800">
                            {modulo.label}
                          </h3>
                          <div className="flex gap-96 items-center justify-between space-x-32 text-xs text-gray-600">
                            <span
                              className={`font-medium text-xs ${
                                modulo.value >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {formatCurrency(Math.abs(modulo.value))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sub-itens do módulo */}
                    {isModuloExpanded &&
                      modulo.children &&
                      modulo.children.length > 0 && (
                        <div className="bg-white border-t border-gray-100">
                          {modulo.children.map((subitem, subitemIndex) => {
                            const chaveSubitem = `${modulo.label}|${subitem.label}`;
                            const isSubitemExpanded =
                              categoriasExpandidas.has(chaveSubitem);
                            const hasSubitemChildren =
                              subitem.children && subitem.children.length > 0;

                            return (
                              <div
                                key={`subitem-${moduloIndex}-${subitemIndex}-${subitem.id}`}
                                className="border-b border-gray-100 last:border-b-0"
                              >
                                {/* Cabeçalho do sub-item */}
                                <div
                                  className={`bg-gray-25 hover:bg-gray-50 transition-colors px-4 py-1.5 flex items-center justify-between ${
                                    hasSubitemChildren
                                      ? 'cursor-pointer'
                                      : 'cursor-default'
                                  }`}
                                  onClick={
                                    hasSubitemChildren
                                      ? () => toggleCategoria(chaveSubitem)
                                      : undefined
                                  }
                                >
                                  <div className="flex items-center space-x-2">
                                    {hasSubitemChildren &&
                                      (isSubitemExpanded ? (
                                        <CaretDown
                                          size={10}
                                          className="text-gray-500"
                                        />
                                      ) : (
                                        <CaretRight
                                          size={10}
                                          className="text-gray-500"
                                        />
                                      ))}
                                    <div>
                                      <h4 className="font-medium text-xs text-gray-700">
                                        {subitem.label}
                                      </h4>
                                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                                        <span
                                          className={`font-medium ${
                                            subitem.value >= 0
                                              ? 'text-green-500'
                                              : 'text-red-500'
                                          }`}
                                        >
                                          {formatCurrency(
                                            Math.abs(subitem.value),
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Sub-sub-itens (se existirem) */}
                                {isSubitemExpanded &&
                                  subitem.children &&
                                  subitem.children.length > 0 && (
                                    <div className="bg-white border-t border-gray-50">
                                      {subitem.children.map(
                                        (subsubitem, subsubitemIndex) => {
                                          const chaveSubsubitem = `${modulo.label}|${subitem.label}|${subsubitem.label}`;
                                          const isSubsubitemExpanded =
                                            categoriasExpandidas.has(
                                              chaveSubsubitem,
                                            );
                                          const hasSubsubitemChildren =
                                            subsubitem.children &&
                                            subsubitem.children.length > 0;

                                          return (
                                            <div
                                              key={`subsubitem-${moduloIndex}-${subitemIndex}-${subsubitemIndex}-${subsubitem.id}`}
                                              className="border-b border-gray-50 last:border-b-0"
                                            >
                                              <div
                                                className={`bg-gray-25 hover:bg-gray-50 transition-colors px-6 py-1.5 flex items-center justify-between ${
                                                  hasSubsubitemChildren
                                                    ? 'cursor-pointer'
                                                    : 'cursor-default'
                                                }`}
                                                onClick={
                                                  hasSubsubitemChildren
                                                    ? () =>
                                                        toggleCategoria(
                                                          chaveSubsubitem,
                                                        )
                                                    : undefined
                                                }
                                              >
                                                <div className="flex items-center space-x-2">
                                                  {hasSubsubitemChildren &&
                                                    (isSubsubitemExpanded ? (
                                                      <CaretDown
                                                        size={10}
                                                        className="text-gray-400"
                                                      />
                                                    ) : (
                                                      <CaretRight
                                                        size={10}
                                                        className="text-gray-400"
                                                      />
                                                    ))}
                                                  <div>
                                                    <h5 className="font-medium text-xs text-gray-600">
                                                      {subsubitem.label}
                                                    </h5>
                                                    <div className="flex items-center space-x-3 text-xs text-gray-400">
                                                      {subsubitem.description && (
                                                        <span className="text-gray-400">
                                                          {
                                                            subsubitem.description
                                                          }
                                                        </span>
                                                      )}
                                                      <span
                                                        className={`font-medium ${
                                                          subsubitem.value >= 0
                                                            ? 'text-green-400'
                                                            : 'text-red-400'
                                                        }`}
                                                      >
                                                        {formatCurrency(
                                                          Math.abs(
                                                            subsubitem.value,
                                                          ),
                                                        )}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Sub-sub-sub-itens (4º nível - se existirem) */}
                                              {isSubsubitemExpanded &&
                                                subsubitem.children &&
                                                subsubitem.children.length >
                                                  0 && (
                                                  <div className="bg-white border-t border-gray-50">
                                                    {subsubitem.children.map(
                                                      (
                                                        subsubsubitem,
                                                        subsubsubitemIndex,
                                                      ) => (
                                                        <div
                                                          key={`subsubsubitem-${moduloIndex}-${subitemIndex}-${subsubitemIndex}-${subsubsubitemIndex}-${subsubsubitem.id}`}
                                                          className="border-b border-gray-50 last:border-b-0"
                                                        >
                                                          <div className="bg-gray-25 hover:bg-gray-50 cursor-default transition-colors px-8 py-1.5 flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                              <div>
                                                                <h6 className="font-medium text-xs text-gray-500">
                                                                  {
                                                                    subsubsubitem.label
                                                                  }
                                                                </h6>
                                                                <div className="flex items-center space-x-3 text-xs text-gray-300">
                                                                  {subsubsubitem.description && (
                                                                    <span className="text-gray-400">
                                                                      {
                                                                        subsubsubitem.description
                                                                      }
                                                                    </span>
                                                                  )}
                                                                  <span
                                                                    className={`font-medium ${
                                                                      subsubsubitem.value >=
                                                                      0
                                                                        ? 'text-green-300'
                                                                        : 'text-red-300'
                                                                    }`}
                                                                  >
                                                                    {formatCurrency(
                                                                      Math.abs(
                                                                        subsubsubitem.value,
                                                                      ),
                                                                    )}
                                                                  </span>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      ),
                                                    )}
                                                  </div>
                                                )}
                                            </div>
                                          );
                                        },
                                      )}
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="text-center">
              <TrendUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum dado carregado
              </h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DRE;
