import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import LoadingSpinner from '../components/LoadingSpinner';
import { getCategoriaPorCodigo } from '../config/categoriasDespesas';
import {
  CaretDown,
  CaretRight,
  Dot,
  TrendUp,
  TrendDown,
  CurrencyDollar,
  Folder,
  FileText,
} from '@phosphor-icons/react';

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
  // Plano de Contas (Contas a Pagar - Emissão)
  const [planoDespesasNodes, setPlanoDespesasNodes] = useState([]);
  const [planoDespesasTotal, setPlanoDespesasTotal] = useState(0);

  // Despesas Financeiras (Contas a Pagar - Emissão)
  const [despesasFinanceirasNodes, setDespesasFinanceirasNodes] = useState([]);
  const [despesasFinanceirasTotal, setDespesasFinanceirasTotal] = useState(0);

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

  // Função para buscar vendas brutas das 4 rotas CMV
  const buscarVendasBrutas = useCallback(async () => {
    if (!periodo.dt_inicio || !periodo.dt_fim) return;

    setLoading(true);
    setError('');

    try {
      // Empresas fixas para rotas de franquia, multimarcas e revenda
      const empresasFixas = [1, 2, 6, 11, 31, 75, 85, 92, 99];

      // Lista específica de empresas para a rota de varejo
      const empresasVarejo = [
        // Lista fornecida pelo usuário
        1, 2, 6, 7, 11, 31, 65, 75, 85, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
        100, 101, 111, 200, 311, 600, 650, 700, 750, 850, 890, 910, 920, 930,
        940, 950, 960, 970, 980, 990,
      ];

      // Parâmetros específicos para cada rota
      const paramsVarejo = {
        dt_inicio: periodo.dt_inicio,
        dt_fim: periodo.dt_fim,
        cd_empresa: empresasVarejo,
      };

      const paramsMultimarcas = {
        dt_inicio: periodo.dt_inicio,
        dt_fim: periodo.dt_fim,
        cd_empresa: empresasFixas,
        cd_classificacao: [2], // Multimarcas
      };

      const paramsFranquia = {
        dt_inicio: periodo.dt_inicio,
        dt_fim: periodo.dt_fim,
        cd_empresa: empresasFixas,
        cd_classificacao: [4], // Franquia
      };

      const paramsRevenda = {
        dt_inicio: periodo.dt_inicio,
        dt_fim: periodo.dt_fim,
        cd_empresa: empresasFixas,
        cd_classificacao: [3], // Revenda
      };

      // Buscar dados das 4 rotas CMV sequencialmente para não sobrecarregar o banco
      setLoadingStatus('Buscando dados do Varejo...');
      const varejo = await api.sales.cmvvarejo(paramsVarejo);

      setLoadingStatus('Buscando dados do Multimarcas...');
      const multimarcas = await api.sales.cmvmultimarcas(paramsMultimarcas);

      setLoadingStatus('Buscando dados da Franquia...');
      const franquias = await api.sales.cmvfranquia(paramsFranquia);

      setLoadingStatus('Buscando dados da Revenda...');
      const revenda = await api.sales.cmvrevenda(paramsRevenda);

      setLoadingStatus('Processando dados...');

      // Função para buscar dados de impostos da rota VLIMPOSTO (baseada na Receita Líquida)
      const buscarImpostos = async (nrTransacoes, onProgress) => {
        if (!nrTransacoes || nrTransacoes.length === 0)
          return { byTransacao: {}, totals: { icms: 0, pis: 0, cofins: 0 } };

        try {
          const TAMANHO_LOTE = 500;
          const lotes = [];
          for (let i = 0; i < nrTransacoes.length; i += TAMANHO_LOTE)
            lotes.push(nrTransacoes.slice(i, i + TAMANHO_LOTE));

          console.log(
            `🔍 Buscando impostos reais em ${lotes.length} lotes de até ${TAMANHO_LOTE} transações cada`,
          );

          const MAX_CONCURRENT_BATCHES = 3;
          const resultados = [];
          for (let i = 0; i < lotes.length; i += MAX_CONCURRENT_BATCHES) {
            const batchGroup = lotes.slice(i, i + MAX_CONCURRENT_BATCHES);
            const batchPromises = batchGroup.map(async (lote) => {
              const response = await api.sales.vlimposto({
                nr_transacao: lote,
              });
              if (response.success && response.data) return response.data;
              console.warn('Resposta inválida para lote:', response);
              return [];
            });
            try {
              const batchResults = await Promise.all(batchPromises);
              resultados.push(...batchResults.flat());
            } catch (error) {
              console.error(
                `Erro em lote ${i}-${i + MAX_CONCURRENT_BATCHES}:`,
                error,
              );
            }
            const progress = Math.round(
              ((i + MAX_CONCURRENT_BATCHES) / lotes.length) * 100,
            );
            if (onProgress) onProgress(Math.min(progress, 100));
          }

          // Montar mapa por transação e totais gerais
          const byTransacao = {};
          const totals = { icms: 0, pis: 0, cofins: 0 };
          for (const item of resultados) {
            const nr = String(item.nr_transacao);
            const valor = parseFloat(item.valorimposto || 0) || 0;
            const cd = Number(item.cd_imposto);
            if (!byTransacao[nr])
              byTransacao[nr] = { icms: 0, pis: 0, cofins: 0 };
            if (cd === 1) {
              byTransacao[nr].icms += valor;
              totals.icms += valor;
            } else if (cd === 5) {
              byTransacao[nr].cofins += valor;
              totals.cofins += valor;
            } else if (cd === 6) {
              byTransacao[nr].pis += valor;
              totals.pis += valor;
            }
          }

          console.log('✅ Impostos reais agregados:', {
            totals,
            sample: Object.entries(byTransacao).slice(0, 2),
          });
          return { byTransacao, totals };
        } catch (error) {
          console.error('Erro crítico ao buscar impostos:', error);
          throw error;
        }
      };

      // Calcular vendas brutas = Receita Bruta + Devoluções (igual CMVConsolidado)
      const calcularVendasBrutas = (response) => {
        if (!response?.success || !response?.data)
          return {
            totalBruto: 0,
            totalDevolucoes: 0,
            totalLiquido: 0,
            totalCMV: 0,
          };

        // useApiClient já processa os dados, então response.data é o array direto
        const data = Array.isArray(response.data) ? response.data : [];

        let totalBruto = 0;
        let totalDevolucoes = 0;
        let totalLiquido = 0;
        let totalCMV = 0;

        for (const row of data) {
          const qtd = parseFloat(row?.qt_faturado || 1);
          const frete = parseFloat(row?.vl_freterat || 0);
          const vl_unitbruto = parseFloat(row?.vl_unitbruto || 0);
          const vl_unitliquido = parseFloat(row?.vl_unitliquido || 0);
          const vl_produto = parseFloat(row?.vl_produto || 0);

          // Calcular valores com quantidade e frete
          const bruto = vl_unitbruto * qtd + frete;
          const liquido = vl_unitliquido * qtd + frete;
          const cmv = vl_produto * qtd;

          const isDevolucao = String(row?.tp_operacao).trim() === 'E';

          if (isDevolucao) {
            // Devoluções são subtraídas (valores negativos)
            totalBruto -= Math.abs(bruto);
            totalLiquido -= Math.abs(liquido);
            totalCMV -= Math.abs(cmv); // CMV também é subtraído nas devoluções
            totalDevolucoes += Math.abs(liquido); // Devoluções são sempre positivas no total
          } else {
            // Vendas normais são somadas
            totalBruto += bruto;
            totalLiquido += liquido;
            totalCMV += cmv;
          }
        }

        return { totalBruto, totalDevolucoes, totalLiquido, totalCMV };
      };

      const totaisVarejo = calcularVendasBrutas(varejo);
      const totaisMultimarcas = calcularVendasBrutas(multimarcas);
      const totaisFranquias = calcularVendasBrutas(franquias);
      const totaisRevenda = calcularVendasBrutas(revenda);

      // Vendas Brutas = Receita Bruta + Devoluções (igual CMVConsolidado)
      const totalVendasBrutas =
        totaisVarejo.totalBruto +
        totaisVarejo.totalDevolucoes +
        totaisMultimarcas.totalBruto +
        totaisMultimarcas.totalDevolucoes +
        totaisFranquias.totalBruto +
        totaisFranquias.totalDevolucoes +
        totaisRevenda.totalBruto +
        totaisRevenda.totalDevolucoes;

      // Devoluções = Soma das devoluções de todas as rotas (igual CMVConsolidado)
      const totalDevolucoes =
        totaisVarejo.totalDevolucoes +
        totaisMultimarcas.totalDevolucoes +
        totaisFranquias.totalDevolucoes +
        totaisRevenda.totalDevolucoes;

      // Calcular totais de Receita Bruta e Receita Líquida para calcular Descontos
      const totalReceitaBruta =
        totaisVarejo.totalBruto +
        totaisMultimarcas.totalBruto +
        totaisFranquias.totalBruto +
        totaisRevenda.totalBruto;

      const totalReceitaLiquida =
        totaisVarejo.totalLiquido +
        totaisMultimarcas.totalLiquido +
        totaisFranquias.totalLiquido +
        totaisRevenda.totalLiquido;

      // CMV Total = Soma do CMV de todas as rotas (igual CMVConsolidado)
      const totalCMV =
        totaisVarejo.totalCMV +
        totaisMultimarcas.totalCMV +
        totaisFranquias.totalCMV +
        totaisRevenda.totalCMV;

      // Extrair dados das respostas das APIs
      const varejoData = Array.isArray(varejo?.data) ? varejo.data : [];
      const multimarcasData = Array.isArray(multimarcas?.data)
        ? multimarcas.data
        : [];
      const franquiasData = Array.isArray(franquias?.data)
        ? franquias.data
        : [];
      const revendaData = Array.isArray(revenda?.data) ? revenda.data : [];

      // Coletar nr_transacao separadamente por canal para buscar impostos específicos
      const transacoesVarejo = varejoData
        .filter((r) => r.tp_operacao === 'S')
        .map((r) => r.nr_transacao)
        .filter((nr, index, arr) => nr && arr.indexOf(nr) === index); // Remove duplicatas

      const transacoesMultimarcas = multimarcasData
        .filter((r) => r.tp_operacao === 'S')
        .map((r) => r.nr_transacao)
        .filter((nr, index, arr) => nr && arr.indexOf(nr) === index); // Remove duplicatas

      const transacoesFranquias = franquiasData
        .filter((r) => r.tp_operacao === 'S')
        .map((r) => r.nr_transacao)
        .filter((nr, index, arr) => nr && arr.indexOf(nr) === index); // Remove duplicatas

      const transacoesRevenda = revendaData
        .filter((r) => r.tp_operacao === 'S')
        .map((r) => r.nr_transacao)
        .filter((nr, index, arr) => nr && arr.indexOf(nr) === index); // Remove duplicatas

      console.log(`📋 Transações por canal para buscar impostos:`, {
        varejo: transacoesVarejo.length,
        multimarcas: transacoesMultimarcas.length,
        franquias: transacoesFranquias.length,
        revenda: transacoesRevenda.length,
      });

      // Buscar impostos separadamente por canal
      let impostosPorCanal = {};
      try {
        setLoadingStatus('Buscando impostos por canal...');

        // Buscar impostos do Varejo
        if (transacoesVarejo.length > 0) {
          setLoadingStatus('Buscando impostos do Varejo...');
          impostosPorCanal.varejo = await buscarImpostos(
            transacoesVarejo,
            (progress) => {
              setLoadingStatus(`Buscando impostos do Varejo... ${progress}%`);
            },
          );
        } else {
          impostosPorCanal.varejo = { totals: { icms: 0, pis: 0, cofins: 0 } };
        }

        // Buscar impostos do Multimarcas
        if (transacoesMultimarcas.length > 0) {
          setLoadingStatus('Buscando impostos do Multimarcas...');
          impostosPorCanal.multimarcas = await buscarImpostos(
            transacoesMultimarcas,
            (progress) => {
              setLoadingStatus(
                `Buscando impostos do Multimarcas... ${progress}%`,
              );
            },
          );
        } else {
          impostosPorCanal.multimarcas = {
            totals: { icms: 0, pis: 0, cofins: 0 },
          };
        }

        // Buscar impostos das Franquias
        if (transacoesFranquias.length > 0) {
          setLoadingStatus('Buscando impostos das Franquias...');
          impostosPorCanal.franquias = await buscarImpostos(
            transacoesFranquias,
            (progress) => {
              setLoadingStatus(
                `Buscando impostos das Franquias... ${progress}%`,
              );
            },
          );
        } else {
          impostosPorCanal.franquias = {
            totals: { icms: 0, pis: 0, cofins: 0 },
          };
        }

        // Buscar impostos da Revenda
        if (transacoesRevenda.length > 0) {
          setLoadingStatus('Buscando impostos da Revenda...');
          impostosPorCanal.revenda = await buscarImpostos(
            transacoesRevenda,
            (progress) => {
              setLoadingStatus(`Buscando impostos da Revenda... ${progress}%`);
            },
          );
        } else {
          impostosPorCanal.revenda = { totals: { icms: 0, pis: 0, cofins: 0 } };
        }
      } catch (error) {
        console.error('Falha crítica ao buscar impostos por canal:', error);
        setErro(
          'Erro ao buscar dados de impostos. Verifique a conexão e tente novamente.',
        );
        return;
      }

      // Atualizar estados com impostos por canal
      setImpostosVarejo(impostosPorCanal.varejo.totals);
      setImpostosMultimarcas(impostosPorCanal.multimarcas.totals);
      setImpostosFranquias(impostosPorCanal.franquias.totals);
      setImpostosRevenda(impostosPorCanal.revenda.totals);

      // Totais gerais (soma de todos os canais)
      const icmsReal =
        impostosPorCanal.varejo.totals.icms +
        impostosPorCanal.multimarcas.totals.icms +
        impostosPorCanal.franquias.totals.icms +
        impostosPorCanal.revenda.totals.icms;
      const pisReal =
        impostosPorCanal.varejo.totals.pis +
        impostosPorCanal.multimarcas.totals.pis +
        impostosPorCanal.franquias.totals.pis +
        impostosPorCanal.revenda.totals.pis;
      const cofinsReal =
        impostosPorCanal.varejo.totals.cofins +
        impostosPorCanal.multimarcas.totals.cofins +
        impostosPorCanal.franquias.totals.cofins +
        impostosPorCanal.revenda.totals.cofins;
      const totalImpostosReal = icmsReal + pisReal + cofinsReal;

      console.log('💰 Impostos reais por canal:', {
        varejo: impostosPorCanal.varejo.totals,
        multimarcas: impostosPorCanal.multimarcas.totals,
        franquias: impostosPorCanal.franquias.totals,
        revenda: impostosPorCanal.revenda.totals,
        totais: {
          icms: icmsReal,
          pis: pisReal,
          cofins: cofinsReal,
          total: totalImpostosReal,
        },
      });

      // Descontos = Vendas Brutas - Devoluções - soma(vl_unitliquido)
      // Somar vl_unitliquido considerando quantidade e sinal por tp_operacao
      const somaVlUnitLiquido = (arr) =>
        (arr || []).reduce((acc, r) => {
          const q = Number(r.qt_faturado) || 1;
          const v = (Number(r.vl_unitliquido) || 0) * q;
          if (r.tp_operacao === 'S') return acc + v;
          if (r.tp_operacao === 'E') return acc - v;
          return acc;
        }, 0);

      const somaLiquidoTotal =
        somaVlUnitLiquido(varejoData) +
        somaVlUnitLiquido(multimarcasData) +
        somaVlUnitLiquido(franquiasData) +
        somaVlUnitLiquido(revendaData);

      // Calcular descontos usando a mesma fórmula da estrutura da DRE
      const totalDescontos =
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
          (totaisFranquias.totalLiquido - totaisFranquias.totalDevolucoes));

      // Total das Deduções = Devoluções + Descontos + Impostos
      const totalDeducoesCalculado =
        totalDevolucoes + totalDescontos + totalImpostosReal;
      console.log('totalDescontos', totalDescontos);
      console.log('totalImpostosReal', totalImpostosReal);
      console.log('totalDevolucoes', totalDevolucoes);
      console.log('totalDeducoesCalculado', totalDeducoesCalculado);
      console.log('📊 Cálculo das Deduções sobre Vendas:', {
        devolucoes: totalDevolucoes,
        descontos: totalDescontos,
        impostos: totalImpostosReal,
        totalDeducoes: totalDeducoesCalculado,
        formula: 'Devoluções + Descontos + Impostos',
        verificacao: {
          soma: totalDevolucoes + totalDescontos + totalImpostosReal,
          bate:
            totalDevolucoes + totalDescontos + totalImpostosReal ===
            totalDeducoesCalculado,
        },
      });

      // Receita Líquida = Vendas Brutas - Deduções
      const receitaLiquidaCalculada =
        totalVendasBrutas - totalDeducoesCalculado;

      // Lucro Bruto = Receita Líquida - CMV
      const lucroBrutoCalculado = receitaLiquidaCalculada - totalCMV;

      // ================= CÁLCULOS POR CANAL =================

      // Calcular receitas líquidas por canal
      // Receita Líquida = Vendas Brutas - Deduções (Devoluções + Descontos + Impostos)
      const receitaLiquidaVarejoCalc =
        totaisVarejo.totalBruto +
        totaisVarejo.totalDevolucoes -
        (totaisVarejo.totalDevolucoes +
          (totaisVarejo.totalBruto +
            totaisVarejo.totalDevolucoes -
            totaisVarejo.totalLiquido) +
          (impostosPorCanal.varejo.totals.icms +
            impostosPorCanal.varejo.totals.pis +
            impostosPorCanal.varejo.totals.cofins));

      const receitaLiquidaMultimarcasCalc =
        totaisMultimarcas.totalBruto +
        totaisMultimarcas.totalDevolucoes -
        (totaisMultimarcas.totalDevolucoes +
          (totaisMultimarcas.totalBruto +
            totaisMultimarcas.totalDevolucoes -
            totaisMultimarcas.totalLiquido) +
          (impostosPorCanal.multimarcas.totals.icms +
            impostosPorCanal.multimarcas.totals.pis +
            impostosPorCanal.multimarcas.totals.cofins));

      const receitaLiquidaFranquiasCalc =
        totaisFranquias.totalBruto +
        totaisFranquias.totalDevolucoes -
        (totaisFranquias.totalDevolucoes +
          (totaisFranquias.totalBruto +
            totaisFranquias.totalDevolucoes -
            totaisFranquias.totalLiquido) +
          (impostosPorCanal.franquias.totals.icms +
            impostosPorCanal.franquias.totals.pis +
            impostosPorCanal.franquias.totals.cofins));

      const receitaLiquidaRevendaCalc =
        totaisRevenda.totalBruto +
        totaisRevenda.totalDevolucoes -
        (totaisRevenda.totalDevolucoes +
          (totaisRevenda.totalBruto +
            totaisRevenda.totalDevolucoes -
            totaisRevenda.totalLiquido) +
          (impostosPorCanal.revenda.totals.icms +
            impostosPorCanal.revenda.totals.pis +
            impostosPorCanal.revenda.totals.cofins));

      // Usar os valores corretos do CMV por canal que já estão sendo calculados
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

      console.log('📊 Dados recebidos das rotas:', {
        varejo: {
          success: varejo?.success,
          dataLength: Array.isArray(varejo?.data) ? varejo.data.length : 0,
          isArray: Array.isArray(varejo?.data),
        },
        multimarcas: {
          success: multimarcas?.success,
          dataLength: Array.isArray(multimarcas?.data)
            ? multimarcas.data.length
            : 0,
          isArray: Array.isArray(multimarcas?.data),
        },
        franquias: {
          success: franquias?.success,
          dataLength: Array.isArray(franquias?.data)
            ? franquias.data.length
            : 0,
          isArray: Array.isArray(franquias?.data),
        },
        revenda: {
          success: revenda?.success,
          dataLength: Array.isArray(revenda?.data) ? revenda.data.length : 0,
          isArray: Array.isArray(revenda?.data),
        },
      });

      // Debug: verificar estrutura dos dados
      if (
        varejo?.data &&
        Array.isArray(varejo.data) &&
        varejo.data.length > 0
      ) {
        console.log('🔍 Primeiro registro varejo:', varejo.data[0]);
      }

      console.log('📊 Totais por Segmento:', {
        varejo: {
          bruto: totaisVarejo.totalBruto,
          devolucoes: totaisVarejo.totalDevolucoes,
        },
        multimarcas: {
          bruto: totaisMultimarcas.totalBruto,
          devolucoes: totaisMultimarcas.totalDevolucoes,
        },
        franquias: {
          bruto: totaisFranquias.totalBruto,
          devolucoes: totaisFranquias.totalDevolucoes,
        },
        revenda: {
          bruto: totaisRevenda.totalBruto,
          devolucoes: totaisRevenda.totalDevolucoes,
        },
      });

      console.log('📊 Vendas Brutas (Receita Bruta + Devoluções):', {
        total: totalVendasBrutas,
        formula: 'Receita Bruta + Devoluções de todas as rotas',
      });

      console.log('📊 Devoluções Totais:', {
        total: totalDevolucoes,
        formula: 'Soma das devoluções de todas as rotas CMV',
      });

      console.log('📊 Cálculo dos Descontos:', {
        receitaBruta: totalReceitaBruta,
        receitaLiquida: totalReceitaLiquida,
        descontos: totalDescontos,
        formula: 'Receita Bruta - Receita Líquida',
      });

      console.log('📊 CMV Total:', {
        varejo: totaisVarejo.totalCMV,
        multimarcas: totaisMultimarcas.totalCMV,
        franquias: totaisFranquias.totalCMV,
        revenda: totaisRevenda.totalCMV,
        totalCMV: totalCMV,
        formula: 'Soma do CMV de todas as rotas CMV',
      });

      console.log('📊 Receita Líquida:', {
        vendasBrutas: totalVendasBrutas,
        totalDeducoes: totalDeducoesCalculado,
        receitaLiquida: receitaLiquidaCalculada,
        formula: 'Vendas Brutas - Deduções',
      });

      console.log('📊 Lucro Bruto:', {
        receitaLiquida: receitaLiquidaCalculada,
        cmv: totalCMV,
        lucroBruto: lucroBrutoCalculado,
        formula: 'Receita Líquida - CMV',
      });

      console.log('📊 Total das Deduções:', {
        devolucoes: totalDevolucoes,
        descontos: totalDescontos,
        impostos: totalImpostosReal,
        totalDeducoes: totalDeducoesCalculado,
        formula: 'Devoluções + Descontos + Impostos',
      });

      setVendasBrutas(totalVendasBrutas);
      setDevolucoes(totalDevolucoes);
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

        // Agrupar dados idênticos (mesma regra usada em ContasAPagar.jsx)
        const agruparDadosIdenticosLocal = (dados) => {
          const grupos = new Map();

          dados.forEach((item) => {
            // Criar chave única SEM vl_rateio para manter totais corretos
            const chave = `${item.cd_fornecedor}|${item.nm_fornecedor}|${item.nr_duplicata}|${item.nr_parcela}|${item.cd_empresa}|${item.dt_emissao}|${item.dt_vencimento}|${item.dt_entrada}|${item.dt_liq}|${item.tp_situacao}|${item.tp_previsaoreal}|${item.vl_duplicata}|${item.vl_juros}|${item.vl_acrescimo}|${item.vl_desconto}|${item.vl_pago}`;

            if (!grupos.has(chave)) {
              grupos.set(chave, {
                item: item,
                observacoes: [],
                situacoes: [],
                datasEmissao: [],
                datasVencimento: [],
                datasEntrada: [],
                datasLiquidacao: [],
                rateios: [],
                quantidade: 0,
              });
            }

            const grupo = grupos.get(chave);
            grupo.quantidade += 1;

            // Adicionar rateio se não existir
            if (item.vl_rateio && !grupo.rateios.includes(item.vl_rateio)) {
              grupo.rateios.push(item.vl_rateio);
            }

            // Adicionar observação se existir e for diferente
            if (
              item.ds_observacao &&
              !grupo.observacoes.includes(item.ds_observacao)
            ) {
              grupo.observacoes.push(item.ds_observacao);
            }

            // Adicionar situação se existir e for diferente
            if (
              item.tp_situacao &&
              !grupo.situacoes.includes(item.tp_situacao)
            ) {
              grupo.situacoes.push(item.tp_situacao);
            }

            // Adicionar previsão se existir e for diferente
            if (item.tp_previsaoreal && !grupo.previsoes) {
              grupo.previsoes = [];
            }
            if (
              item.tp_previsaoreal &&
              !grupo.previsoes.includes(item.tp_previsaoreal)
            ) {
              grupo.previsoes.push(item.tp_previsaoreal);
            }

            // Adicionar datas se existirem e forem diferentes
            if (
              item.dt_emissao &&
              !grupo.datasEmissao.includes(item.dt_emissao)
            ) {
              grupo.datasEmissao.push(item.dt_emissao);
            }
            if (
              item.dt_vencimento &&
              !grupo.datasVencimento.includes(item.dt_vencimento)
            ) {
              grupo.datasVencimento.push(item.dt_vencimento);
            }
            if (
              item.dt_entrada &&
              !grupo.datasEntrada.includes(item.dt_entrada)
            ) {
              grupo.datasEntrada.push(item.dt_entrada);
            }
            if (item.dt_liq && !grupo.datasLiquidacao.includes(item.dt_liq)) {
              grupo.datasLiquidacao.push(item.dt_liq);
            }
          });

          return Array.from(grupos.values()).map((grupo) => {
            // Priorizar situações
            let situacaoFinal = grupo.item.tp_situacao;
            if (grupo.situacoes.length > 1) {
              if (grupo.situacoes.includes('C')) situacaoFinal = 'C';
              else if (grupo.situacoes.includes('N')) situacaoFinal = 'N';
            }

            // Priorizar previsões: R > P > C
            let previsaoFinal = grupo.item.tp_previsaoreal;
            if (grupo.previsoes && grupo.previsoes.length > 1) {
              if (grupo.previsoes.includes('R')) previsaoFinal = 'R';
              else if (grupo.previsoes.includes('P')) previsaoFinal = 'P';
              else if (grupo.previsoes.includes('C')) previsaoFinal = 'C';
            }

            // Datas relevantes (mais recente)
            const dtEmissaoFinal =
              grupo.datasEmissao.length > 0
                ? grupo.datasEmissao.sort(
                    (a, b) => new Date(b) - new Date(a),
                  )[0]
                : grupo.item.dt_emissao;
            const dtVencimentoFinal =
              grupo.datasVencimento.length > 0
                ? grupo.datasVencimento.sort(
                    (a, b) => new Date(b) - new Date(a),
                  )[0]
                : grupo.item.dt_vencimento;
            const dtEntradaFinal =
              grupo.datasEntrada.length > 0
                ? grupo.datasEntrada.sort(
                    (a, b) => new Date(b) - new Date(a),
                  )[0]
                : grupo.item.dt_entrada;
            const dtLiqFinal =
              grupo.datasLiquidacao.length > 0
                ? grupo.datasLiquidacao.sort(
                    (a, b) => new Date(b) - new Date(a),
                  )[0]
                : grupo.item.dt_liq;

            return {
              ...grupo,
              item: {
                ...grupo.item,
                tp_situacao: situacaoFinal,
                tp_previsaoreal: previsaoFinal,
                dt_emissao: dtEmissaoFinal,
                dt_vencimento: dtVencimentoFinal,
                dt_entrada: dtEntradaFinal,
                dt_liq: dtLiqFinal,
              },
            };
          });
        };

        console.log('🔍 Debug DRE - dadosCP.length:', dadosCP.length);
        console.log('🔍 Debug DRE - primeiro item:', dadosCP[0]);

        const dadosAgrupadosCP = agruparDadosIdenticosLocal(dadosCP);
        console.log(
          '🔍 Debug DRE - dadosAgrupadosCP.length:',
          dadosAgrupadosCP.length,
        );

        // Filtrar apenas situação NORMAL (N) e previsão REAL (R ou código '2')
        const dadosFiltradosCP = dadosAgrupadosCP.filter((g) => {
          let situacaoFinal = g.item.tp_situacao;

          if (g.situacoes.length > 1) {
            if (g.situacoes.includes('C')) situacaoFinal = 'C';
            else if (g.situacoes.includes('N')) situacaoFinal = 'N';
          }

          let previsaoFinal = g.item.tp_previsaoreal;
          if (g.previsoes && g.previsoes.length > 1) {
            if (g.previsoes.includes('R')) previsaoFinal = 'R';
            else if (g.previsoes.includes('P')) previsaoFinal = 'P';
            else if (g.previsoes.includes('C')) previsaoFinal = 'C';
          }

          return (
            situacaoFinal === 'N' &&
            (previsaoFinal === 'R' || previsaoFinal === '2')
          );
        });

        console.log(
          '🔍 Debug DRE - dadosFiltradosCP.length:',
          dadosFiltradosCP.length,
        );

        // Extrair códigos únicos de despesas e fornecedores
        const codigosDespesa = [
          ...new Set(
            dadosFiltradosCP
              .map((item) => parseInt(item.item.cd_despesaitem))
              .filter((codigo) => codigo && !isNaN(codigo)),
          ),
        ];
        const codigosFornecedor = [
          ...new Set(
            dadosFiltradosCP
              .map((item) => parseInt(item.item.cd_fornecedor))
              .filter((codigo) => codigo && !isNaN(codigo)),
          ),
        ];

        console.log('🔍 Códigos únicos encontrados:', {
          despesas: codigosDespesa.length,
          fornecedores: codigosFornecedor.length,
          amostraDespesas: codigosDespesa.slice(0, 5),
          amostraFornecedores: codigosFornecedor.slice(0, 5),
        });

        // Buscar nomes das despesas
        const despesasMap = new Map();
        if (codigosDespesa.length > 0) {
          try {
            const despesasResponse = await api.financial.despesa({
              cd_despesaitem: codigosDespesa,
            });
            if (
              despesasResponse?.data &&
              Array.isArray(despesasResponse.data)
            ) {
              despesasResponse.data.forEach((despesa) => {
                if (despesa.cd_despesaitem && despesa.ds_despesaitem) {
                  despesasMap.set(
                    parseInt(despesa.cd_despesaitem),
                    despesa.ds_despesaitem,
                  );
                }
              });
            }
            console.log('📋 Despesas carregadas:', despesasMap.size);
          } catch (error) {
            console.warn('⚠️ Erro ao buscar despesas:', error);
          }
        }

        // Buscar nomes dos fornecedores
        const fornecedoresMap = new Map();
        if (codigosFornecedor.length > 0) {
          try {
            const fornecedoresResponse = await api.financial.fornecedor({
              cd_fornecedor: codigosFornecedor,
            });
            if (
              fornecedoresResponse?.data &&
              Array.isArray(fornecedoresResponse.data)
            ) {
              fornecedoresResponse.data.forEach((fornecedor) => {
                if (fornecedor.cd_fornecedor && fornecedor.nm_fornecedor) {
                  fornecedoresMap.set(
                    parseInt(fornecedor.cd_fornecedor),
                    fornecedor.nm_fornecedor,
                  );
                }
              });
            }
            console.log('👥 Fornecedores carregados:', fornecedoresMap.size);
          } catch (error) {
            console.warn('⚠️ Erro ao buscar fornecedores:', error);
          }
        }

        // Classificação por categoria (mesma lógica do ContasAPagar)
        const classificarDespesa = (cdDespesa) => {
          const codigo = parseInt(cdDespesa) || 0;
          const categoriaExcecao = getCategoriaPorCodigo(codigo);
          if (categoriaExcecao) return categoriaExcecao;
          if (codigo >= 1000 && codigo <= 1999)
            return 'CUSTO DAS MERCADORIAS VENDIDAS';
          if (codigo >= 2000 && codigo <= 2999) return 'DESPESAS OPERACIONAIS';
          if (codigo >= 3000 && codigo <= 3999) return 'DESPESAS COM PESSOAL';
          if (codigo >= 4001 && codigo <= 4999)
            return 'ALUGUÉIS E ARRENDAMENTOS';
          if (codigo >= 5000 && codigo <= 5999)
            return 'IMPOSTOS, TAXAS E CONTRIBUIÇÕES';
          if (codigo >= 6000 && codigo <= 6999) return 'DESPESAS GERAIS';
          if (codigo >= 7000 && codigo <= 7999) return 'DESPESAS FINANCEIRAS';
          if (codigo >= 8000 && codigo <= 8999)
            return 'OUTRAS DESPESAS OPERACIONAIS';
          if (codigo >= 9000 && codigo <= 9999) return 'DESPESAS C/ VENDAS';
          return 'SEM CLASSIFICAÇÃO';
        };

        // Categorias que NÃO devem aparecer nas despesas operacionais da DRE
        const categoriasExcluidasDRE = [
          'CUSTO DAS MERCADORIAS VENDIDAS',
          'IMPOSTOS, TAXAS E CONTRIBUIÇÕES',
          'ATIVOS',
          'DESPESAS FINANCEIRAS',
        ];

        // Agrupar: Categoria -> Despesa -> Fornecedor (com duplicata/parcela) e somar vl_duplicata
        const categorias = new Map();
        for (const grupo of dadosFiltradosCP) {
          const item = grupo.item;
          const categoria = classificarDespesa(item.cd_despesaitem);

          // Filtrar categorias excluídas da DRE
          if (categoriasExcluidasDRE.includes(categoria)) {
            continue;
          }

          // Usar nomes reais das despesas e fornecedores
          const nomeDespesa =
            despesasMap.get(parseInt(item.cd_despesaitem)) ||
            item.ds_despesaitem ||
            'SEM DESCRIÇÃO';
          const nomeFornecedor =
            fornecedoresMap.get(parseInt(item.cd_fornecedor)) ||
            item.nm_fornecedor ||
            'SEM FORNECEDOR';
          const nrDuplicata = item.nr_duplicata || '';
          const nrParcela = item.nr_parcela || '';
          const valor = parseFloat(item.vl_duplicata || 0) || 0;

          if (!categorias.has(categoria)) {
            categorias.set(categoria, new Map()); // map de despesas
          }
          const despesasMapLocal = categorias.get(categoria);
          if (!despesasMapLocal.has(nomeDespesa)) {
            despesasMapLocal.set(nomeDespesa, new Map()); // map de fornecedores/chaves
          }
          const fornecedoresMapLocal = despesasMapLocal.get(nomeDespesa);
          const chaveFornecedor = `${item.cd_empresa || ''}|${
            item.cd_fornecedor || ''
          }|${nomeFornecedor}|${nrDuplicata}|${nrParcela}`;
          fornecedoresMapLocal.set(
            chaveFornecedor,
            (fornecedoresMapLocal.get(chaveFornecedor) || 0) + valor,
          );
        }

        // Ordem de categorias para DRE (sem CMV, Impostos e Ativos)
        const ordemCategorias = [
          'DESPESAS OPERACIONAIS',
          'DESPESAS COM PESSOAL',
          'ALUGUÉIS E ARRENDAMENTOS',
          'DESPESAS GERAIS',
          'OUTRAS DESPESAS OPERACIONAIS',
          'DESPESAS C/ VENDAS',
          'SEM CLASSIFICAÇÃO',
        ];

        // Transformar em nós do tree view do DRE
        const nodes = [];
        let totalGeral = 0;
        for (const catNome of ordemCategorias) {
          if (!categorias.has(catNome)) continue;
          const despesasMapLocal = categorias.get(catNome);

          const despesasNodes = [];
          let totalCategoria = 0;
          for (const [
            despesaNome,
            fornecedoresMapLocal,
          ] of despesasMapLocal.entries()) {
            const fornecedoresNodes = [];
            let totalDespesa = 0;
            for (const [chaveForn, vl] of fornecedoresMapLocal.entries()) {
              const [empCod, fornCod, fornNome, dup, parc] =
                chaveForn.split('|');
              totalDespesa += vl;
              fornecedoresNodes.push({
                id: `forn-${catNome}-${despesaNome}-${empCod}-${fornCod}-${dup}-${parc}`,
                label: `${fornNome}`,
                description: `Empresa: ${empCod} | Fornecedor: ${fornCod} | Duplicata: ${
                  dup || '-'
                } | Parcela: ${parc || '-'}`,
                value: -vl,
                type: 'despesa',
                children: [],
              });
            }
            // Ordenar fornecedores desc por valor
            fornecedoresNodes.sort(
              (a, b) => Math.abs(b.value) - Math.abs(a.value),
            );

            totalCategoria += totalDespesa;
            despesasNodes.push({
              id: `desp-${catNome}-${despesaNome}`,
              label: despesaNome,
              description: `${
                fornecedoresNodes.length
              } fornecedor(es) | Total: ${totalDespesa.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}`,
              value: -totalDespesa,
              type: 'despesa',
              children: fornecedoresNodes,
            });
          }
          // Ordenar despesas desc por valor
          despesasNodes.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

          totalGeral += totalCategoria;
          nodes.push({
            id: `cat-${catNome}`,
            label: catNome,
            description: `${
              despesasNodes.length
            } despesa(s) | ${despesasNodes.reduce(
              (acc, desp) => acc + desp.children.length,
              0,
            )} fornecedor(es) | Total: ${totalCategoria.toLocaleString(
              'pt-BR',
              { style: 'currency', currency: 'BRL' },
            )}`,
            value: -totalCategoria,
            type: 'despesa',
            children: despesasNodes,
          });
        }

        console.log('🔍 Debug DRE - nodes.length:', nodes.length);
        console.log('🔍 Debug DRE - totalGeral:', totalGeral);
        console.log('🔍 Debug DRE - nodes:', nodes);

        setPlanoDespesasNodes(nodes);
        setPlanoDespesasTotal(totalGeral);

        // Processar Despesas Financeiras separadamente
        const categoriasFinanceiras = new Map();
        for (const grupo of dadosFiltradosCP) {
          const item = grupo.item;
          const categoria = classificarDespesa(item.cd_despesaitem);

          // Incluir apenas DESPESAS FINANCEIRAS
          if (categoria !== 'DESPESAS FINANCEIRAS') {
            continue;
          }

          // Usar nomes reais das despesas e fornecedores
          const nomeDespesa =
            despesasMap.get(parseInt(item.cd_despesaitem)) ||
            item.ds_despesaitem ||
            'SEM DESCRIÇÃO';
          const nomeFornecedor =
            fornecedoresMap.get(parseInt(item.cd_fornecedor)) ||
            item.nm_fornecedor ||
            'SEM FORNECEDOR';

          // Filtrar despesas que contenham "EMPRÉSTIMO" no nome (case insensitive)
          if (
            nomeDespesa.toUpperCase().includes('EMPRÉSTIMO') ||
            nomeDespesa.toUpperCase().includes('EMPRESTIMO')
          ) {
            console.log(
              '🚫 Despesa financeira bloqueada (empréstimo):',
              nomeDespesa,
            );
            continue;
          }
          const nrDuplicata = item.nr_duplicata || '';
          const nrParcela = item.nr_parcela || '';
          const valor = parseFloat(item.vl_duplicata || 0) || 0;

          if (!categoriasFinanceiras.has(categoria)) {
            categoriasFinanceiras.set(categoria, new Map());
          }
          const despesasMapLocal = categoriasFinanceiras.get(categoria);
          if (!despesasMapLocal.has(nomeDespesa)) {
            despesasMapLocal.set(nomeDespesa, new Map());
          }
          const fornecedoresMapLocal = despesasMapLocal.get(nomeDespesa);
          const chaveFornecedor = `${item.cd_empresa || ''}|${
            item.cd_fornecedor || ''
          }|${nomeFornecedor}|${nrDuplicata}|${nrParcela}`;
          fornecedoresMapLocal.set(
            chaveFornecedor,
            (fornecedoresMapLocal.get(chaveFornecedor) || 0) + valor,
          );
        }

        // Processar nodes das despesas financeiras
        const financeirasNodes = [];
        let totalFinanceiras = 0;
        for (const [
          catNome,
          despesasMapLocal,
        ] of categoriasFinanceiras.entries()) {
          const despesasNodes = [];
          let totalCategoria = 0;
          for (const [
            despesaNome,
            fornecedoresMapLocal,
          ] of despesasMapLocal.entries()) {
            const fornecedoresNodes = [];
            let totalDespesa = 0;
            for (const [chaveForn, vl] of fornecedoresMapLocal.entries()) {
              const [empCod, fornCod, fornNome, dup, parc] =
                chaveForn.split('|');
              totalDespesa += vl;
              fornecedoresNodes.push({
                id: `fin-forn-${catNome}-${despesaNome}-${empCod}-${fornCod}-${dup}-${parc}`,
                label: `${fornNome}`,
                description: `Empresa: ${empCod} | Fornecedor: ${fornCod} | Duplicata: ${
                  dup || '-'
                } | Parcela: ${parc || '-'}`,
                value: -vl,
                type: 'despesa',
                children: [],
              });
            }
            fornecedoresNodes.sort(
              (a, b) => Math.abs(b.value) - Math.abs(a.value),
            );

            totalCategoria += totalDespesa;
            despesasNodes.push({
              id: `fin-desp-${catNome}-${despesaNome}`,
              label: despesaNome,
              description: `${
                fornecedoresNodes.length
              } fornecedor(es) | Total: ${totalDespesa.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}`,
              value: -totalDespesa,
              type: 'despesa',
              children: fornecedoresNodes,
            });
          }
          despesasNodes.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

          totalFinanceiras += totalCategoria;
          financeirasNodes.push({
            id: `fin-cat-${catNome}`,
            label: catNome,
            description: `${
              despesasNodes.length
            } despesa(s) | ${despesasNodes.reduce(
              (acc, desp) => acc + desp.children.length,
              0,
            )} fornecedor(es) | Total: ${totalCategoria.toLocaleString(
              'pt-BR',
              { style: 'currency', currency: 'BRL' },
            )}`,
            value: -totalCategoria,
            type: 'despesa',
            children: despesasNodes,
          });
        }

        setDespesasFinanceirasNodes(financeirasNodes);
        setDespesasFinanceirasTotal(totalFinanceiras);
      } catch (error) {
        console.error(
          'Erro ao buscar/gerar Plano de Contas (AP Emissão):',
          error,
        );
        setPlanoDespesasNodes([]);
        setPlanoDespesasTotal(0);
        setDespesasFinanceirasNodes([]);
        setDespesasFinanceirasTotal(0);
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
    // Montar nó de Despesas Operacionais a partir do Plano de Contas (AP Emissão)
    const despesasOperacionaisNode = {
      id: 'despesas-operacionais',
      label: 'Despesas Operacionais',
      description:
        'Despesas por categorias e despesas oriundas das Contas a Pagar (Emissão).',
      value: -planoDespesasTotal,
      type: 'despesa',
      children: planoDespesasNodes,
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
      {
        id: 'outras-receitas-despesas',
        label: 'Outras Receitas e Despesas',
        description:
          'Venda de bens da empresa, ganhos ou perdas não recorrentes.',
        value: 0,
        type: 'outro',
        children: [
          {
            id: 'venda-bens',
            label: 'Venda de Bens',
            description: 'Venda de equipamentos da empresa',
            value: 0,
            type: 'receita',
          },
          {
            id: 'perdas-nao-recorrentes',
            label: 'Perdas Não Recorrentes',
            description: 'Perdas eventuais não recorrentes',
            value: 0,
            type: 'despesa',
          },
        ],
      },
      // Nova aba: Despesas Financeiras
      {
        id: 'despesas-financeiras',
        label: 'Despesas Financeiras',
        description:
          'Despesas financeiras oriundas das Contas a Pagar (Emissão).',
        value: -despesasFinanceirasTotal,
        type: 'despesa',
        children: despesasFinanceirasNodes,
      },
      {
        id: 'lucro-antes-impostos',
        label: 'Lucro Antes do IR/CSLL',
        description: 'Resultado antes dos impostos sobre o lucro.',
        value: lucroBruto - planoDespesasTotal - despesasFinanceirasTotal,
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
        value: lucroBruto - planoDespesasTotal - despesasFinanceirasTotal - 0,
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
    despesasFinanceirasTotal,
    despesasFinanceirasNodes,
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período Inicial
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={periodo.dt_inicio}
              onChange={(e) =>
                setPeriodo((prev) => ({ ...prev, dt_inicio: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período Final
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={periodo.dt_fim}
              onChange={(e) =>
                setPeriodo((prev) => ({ ...prev, dt_fim: e.target.value }))
              }
            />
          </div>
          <div className="flex items-center">
            <button
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            {periodo.dt_inicio && periodo.dt_fim
              ? `${new Date(periodo.dt_inicio).toLocaleDateString(
                  'pt-BR',
                )} a ${new Date(periodo.dt_fim).toLocaleDateString('pt-BR')}`
              : 'Selecione um período'}
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
                                                                    <span className="text-gray-200">
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
              <p className="text-gray-600 mb-4">
                Selecione um período e clique em "Buscar Dados" para carregar o
                DRE.
              </p>
              <button
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
                onClick={buscarVendasBrutas}
                disabled={!periodo.dt_inicio || !periodo.dt_fim}
              >
                Buscar Dados Agora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DRE;
