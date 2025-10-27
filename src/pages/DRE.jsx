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
  const [filtroMensalComparacao, setFiltroMensalComparacao] = useState('ANO');

  // Estados para análise horizontal/vertical
  const [tipoAnalise, setTipoAnalise] = useState('vertical'); // 'vertical' ou 'horizontal'
  const [periodoComparacao, setPeriodoComparacao] = useState({
    dt_inicio: '',
    dt_fim: '',
  });

  // Estados para dados do período de comparação (Período 2)
  const [dadosPeriodo2, setDadosPeriodo2] = useState({
    vendasBrutas: 0,
    devolucoes: 0,
    descontos: 0,
    totalDeducoes: 0,
    cmv: 0,
    receitaLiquida: 0,
    lucroBruto: 0,
    icms: 0,
    pis: 0,
    cofins: 0,
    totalImpostos: 0,
    planoDespesasTotal: 0,
    planoDespesasFinanceirasTotal: 0,
    // Dados por canal
    totaisVarejo: {
      totalBruto: 0,
      totalDevolucoes: 0,
      totalCMV: 0,
      totalLiquido: 0,
      descontos: 0,
    },
    totaisMultimarcas: {
      totalBruto: 0,
      totalDevolucoes: 0,
      totalCMV: 0,
      totalLiquido: 0,
      descontos: 0,
    },
    totaisFranquias: {
      totalBruto: 0,
      totalDevolucoes: 0,
      totalCMV: 0,
      totalLiquido: 0,
      descontos: 0,
    },
    totaisRevenda: {
      totalBruto: 0,
      totalDevolucoes: 0,
      totalCMV: 0,
      totalLiquido: 0,
      descontos: 0,
    },
    impostosVarejo: { icms: 0, pis: 0, cofins: 0 },
    impostosMultimarcas: { icms: 0, pis: 0, cofins: 0 },
    impostosFranquias: { icms: 0, pis: 0, cofins: 0 },
    impostosRevenda: { icms: 0, pis: 0, cofins: 0 },
    receitaLiquidaVarejo: 0,
    receitaLiquidaMultimarcas: 0,
    receitaLiquidaFranquias: 0,
    receitaLiquidaRevenda: 0,
    cmvVarejo: 0,
    cmvMultimarcas: 0,
    cmvFranquias: 0,
    cmvRevenda: 0,
    lucroBrutoVarejo: 0,
    lucroBrutoMultimarcas: 0,
    lucroBrutoFranquias: 0,
    lucroBrutoRevenda: 0,
  });

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

  const handleFiltroMensalComparacaoChange = (mesSigla) => {
    setFiltroMensalComparacao(mesSigla);
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
      if (periodoComparacao.dt_inicio) {
        const [y] = periodoComparacao.dt_inicio.split('-');
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

    setPeriodoComparacao((prev) => ({
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

    // Validação: Se for análise horizontal, verificar se período 2 foi preenchido
    if (tipoAnalise === 'horizontal') {
      if (!periodoComparacao.dt_inicio || !periodoComparacao.dt_fim) {
        setError(
          'Para análise horizontal, preencha o Período 2 de comparação.',
        );
        return;
      }
    }

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

      // ========== BUSCAR IMPOSTOS ==========
      // Buscar impostos usando a nova rota de impostos-por-canal
      setLoadingStatus('Buscando impostos por canal...');

      let impostosData = null;
      try {
        const responseImpostos = await api.sales.impostosPorCanal({
          dataInicio: periodo.dt_inicio,
          dataFim: periodo.dt_fim,
        });

        if (responseImpostos?.success && responseImpostos?.data) {
          impostosData = responseImpostos.data;
          console.log('💰 Impostos recebidos da API:', impostosData);
        }
      } catch (error) {
        console.error(
          '⚠️ Erro ao buscar impostos, usando valores zerados:',
          error,
        );
      }

      // Processar impostos por canal (a API retorna impostos separados por tipo)
      const impostosVarejoData = {
        icms: impostosData?.varejo?.icms || 0,
        pis: impostosData?.varejo?.pis || 0,
        cofins: impostosData?.varejo?.cofins || 0,
      };

      const impostosMultimarcasData = {
        icms: impostosData?.multimarcas?.icms || 0,
        pis: impostosData?.multimarcas?.pis || 0,
        cofins: impostosData?.multimarcas?.cofins || 0,
      };

      const impostosFranquiasData = {
        icms: impostosData?.franquias?.icms || 0,
        pis: impostosData?.franquias?.pis || 0,
        cofins: impostosData?.franquias?.cofins || 0,
      };

      const impostosRevendaData = {
        icms: impostosData?.revenda?.icms || 0,
        pis: impostosData?.revenda?.pis || 0,
        cofins: impostosData?.revenda?.cofins || 0,
      };

      // Atualizar estados com impostos por canal
      setImpostosVarejo(impostosVarejoData);
      setImpostosMultimarcas(impostosMultimarcasData);
      setImpostosFranquias(impostosFranquiasData);
      setImpostosRevenda(impostosRevendaData);

      // Totais gerais
      const icmsReal =
        impostosVarejoData.icms +
        impostosMultimarcasData.icms +
        impostosFranquiasData.icms +
        impostosRevendaData.icms;
      const pisReal =
        impostosVarejoData.pis +
        impostosMultimarcasData.pis +
        impostosFranquiasData.pis +
        impostosRevendaData.pis;
      const cofinsReal =
        impostosVarejoData.cofins +
        impostosMultimarcasData.cofins +
        impostosFranquiasData.cofins +
        impostosRevendaData.cofins;
      const totalImpostosReal = icmsReal + pisReal + cofinsReal;

      console.log('💰 Impostos processados:', {
        varejo: impostosVarejoData,
        multimarcas: impostosMultimarcasData,
        franquias: impostosFranquiasData,
        revenda: impostosRevendaData,
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
        (totaisVarejo.totalDevolucoes +
          totaisVarejo.descontos +
          impostosVarejoData.icms +
          impostosVarejoData.pis +
          impostosVarejoData.cofins);

      const receitaLiquidaMultimarcasCalc =
        totaisMultimarcas.totalBruto -
        (totaisMultimarcas.totalDevolucoes +
          totaisMultimarcas.descontos +
          impostosMultimarcasData.icms +
          impostosMultimarcasData.pis +
          impostosMultimarcasData.cofins);

      const receitaLiquidaFranquiasCalc =
        totaisFranquias.totalBruto -
        (totaisFranquias.totalDevolucoes +
          totaisFranquias.descontos +
          impostosFranquiasData.icms +
          impostosFranquiasData.pis +
          impostosFranquiasData.cofins);

      const receitaLiquidaRevendaCalc =
        totaisRevenda.totalBruto -
        (totaisRevenda.totalDevolucoes +
          totaisRevenda.descontos +
          impostosRevendaData.icms +
          impostosRevendaData.pis +
          impostosRevendaData.cofins);

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

      // ================= ANÁLISE HORIZONTAL: Buscar dados do Período 2 =================
      if (tipoAnalise === 'horizontal') {
        setLoadingStatus('Buscando dados do Período 2 de comparação...');

        // Buscar faturamento do Período 2
        const paramsFaturamentoPeriodo2 = {
          dataInicio: periodoComparacao.dt_inicio,
          dataFim: periodoComparacao.dt_fim,
        };

        const [
          faturamentoVarejoPeriodo2,
          faturamentoMultimarcasPeriodo2,
          faturamentoFranquiasPeriodo2,
          faturamentoRevendaPeriodo2,
        ] = await Promise.all([
          api.sales.faturamentoVarejo(paramsFaturamentoPeriodo2),
          api.sales.faturamentoMtm(paramsFaturamentoPeriodo2),
          api.sales.faturamentoFranquias(paramsFaturamentoPeriodo2),
          api.sales.faturamentoRevenda(paramsFaturamentoPeriodo2),
        ]);

        // Buscar CMV do Período 2
        const paramsCMVPeriodo2Varejo = {
          dataInicio: periodoComparacao.dt_inicio,
          dataFim: periodoComparacao.dt_fim,
          cd_grupoempresa: empresasVarejo,
        };

        const paramsCMVPeriodo2Fixas = {
          dataInicio: periodoComparacao.dt_inicio,
          dataFim: periodoComparacao.dt_fim,
          cd_grupoempresa: empresasFixas,
        };

        const [
          cmvVarejoPeriodo2,
          cmvMultimarcasPeriodo2,
          cmvFranquiasPeriodo2,
          cmvRevendaPeriodo2,
        ] = await Promise.all([
          api.sales.cmvVarejo(paramsCMVPeriodo2Varejo),
          api.sales.cmvMultimarcas(paramsCMVPeriodo2Fixas),
          api.sales.cmvFranquias(paramsCMVPeriodo2Fixas),
          api.sales.cmvRevenda(paramsCMVPeriodo2Fixas),
        ]);

        // Processar dados do Período 2 (mesma lógica do Período 1)
        const dadosFaturamentoVarejoPeriodo2 = calcularDadosFaturamento(
          faturamentoVarejoPeriodo2,
        );
        const dadosFaturamentoMultimarcasPeriodo2 = calcularDadosFaturamento(
          faturamentoMultimarcasPeriodo2,
        );
        const dadosFaturamentoFranquiasPeriodo2 = calcularDadosFaturamento(
          faturamentoFranquiasPeriodo2,
        );
        const dadosFaturamentoRevendaPeriodo2 = calcularDadosFaturamento(
          faturamentoRevendaPeriodo2,
        );

        const dadosCMVVarejoPeriodo2 = calcularCMV(cmvVarejoPeriodo2);
        const dadosCMVMultimarcasPeriodo2 = calcularCMV(cmvMultimarcasPeriodo2);
        const dadosCMVFranquiasPeriodo2 = calcularCMV(cmvFranquiasPeriodo2);
        const dadosCMVRevendaPeriodo2 = calcularCMV(cmvRevendaPeriodo2);

        const totalReceitaBrutaPeriodo2 =
          dadosFaturamentoVarejoPeriodo2.receitaBruta +
          dadosFaturamentoMultimarcasPeriodo2.receitaBruta +
          dadosFaturamentoFranquiasPeriodo2.receitaBruta +
          dadosFaturamentoRevendaPeriodo2.receitaBruta;

        const totalVendasBrutasPeriodo2 = totalReceitaBrutaPeriodo2;

        const totalDevolucoesLiquidasPeriodo2 =
          dadosFaturamentoVarejoPeriodo2.devolucoesLiquidas +
          dadosFaturamentoMultimarcasPeriodo2.devolucoesLiquidas +
          dadosFaturamentoFranquiasPeriodo2.devolucoesLiquidas +
          dadosFaturamentoRevendaPeriodo2.devolucoesLiquidas;

        const totalDescontosPeriodo2 =
          dadosFaturamentoVarejoPeriodo2.descontos +
          dadosFaturamentoMultimarcasPeriodo2.descontos +
          dadosFaturamentoFranquiasPeriodo2.descontos +
          dadosFaturamentoRevendaPeriodo2.descontos;

        const totalCMVPeriodo2 =
          dadosCMVVarejoPeriodo2.cmv +
          dadosCMVMultimarcasPeriodo2.cmv +
          dadosCMVFranquiasPeriodo2.cmv +
          dadosCMVRevendaPeriodo2.cmv;

        // Criar estrutura de totais por canal para Período 2
        const totaisVarejoPeriodo2 = {
          totalBruto: dadosFaturamentoVarejoPeriodo2.receitaBruta,
          totalDevolucoes: dadosFaturamentoVarejoPeriodo2.devolucoesLiquidas,
          totalLiquido: dadosFaturamentoVarejoPeriodo2.receitaLiquida,
          totalCMV: dadosCMVVarejoPeriodo2.cmv,
          descontos: dadosFaturamentoVarejoPeriodo2.descontos,
        };

        const totaisMultimarcasPeriodo2 = {
          totalBruto: dadosFaturamentoMultimarcasPeriodo2.receitaBruta,
          totalDevolucoes:
            dadosFaturamentoMultimarcasPeriodo2.devolucoesLiquidas,
          totalLiquido: dadosFaturamentoMultimarcasPeriodo2.receitaLiquida,
          totalCMV: dadosCMVMultimarcasPeriodo2.cmv,
          descontos: dadosFaturamentoMultimarcasPeriodo2.descontos,
        };

        const totaisFranquiasPeriodo2 = {
          totalBruto: dadosFaturamentoFranquiasPeriodo2.receitaBruta,
          totalDevolucoes: dadosFaturamentoFranquiasPeriodo2.devolucoesLiquidas,
          totalLiquido: dadosFaturamentoFranquiasPeriodo2.receitaLiquida,
          totalCMV: dadosCMVFranquiasPeriodo2.cmv,
          descontos: dadosFaturamentoFranquiasPeriodo2.descontos,
        };

        const totaisRevendaPeriodo2 = {
          totalBruto: dadosFaturamentoRevendaPeriodo2.receitaBruta,
          totalDevolucoes: dadosFaturamentoRevendaPeriodo2.devolucoesLiquidas,
          totalLiquido: dadosFaturamentoRevendaPeriodo2.receitaLiquida,
          totalCMV: dadosCMVRevendaPeriodo2.cmv,
          descontos: dadosFaturamentoRevendaPeriodo2.descontos,
        };

        // Buscar impostos do Período 2
        const responseImpostosPeriodo2 = await api.sales.impostosPorCanal({
          dataInicio: periodoComparacao.dt_inicio,
          dataFim: periodoComparacao.dt_fim,
        });

        const impostosDataPeriodo2 =
          responseImpostosPeriodo2?.success && responseImpostosPeriodo2?.data
            ? responseImpostosPeriodo2.data
            : null;

        const impostosVarejoPeriodo2 = {
          icms: impostosDataPeriodo2?.varejo?.icms || 0,
          pis: impostosDataPeriodo2?.varejo?.pis || 0,
          cofins: impostosDataPeriodo2?.varejo?.cofins || 0,
        };

        const impostosMultimarcasPeriodo2 = {
          icms: impostosDataPeriodo2?.multimarcas?.icms || 0,
          pis: impostosDataPeriodo2?.multimarcas?.pis || 0,
          cofins: impostosDataPeriodo2?.multimarcas?.cofins || 0,
        };

        const impostosFranquiasPeriodo2 = {
          icms: impostosDataPeriodo2?.franquias?.icms || 0,
          pis: impostosDataPeriodo2?.franquias?.pis || 0,
          cofins: impostosDataPeriodo2?.franquias?.cofins || 0,
        };

        const impostosRevendaPeriodo2 = {
          icms: impostosDataPeriodo2?.revenda?.icms || 0,
          pis: impostosDataPeriodo2?.revenda?.pis || 0,
          cofins: impostosDataPeriodo2?.revenda?.cofins || 0,
        };

        const icmsRealPeriodo2 =
          impostosVarejoPeriodo2.icms +
          impostosMultimarcasPeriodo2.icms +
          impostosFranquiasPeriodo2.icms +
          impostosRevendaPeriodo2.icms;

        const pisRealPeriodo2 =
          impostosVarejoPeriodo2.pis +
          impostosMultimarcasPeriodo2.pis +
          impostosFranquiasPeriodo2.pis +
          impostosRevendaPeriodo2.pis;

        const cofinsRealPeriodo2 =
          impostosVarejoPeriodo2.cofins +
          impostosMultimarcasPeriodo2.cofins +
          impostosFranquiasPeriodo2.cofins +
          impostosRevendaPeriodo2.cofins;

        const totalImpostosRealPeriodo2 =
          icmsRealPeriodo2 + pisRealPeriodo2 + cofinsRealPeriodo2;

        const totalDeducoesCalculadoPeriodo2 =
          totalDevolucoesLiquidasPeriodo2 +
          totalDescontosPeriodo2 +
          totalImpostosRealPeriodo2;

        const receitaLiquidaCalculadaPeriodo2 =
          totalVendasBrutasPeriodo2 - totalDeducoesCalculadoPeriodo2;
        const lucroBrutoCalculadoPeriodo2 =
          receitaLiquidaCalculadaPeriodo2 - totalCMVPeriodo2;

        // Calcular receitas líquidas por canal para Período 2
        const receitaLiquidaVarejoPeriodo2 =
          totaisVarejoPeriodo2.totalBruto -
          (totaisVarejoPeriodo2.totalDevolucoes +
            totaisVarejoPeriodo2.descontos +
            impostosVarejoPeriodo2.icms +
            impostosVarejoPeriodo2.pis +
            impostosVarejoPeriodo2.cofins);

        const receitaLiquidaMultimarcasPeriodo2 =
          totaisMultimarcasPeriodo2.totalBruto -
          (totaisMultimarcasPeriodo2.totalDevolucoes +
            totaisMultimarcasPeriodo2.descontos +
            impostosMultimarcasPeriodo2.icms +
            impostosMultimarcasPeriodo2.pis +
            impostosMultimarcasPeriodo2.cofins);

        const receitaLiquidaFranquiasPeriodo2 =
          totaisFranquiasPeriodo2.totalBruto -
          (totaisFranquiasPeriodo2.totalDevolucoes +
            totaisFranquiasPeriodo2.descontos +
            impostosFranquiasPeriodo2.icms +
            impostosFranquiasPeriodo2.pis +
            impostosFranquiasPeriodo2.cofins);

        const receitaLiquidaRevendaPeriodo2 =
          totaisRevendaPeriodo2.totalBruto -
          (totaisRevendaPeriodo2.totalDevolucoes +
            totaisRevendaPeriodo2.descontos +
            impostosRevendaPeriodo2.icms +
            impostosRevendaPeriodo2.pis +
            impostosRevendaPeriodo2.cofins);

        // Lucro bruto por canal para Período 2
        const lucroBrutoVarejoPeriodo2 =
          receitaLiquidaVarejoPeriodo2 - totaisVarejoPeriodo2.totalCMV;
        const lucroBrutoMultimarcasPeriodo2 =
          receitaLiquidaMultimarcasPeriodo2 -
          totaisMultimarcasPeriodo2.totalCMV;
        const lucroBrutoFranquiasPeriodo2 =
          receitaLiquidaFranquiasPeriodo2 - totaisFranquiasPeriodo2.totalCMV;
        const lucroBrutoRevendaPeriodo2 =
          receitaLiquidaRevendaPeriodo2 - totaisRevendaPeriodo2.totalCMV;

        // Buscar despesas do Período 2
        const todasEmpresasCodigos = [
          1, 2, 5, 6, 7, 11, 31, 55, 65, 75, 85, 90, 91, 92, 93, 94, 95, 96, 97,
          98, 99, 100, 101, 111, 200, 311, 500, 550, 600, 650, 700, 750, 850,
          890, 910, 920, 930, 940, 950, 960, 970, 980, 990,
        ];

        const paramsCPPeriodo2 = {
          dt_inicio: periodoComparacao.dt_inicio,
          dt_fim: periodoComparacao.dt_fim,
          cd_empresa: todasEmpresasCodigos,
        };

        const contasPagarPeriodo2 = await api.financial.contasPagarEmissao(
          paramsCPPeriodo2,
        );

        let dadosCPPeriodo2 = [];
        if (Array.isArray(contasPagarPeriodo2?.data)) {
          dadosCPPeriodo2 = contasPagarPeriodo2.data;
        } else if (
          contasPagarPeriodo2?.data?.data &&
          Array.isArray(contasPagarPeriodo2.data.data)
        ) {
          dadosCPPeriodo2 = contasPagarPeriodo2.data.data;
        } else if (Array.isArray(contasPagarPeriodo2?.rows)) {
          dadosCPPeriodo2 = contasPagarPeriodo2.rows;
        } else if (
          contasPagarPeriodo2?.data?.rows &&
          Array.isArray(contasPagarPeriodo2.data.rows)
        ) {
          dadosCPPeriodo2 = contasPagarPeriodo2.data.rows;
        }

        let totalOperacionaisPeriodo2 = 0;
        let totalFinanceirosPeriodo2 = 0;

        for (const item of dadosCPPeriodo2) {
          const ccustoRaw =
            item.cd_ccusto ??
            item.ccusto ??
            item.cd_centrocusto ??
            item.centrocusto ??
            item.cc_custo ??
            item.centro_custo ??
            item.cd_ccusto_padrao;
          const ccustoNum = Number(ccustoRaw);
          if (!Number.isNaN(ccustoNum) && ccustoNum === 999) continue;

          const codigoDespesa = Number(item.cd_despesaitem) || 0;
          if (shouldExcluirDespesa(codigoDespesa)) continue;

          const valorRateio = parseFloat(item.vl_rateio || 0) || 0;
          const valorDuplicata = parseFloat(item.vl_duplicata || 0) || 0;
          const valor = valorRateio !== 0 ? valorRateio : valorDuplicata;

          if (codigoDespesa >= 7000 && codigoDespesa <= 7999) {
            totalFinanceirosPeriodo2 += Math.abs(valor);
          } else {
            totalOperacionaisPeriodo2 += Math.abs(valor);
          }
        }

        // Salvar dados do Período 2
        setDadosPeriodo2({
          vendasBrutas: totalVendasBrutasPeriodo2,
          devolucoes: totalDevolucoesLiquidasPeriodo2,
          descontos: totalDescontosPeriodo2,
          totalDeducoes: totalDeducoesCalculadoPeriodo2,
          cmv: totalCMVPeriodo2,
          receitaLiquida: receitaLiquidaCalculadaPeriodo2,
          lucroBruto: lucroBrutoCalculadoPeriodo2,
          icms: icmsRealPeriodo2,
          pis: pisRealPeriodo2,
          cofins: cofinsRealPeriodo2,
          totalImpostos: totalImpostosRealPeriodo2,
          planoDespesasTotal: totalOperacionaisPeriodo2,
          planoDespesasFinanceirasTotal: totalFinanceirosPeriodo2,
          // Dados por canal
          totaisVarejo: totaisVarejoPeriodo2,
          totaisMultimarcas: totaisMultimarcasPeriodo2,
          totaisFranquias: totaisFranquiasPeriodo2,
          totaisRevenda: totaisRevendaPeriodo2,
          impostosVarejo: impostosVarejoPeriodo2,
          impostosMultimarcas: impostosMultimarcasPeriodo2,
          impostosFranquias: impostosFranquiasPeriodo2,
          impostosRevenda: impostosRevendaPeriodo2,
          receitaLiquidaVarejo: receitaLiquidaVarejoPeriodo2,
          receitaLiquidaMultimarcas: receitaLiquidaMultimarcasPeriodo2,
          receitaLiquidaFranquias: receitaLiquidaFranquiasPeriodo2,
          receitaLiquidaRevenda: receitaLiquidaRevendaPeriodo2,
          cmvVarejo: totaisVarejoPeriodo2.totalCMV,
          cmvMultimarcas: totaisMultimarcasPeriodo2.totalCMV,
          cmvFranquias: totaisFranquiasPeriodo2.totalCMV,
          cmvRevenda: totaisRevendaPeriodo2.totalCMV,
          lucroBrutoVarejo: lucroBrutoVarejoPeriodo2,
          lucroBrutoMultimarcas: lucroBrutoMultimarcasPeriodo2,
          lucroBrutoFranquias: lucroBrutoFranquiasPeriodo2,
          lucroBrutoRevenda: lucroBrutoRevendaPeriodo2,
        });

        console.log('📊 Dados do Período 2 carregados:', {
          periodo2: {
            inicio: periodoComparacao.dt_inicio,
            fim: periodoComparacao.dt_fim,
          },
          vendasBrutas: totalVendasBrutasPeriodo2,
          lucroBruto: lucroBrutoCalculadoPeriodo2,
        });
      }

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
  }, [api, periodo, tipoAnalise, periodoComparacao, shouldExcluirDespesa]);

  // Remover busca automática - só buscar quando clicar no botão

  // Funções auxiliares de formatação
  const formatCurrency = (value) => {
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));

    return value < 0 ? `-${formatted}` : formatted;
  };

  // Função auxiliar para calcular porcentagem
  const calcularPorcentagem = (valor, total) => {
    if (total === 0) return 0;
    return Math.abs((valor / total) * 100);
  };

  // Função auxiliar para gerar estrutura DRE com base em dados específicos
  const gerarEstruturaDRE = useCallback((dados) => {
    const {
      vendasBrutas: vb,
      devolucoes: dev,
      descontos: desc,
      totalDeducoes: td,
      cmv: cmvVal,
      receitaLiquida: rl,
      lucroBruto: lb,
      icms: icmsVal,
      pis: pisVal,
      cofins: cofinsVal,
      totalImpostos: ti,
      planoDespesasTotal: pdt,
      planoDespesasFinanceirasTotal: pdft,
      totaisVarejo: tv,
      totaisMultimarcas: tm,
      totaisFranquias: tf,
      totaisRevenda: tr,
      impostosVarejo: iv,
      impostosMultimarcas: im,
      impostosFranquias: ifrq,
      impostosRevenda: ir,
      receitaLiquidaVarejo: rlv,
      receitaLiquidaMultimarcas: rlm,
      receitaLiquidaFranquias: rlf,
      receitaLiquidaRevenda: rlr,
      cmvVarejo: cv,
      cmvMultimarcas: cmtm,
      cmvFranquias: cf,
      cmvRevenda: cr,
      lucroBrutoVarejo: lbv,
      lucroBrutoMultimarcas: lbm,
      lucroBrutoFranquias: lbf,
      lucroBrutoRevenda: lbr,
    } = dados;

    // Despesas Operacionais
    const despesasOperacionaisNode = {
      id: 'despesas-operacionais',
      label: 'Despesas Operacionais',
      description:
        'Linhas de Contas a Pagar (Emissão), para classificação posterior.',
      value: -pdt,
      type: 'despesa',
      children: [],
    };

    // Despesas Financeiras
    const despesasFinanceirasNode = {
      id: 'despesas-financeiras',
      label: 'Despesas Financeiras',
      description: 'Encargos, juros e demais despesas financeiras.',
      value: -pdft,
      type: 'despesa',
      children: [],
    };

    return [
      {
        id: 'vendas-bruta',
        label: 'Receitas Brutas',
        description: 'Quanto você vendeu no período (sem tirar nada ainda).',
        value: vb,
        type: 'receita',
        children: [
          {
            id: 'varejo',
            label: `Varejo ${calcularPorcentagem(tv.totalBruto, vb).toFixed(
              1,
            )}%`,
            description: 'Vendas do canal Varejo',
            value: tv.totalBruto,
            type: 'receita',
          },
          {
            id: 'multimarcas',
            label: `Multimarcas ${calcularPorcentagem(
              tm.totalBruto,
              vb,
            ).toFixed(1)}%`,
            description: 'Vendas do canal Multimarcas',
            value: tm.totalBruto,
            type: 'receita',
          },
          {
            id: 'revenda',
            label: `Revenda ${calcularPorcentagem(tr.totalBruto, vb).toFixed(
              1,
            )}%`,
            description: 'Vendas do canal Revenda',
            value: tr.totalBruto,
            type: 'receita',
          },
          {
            id: 'franquias',
            label: `Franquias ${calcularPorcentagem(tf.totalBruto, vb).toFixed(
              1,
            )}%`,
            description: 'Vendas do canal Franquias',
            value: tf.totalBruto,
            type: 'receita',
          },
        ],
      },
      {
        id: 'deducoes-vendas',
        label: 'Deduções sobre Vendas',
        description:
          'Devoluções, descontos concedidos e impostos sobre vendas.',
        value: -(dev + desc + ti),
        type: 'deducao',
        children: [
          {
            id: 'devolucoes',
            label: 'Devoluções',
            description: 'Clientes devolveram mercadorias',
            value: -dev,
            type: 'deducao',
            children: [
              {
                id: 'devolucoes-varejo',
                label: `Varejo ${calcularPorcentagem(
                  tv.totalDevolucoes,
                  dev,
                ).toFixed(1)}%`,
                description: 'Devoluções do canal Varejo',
                value: -tv.totalDevolucoes,
                type: 'deducao',
              },
              {
                id: 'devolucoes-multimarcas',
                label: `Multimarcas ${calcularPorcentagem(
                  tm.totalDevolucoes,
                  dev,
                ).toFixed(1)}%`,
                description: 'Devoluções do canal Multimarcas',
                value: -tm.totalDevolucoes,
                type: 'deducao',
              },
              {
                id: 'devolucoes-revenda',
                label: `Revenda ${calcularPorcentagem(
                  tr.totalDevolucoes,
                  dev,
                ).toFixed(1)}%`,
                description: 'Devoluções do canal Revenda',
                value: -tr.totalDevolucoes,
                type: 'deducao',
              },
              {
                id: 'devolucoes-franquias',
                label: `Franquias ${calcularPorcentagem(
                  tf.totalDevolucoes,
                  dev,
                ).toFixed(1)}%`,
                description: 'Devoluções do canal Franquias',
                value: -tf.totalDevolucoes,
                type: 'deducao',
              },
            ],
          },
          {
            id: 'descontos',
            label: 'Descontos Concedidos',
            description: 'Descontos dados aos clientes',
            value: -(
              tv.totalBruto -
              tv.totalDevolucoes -
              (tv.totalLiquido - tv.totalDevolucoes) +
              (tm.totalBruto -
                tm.totalDevolucoes -
                (tm.totalLiquido - tm.totalDevolucoes)) +
              (tr.totalBruto -
                tr.totalDevolucoes -
                (tr.totalLiquido - tr.totalDevolucoes)) +
              (tf.totalBruto -
                tf.totalDevolucoes -
                (tf.totalLiquido - tf.totalDevolucoes))
            ),
            type: 'deducao',
            children: [
              {
                id: 'descontos-varejo',
                label: `Varejo ${calcularPorcentagem(
                  tv.totalBruto -
                    tv.totalDevolucoes -
                    (tv.totalLiquido - tv.totalDevolucoes),
                  desc,
                ).toFixed(1)}%`,
                description: 'Descontos do canal Varejo',
                value: -(
                  tv.totalBruto -
                  tv.totalDevolucoes -
                  (tv.totalLiquido - tv.totalDevolucoes)
                ),
                type: 'deducao',
              },
              {
                id: 'descontos-multimarcas',
                label: `Multimarcas ${calcularPorcentagem(
                  tm.totalBruto -
                    tm.totalDevolucoes -
                    (tm.totalLiquido - tm.totalDevolucoes),
                  desc,
                ).toFixed(1)}%`,
                description: 'Descontos do canal Multimarcas',
                value: -(
                  tm.totalBruto -
                  tm.totalDevolucoes -
                  (tm.totalLiquido - tm.totalDevolucoes)
                ),
                type: 'deducao',
              },
              {
                id: 'descontos-revenda',
                label: `Revenda ${calcularPorcentagem(
                  tr.totalBruto -
                    tr.totalDevolucoes -
                    (tr.totalLiquido - tr.totalDevolucoes),
                  desc,
                ).toFixed(1)}%`,
                description: 'Descontos do canal Revenda',
                value: -(
                  tr.totalBruto -
                  tr.totalDevolucoes -
                  (tr.totalLiquido - tr.totalDevolucoes)
                ),
                type: 'deducao',
              },
              {
                id: 'descontos-franquias',
                label: `Franquias ${calcularPorcentagem(
                  tf.totalBruto -
                    tf.totalDevolucoes -
                    (tf.totalLiquido - tf.totalDevolucoes),
                  desc,
                ).toFixed(1)}%`,
                description: 'Descontos do canal Franquias',
                value: -(
                  tf.totalBruto -
                  tf.totalDevolucoes -
                  (tf.totalLiquido - tf.totalDevolucoes)
                ),
                type: 'deducao',
              },
            ],
          },
          {
            id: 'impostos-vendas',
            label: 'Impostos sobre Vendas',
            description: 'ICMS, PIS, COFINS e outros impostos sobre vendas.',
            value: -ti,
            type: 'deducao',
            children: [
              {
                id: 'impostos-varejo',
                label: `Varejo ${calcularPorcentagem(
                  iv.icms + iv.pis + iv.cofins,
                  ti,
                ).toFixed(1)}%`,
                description: 'Impostos do canal Varejo',
                value: -(iv.icms + iv.pis + iv.cofins),
                type: 'deducao',
                children: [
                  {
                    id: 'icms-varejo',
                    label: 'ICMS',
                    description: 'ICMS do canal Varejo',
                    value: -iv.icms,
                    type: 'deducao',
                  },
                  {
                    id: 'pis-varejo',
                    label: 'PIS',
                    description: 'PIS do canal Varejo',
                    value: -iv.pis,
                    type: 'deducao',
                  },
                  {
                    id: 'cofins-varejo',
                    label: 'COFINS',
                    description: 'COFINS do canal Varejo',
                    value: -iv.cofins,
                    type: 'deducao',
                  },
                ],
              },
              {
                id: 'impostos-multimarcas',
                label: `Multimarcas ${calcularPorcentagem(
                  im.icms + im.pis + im.cofins,
                  ti,
                ).toFixed(1)}%`,
                description: 'Impostos do canal Multimarcas',
                value: -(im.icms + im.pis + im.cofins),
                type: 'deducao',
                children: [
                  {
                    id: 'icms-multimarcas',
                    label: 'ICMS',
                    description: 'ICMS do canal Multimarcas',
                    value: -im.icms,
                    type: 'deducao',
                  },
                  {
                    id: 'pis-multimarcas',
                    label: 'PIS',
                    description: 'PIS do canal Multimarcas',
                    value: -im.pis,
                    type: 'deducao',
                  },
                  {
                    id: 'cofins-multimarcas',
                    label: 'COFINS',
                    description: 'COFINS do canal Multimarcas',
                    value: -im.cofins,
                    type: 'deducao',
                  },
                ],
              },
              {
                id: 'impostos-revenda',
                label: `Revenda ${calcularPorcentagem(
                  ir.icms + ir.pis + ir.cofins,
                  ti,
                ).toFixed(1)}%`,
                description: 'Impostos do canal Revenda',
                value: -(ir.icms + ir.pis + ir.cofins),
                type: 'deducao',
                children: [
                  {
                    id: 'icms-revenda',
                    label: 'ICMS',
                    description: 'ICMS do canal Revenda',
                    value: -ir.icms,
                    type: 'deducao',
                  },
                  {
                    id: 'pis-revenda',
                    label: 'PIS',
                    description: 'PIS do canal Revenda',
                    value: -ir.pis,
                    type: 'deducao',
                  },
                  {
                    id: 'cofins-revenda',
                    label: 'COFINS',
                    description: 'COFINS do canal Revenda',
                    value: -ir.cofins,
                    type: 'deducao',
                  },
                ],
              },
              {
                id: 'impostos-franquias',
                label: `Franquias ${calcularPorcentagem(
                  ifrq.icms + ifrq.pis + ifrq.cofins,
                  ti,
                ).toFixed(1)}%`,
                description: 'Impostos do canal Franquias',
                value: -(ifrq.icms + ifrq.pis + ifrq.cofins),
                type: 'deducao',
                children: [
                  {
                    id: 'icms-franquias',
                    label: 'ICMS',
                    description: 'ICMS do canal Franquias',
                    value: -ifrq.icms,
                    type: 'deducao',
                  },
                  {
                    id: 'pis-franquias',
                    label: 'PIS',
                    description: 'PIS do canal Franquias',
                    value: -ifrq.pis,
                    type: 'deducao',
                  },
                  {
                    id: 'cofins-franquias',
                    label: 'COFINS',
                    description: 'COFINS do canal Franquias',
                    value: -ifrq.cofins,
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
        value: rl,
        type: 'resultado',
        children: [
          {
            id: 'receita-liquida-varejo',
            label: `Varejo ${calcularPorcentagem(rlv, rl).toFixed(1)}%`,
            description: 'Receita líquida do canal Varejo',
            value: rlv,
            type: 'resultado',
          },
          {
            id: 'receita-liquida-multimarcas',
            label: `Multimarcas ${calcularPorcentagem(rlm, rl).toFixed(1)}%`,
            description: 'Receita líquida do canal Multimarcas',
            value: rlm,
            type: 'resultado',
          },
          {
            id: 'receita-liquida-revenda',
            label: `Revenda ${calcularPorcentagem(rlr, rl).toFixed(1)}%`,
            description: 'Receita líquida do canal Revenda',
            value: rlr,
            type: 'resultado',
          },
          {
            id: 'receita-liquida-franquias',
            label: `Franquias ${calcularPorcentagem(rlf, rl).toFixed(1)}%`,
            description: 'Receita líquida do canal Franquias',
            value: rlf,
            type: 'resultado',
          },
        ],
      },
      {
        id: 'cmv',
        label: 'Custos da Mercadoria Vendida (CMV)',
        description: 'Quanto custou comprar ou produzir o que você vendeu.',
        value: -cmvVal,
        type: 'custo',
        children: [
          {
            id: 'cmv-varejo',
            label: `Varejo ${calcularPorcentagem(cv, cmvVal).toFixed(1)}%`,
            description: 'CMV do canal Varejo',
            value: -cv,
            type: 'custo',
          },
          {
            id: 'cmv-multimarcas',
            label: `Multimarcas ${calcularPorcentagem(cmtm, cmvVal).toFixed(
              1,
            )}%`,
            description: 'CMV do canal Multimarcas',
            value: -cmtm,
            type: 'custo',
          },
          {
            id: 'cmv-revenda',
            label: `Revenda ${calcularPorcentagem(cr, cmvVal).toFixed(1)}%`,
            description: 'CMV do canal Revenda',
            value: -cr,
            type: 'custo',
          },
          {
            id: 'cmv-franquias',
            label: `Franquias ${calcularPorcentagem(cf, cmvVal).toFixed(1)}%`,
            description: 'CMV do canal Franquias',
            value: -cf,
            type: 'custo',
          },
        ],
      },
      {
        id: 'lucro-bruto',
        label: 'Lucro Bruto',
        description: 'Receita Líquida – CMV',
        value: lb,
        type: 'resultado',
        children: [
          {
            id: 'lucro-bruto-varejo',
            label: `Varejo ${calcularPorcentagem(lbv, lb).toFixed(1)}%`,
            description: 'Lucro bruto do canal Varejo',
            value: lbv,
            type: 'resultado',
          },
          {
            id: 'lucro-bruto-multimarcas',
            label: `Multimarcas ${calcularPorcentagem(lbm, lb).toFixed(1)}%`,
            description: 'Lucro bruto do canal Multimarcas',
            value: lbm,
            type: 'resultado',
          },
          {
            id: 'lucro-bruto-revenda',
            label: `Revenda ${calcularPorcentagem(lbr, lb).toFixed(1)}%`,
            description: 'Lucro bruto do canal Revenda',
            value: lbr,
            type: 'resultado',
          },
          {
            id: 'lucro-bruto-franquias',
            label: `Franquias ${calcularPorcentagem(lbf, lb).toFixed(1)}%`,
            description: 'Lucro bruto do canal Franquias',
            value: lbf,
            type: 'resultado',
          },
        ],
      },
      despesasOperacionaisNode,
      {
        id: 'resultado-operacional',
        label: 'Resultado Operacional',
        description: 'Lucro Bruto - Despesas Operacionais',
        value: lb - pdt,
        type: 'resultado',
        children: [],
      },
      despesasFinanceirasNode,
      {
        id: 'lucro-antes-impostos',
        label: 'Lucro Antes do IR/CSLL',
        description: 'Resultado antes dos impostos sobre o lucro.',
        value: lb - pdt - pdft,
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
        value: lb - pdt - pdft - 0,
        type: 'resultado-final',
        children: [],
      },
    ];
  }, []);

  // Dados do DRE com vendas brutas reais (Período 1)
  const dreData = useMemo(() => {
    const estruturaDRE = gerarEstruturaDRE({
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
      planoDespesasFinanceirasTotal,
      totaisVarejo,
      totaisMultimarcas,
      totaisFranquias,
      totaisRevenda,
      impostosVarejo,
      impostosMultimarcas,
      impostosFranquias,
      impostosRevenda,
      receitaLiquidaVarejo,
      receitaLiquidaMultimarcas,
      receitaLiquidaFranquias,
      receitaLiquidaRevenda,
      cmvVarejo,
      cmvMultimarcas,
      cmvFranquias,
      cmvRevenda,
      lucroBrutoVarejo,
      lucroBrutoMultimarcas,
      lucroBrutoFranquias,
      lucroBrutoRevenda,
    });

    // Adicionar children aos nós de despesas (usa dados reais do Período 1)
    const despesasOpIndex = estruturaDRE.findIndex(
      (n) => n.id === 'despesas-operacionais',
    );
    if (despesasOpIndex >= 0) {
      estruturaDRE[despesasOpIndex].children = planoDespesasNodes;
    }

    const despesasFinIndex = estruturaDRE.findIndex(
      (n) => n.id === 'despesas-financeiras',
    );
    if (despesasFinIndex >= 0) {
      estruturaDRE[despesasFinIndex].children = planoDespesasFinanceirasNodes;
    }

    return estruturaDRE;
  }, [
    gerarEstruturaDRE,
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
    impostosVarejo,
    impostosMultimarcas,
    impostosFranquias,
    impostosRevenda,
    receitaLiquidaVarejo,
    receitaLiquidaMultimarcas,
    receitaLiquidaFranquias,
    receitaLiquidaRevenda,
    cmvVarejo,
    cmvMultimarcas,
    cmvFranquias,
    cmvRevenda,
    lucroBrutoVarejo,
    lucroBrutoMultimarcas,
    lucroBrutoFranquias,
    lucroBrutoRevenda,
    planoDespesasFinanceirasTotal,
  ]);

  // DRE do Período 2 (quando análise horizontal está ativa)
  const drePeriodo2Data = useMemo(() => {
    if (tipoAnalise !== 'horizontal' || !dadosPeriodo2.vendasBrutas) {
      return [];
    }

    return gerarEstruturaDRE(dadosPeriodo2);
  }, [tipoAnalise, dadosPeriodo2, gerarEstruturaDRE]);

  // DRE Consolidado (soma dos dois períodos)
  const dreConsolidadoData = useMemo(() => {
    if (tipoAnalise !== 'horizontal' || !dadosPeriodo2.vendasBrutas) {
      return [];
    }

    // Função auxiliar para somar objetos recursivamente
    const somarObjetos = (obj1, obj2) => {
      const resultado = {};
      for (const key in obj1) {
        if (
          typeof obj1[key] === 'object' &&
          !Array.isArray(obj1[key]) &&
          obj1[key] !== null
        ) {
          resultado[key] = somarObjetos(obj1[key], obj2[key] || {});
        } else {
          resultado[key] = (obj1[key] || 0) + (obj2[key] || 0);
        }
      }
      return resultado;
    };

    const dadosConsolidados = {
      vendasBrutas: vendasBrutas + dadosPeriodo2.vendasBrutas,
      devolucoes: devolucoes + dadosPeriodo2.devolucoes,
      descontos: descontos + dadosPeriodo2.descontos,
      totalDeducoes: totalDeducoes + dadosPeriodo2.totalDeducoes,
      cmv: cmv + dadosPeriodo2.cmv,
      receitaLiquida: receitaLiquida + dadosPeriodo2.receitaLiquida,
      lucroBruto: lucroBruto + dadosPeriodo2.lucroBruto,
      icms: icms + dadosPeriodo2.icms,
      pis: pis + dadosPeriodo2.pis,
      cofins: cofins + dadosPeriodo2.cofins,
      totalImpostos: totalImpostos + dadosPeriodo2.totalImpostos,
      planoDespesasTotal: planoDespesasTotal + dadosPeriodo2.planoDespesasTotal,
      planoDespesasFinanceirasTotal:
        planoDespesasFinanceirasTotal +
        dadosPeriodo2.planoDespesasFinanceirasTotal,
      totaisVarejo: somarObjetos(
        totaisVarejo,
        dadosPeriodo2.totaisVarejo || {},
      ),
      totaisMultimarcas: somarObjetos(
        totaisMultimarcas,
        dadosPeriodo2.totaisMultimarcas || {},
      ),
      totaisFranquias: somarObjetos(
        totaisFranquias,
        dadosPeriodo2.totaisFranquias || {},
      ),
      totaisRevenda: somarObjetos(
        totaisRevenda,
        dadosPeriodo2.totaisRevenda || {},
      ),
      impostosVarejo: somarObjetos(
        impostosVarejo,
        dadosPeriodo2.impostosVarejo || {},
      ),
      impostosMultimarcas: somarObjetos(
        impostosMultimarcas,
        dadosPeriodo2.impostosMultimarcas || {},
      ),
      impostosFranquias: somarObjetos(
        impostosFranquias,
        dadosPeriodo2.impostosFranquias || {},
      ),
      impostosRevenda: somarObjetos(
        impostosRevenda,
        dadosPeriodo2.impostosRevenda || {},
      ),
      receitaLiquidaVarejo:
        receitaLiquidaVarejo + (dadosPeriodo2.receitaLiquidaVarejo || 0),
      receitaLiquidaMultimarcas:
        receitaLiquidaMultimarcas +
        (dadosPeriodo2.receitaLiquidaMultimarcas || 0),
      receitaLiquidaFranquias:
        receitaLiquidaFranquias + (dadosPeriodo2.receitaLiquidaFranquias || 0),
      receitaLiquidaRevenda:
        receitaLiquidaRevenda + (dadosPeriodo2.receitaLiquidaRevenda || 0),
      cmvVarejo: cmvVarejo + (dadosPeriodo2.cmvVarejo || 0),
      cmvMultimarcas: cmvMultimarcas + (dadosPeriodo2.cmvMultimarcas || 0),
      cmvFranquias: cmvFranquias + (dadosPeriodo2.cmvFranquias || 0),
      cmvRevenda: cmvRevenda + (dadosPeriodo2.cmvRevenda || 0),
      lucroBrutoVarejo:
        lucroBrutoVarejo + (dadosPeriodo2.lucroBrutoVarejo || 0),
      lucroBrutoMultimarcas:
        lucroBrutoMultimarcas + (dadosPeriodo2.lucroBrutoMultimarcas || 0),
      lucroBrutoFranquias:
        lucroBrutoFranquias + (dadosPeriodo2.lucroBrutoFranquias || 0),
      lucroBrutoRevenda:
        lucroBrutoRevenda + (dadosPeriodo2.lucroBrutoRevenda || 0),
    };

    return gerarEstruturaDRE(dadosConsolidados);
  }, [
    tipoAnalise,
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
    planoDespesasFinanceirasTotal,
    totaisVarejo,
    totaisMultimarcas,
    totaisFranquias,
    totaisRevenda,
    impostosVarejo,
    impostosMultimarcas,
    impostosFranquias,
    impostosRevenda,
    receitaLiquidaVarejo,
    receitaLiquidaMultimarcas,
    receitaLiquidaFranquias,
    receitaLiquidaRevenda,
    cmvVarejo,
    cmvMultimarcas,
    cmvFranquias,
    cmvRevenda,
    lucroBrutoVarejo,
    lucroBrutoMultimarcas,
    lucroBrutoFranquias,
    lucroBrutoRevenda,
    dadosPeriodo2,
    gerarEstruturaDRE,
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

  const getValueColor = (value, type) => {
    if (type === 'resultado-final') {
      return value >= 0 ? 'text-green-600' : 'text-red-600';
    }
    if (type === 'resultado') {
      return value >= 0 ? 'text-[]' : 'text-red-600';
    }
    return value < 0 ? 'text-red-500' : 'text-green-600';
  };

  // Função para gerar lista de meses
  const gerarMeses = () => {
    const meses = [
      { value: '01', label: 'Jan' },
      { value: '02', label: 'Fev' },
      { value: '03', label: 'Mar' },
      { value: '04', label: 'Abr' },
      { value: '05', label: 'Mai' },
      { value: '06', label: 'Jun' },
      { value: '07', label: 'Jul' },
      { value: '08', label: 'Ago' },
      { value: '09', label: 'Set' },
      { value: '10', label: 'Out' },
      { value: '11', label: 'Nov' },
      { value: '12', label: 'Dez' },
    ];
    return meses;
  };

  // Função auxiliar para renderizar uma tree view DRE
  const renderDRETreeView = useCallback(
    (dreDataToRender, tituloColuna = null) => {
      if (!dreDataToRender || dreDataToRender.length === 0) return null;

      return (
        <div className="space-y-2 flex justify-center items-center flex-col flex-1 px-2">
          {tituloColuna && (
            <div className="bg-[#000638] to-indigo-600 text-white px-3 py-2 rounded-lg w-full text-center mb-2">
              <h3 className="text-xs font-bold">{tituloColuna}</h3>
            </div>
          )}

          {/* Módulos da DRE */}
          {dreDataToRender.map((modulo, moduloIndex) => {
            const isModuloExpanded = categoriasExpandidas.has(modulo.label);
            const resultadoSections = [];
            const isResultadoSection = resultadoSections.includes(modulo.label);

            return (
              <div
                key={`modulo-${moduloIndex}-${modulo.id}-${
                  tituloColuna || 'main'
                }`}
                className={`w-full ${
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
                            key={`subitem-${moduloIndex}-${subitemIndex}-${
                              subitem.id
                            }-${tituloColuna || 'main'}`}
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
                                      {formatCurrency(Math.abs(subitem.value))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Sub-sub-itens (3º nível) */}
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
                                          key={`subsubitem-${moduloIndex}-${subitemIndex}-${subsubitemIndex}-${
                                            subsubitem.id
                                          }-${tituloColuna || 'main'}`}
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
                                                      {subsubitem.description}
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
                                            subsubitem.children.length > 0 && (
                                              <div className="bg-white border-t border-gray-50">
                                                {subsubitem.children.map(
                                                  (
                                                    subsubsubitem,
                                                    subsubsubitemIndex,
                                                  ) => (
                                                    <div
                                                      key={`subsubsubitem-${moduloIndex}-${subitemIndex}-${subsubitemIndex}-${subsubsubitemIndex}-${
                                                        subsubsubitem.id
                                                      }-${
                                                        tituloColuna || 'main'
                                                      }`}
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
      );
    },
    [categoriasExpandidas, toggleCategoria, formatCurrency],
  );

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
        return <Dot className="w-4 h-4 text-[]" />;
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
        {/* Seletor de Tipo de Análise */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">
            Tipo de Análise
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipoAnalise"
                value="vertical"
                checked={tipoAnalise === 'vertical'}
                onChange={(e) => setTipoAnalise(e.target.value)}
                className="w-4 h-4 text-[#000638]"
              />
              <span className="text-sm font-medium">Análise Vertical</span>
              <span className="text-xs text-gray-500">(Período único)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipoAnalise"
                value="horizontal"
                checked={tipoAnalise === 'horizontal'}
                onChange={(e) => setTipoAnalise(e.target.value)}
                className="w-4 h-4 text-[#000638]"
              />
              <span className="text-sm font-medium">Análise Horizontal</span>
              <span className="text-xs text-gray-500">
                (Comparar 2 períodos)
              </span>
            </label>
          </div>
        </div>
        {/* Campos de Período de Comparação (visível apenas na análise horizontal) */}
        {tipoAnalise === 'horizontal' && (
          <>
            {/* Filtro rápido por mês para Período 2 */}
            <div className="mb-3 mt-4 pt-4 border-t border-gray-300">
              <label className="block text-sm font-semibold mb-2 text-[#000638]">
                Selecionar Mês para Comparação
              </label>
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
                    onClick={() => handleFiltroMensalComparacaoChange(mes)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filtroMensalComparacao === mes
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
                <label className="block text-xs font-semibold mb-1 text-[]">
                  Inicial (Comparação)
                </label>
                <input
                  type="date"
                  className="border border-blue-300 rounded px-2 py-1.5 w-full text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={periodoComparacao.dt_inicio}
                  onChange={(e) =>
                    setPeriodoComparacao((prev) => ({
                      ...prev,
                      dt_inicio: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[]">
                  Final (Comparação)
                </label>
                <input
                  type="date"
                  className="border border-blue-300 rounded px-2 py-1.5 w-full text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={periodoComparacao.dt_fim}
                  onChange={(e) =>
                    setPeriodoComparacao((prev) => ({
                      ...prev,
                      dt_fim: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </>
        )}

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

        {/* Card de Comparação para Análise Horizontal */}

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
                    className="bg-[] h-2 rounded-full transition-all duration-300"
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
            {/* Botões de ação */}
            <div className="flex justify-center items-center px-4 py-2">
              <button
                onClick={toggleTodosTopicos}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded transition-colors flex items-center gap-1"
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

            {/* DRE Tree Views */}
            {tipoAnalise === 'vertical' ? (
              // Análise Vertical: Apenas 1 coluna (Período 1)
              renderDRETreeView(dreData)
            ) : (
              // Análise Horizontal: 3 colunas (Período 1, Período 2, Consolidado)
              <div className="flex gap-4 px-4 overflow-x-auto">
                {renderDRETreeView(dreData, '📅 Período 1')}
                {renderDRETreeView(drePeriodo2Data, '📅 Período 2')}
                {renderDRETreeView(dreConsolidadoData, '📊 Consolidado')}
              </div>
            )}
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
