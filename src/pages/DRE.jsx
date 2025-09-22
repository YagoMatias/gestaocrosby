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

  // Estados para impostos reais
  const [icms, setIcms] = useState(0);
  const [pis, setPis] = useState(0);
  const [cofins, setCofins] = useState(0);
  const [totalImpostos, setTotalImpostos] = useState(0);
  const [despesasOperacionais, setDespesasOperacionais] = useState({});
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
    'lucro-antes-impostos': true,
    'impostos-lucro': true,
    'lucro-liquido': true,
  });

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
        1, 2, 5, 6, 7, 11, 31, 55, 65, 75, 85, 90, 91, 92, 93, 94, 95, 96, 97,
        98, 99, 100, 101, 111, 200, 311, 500, 550, 600, 650, 700, 750, 850, 890,
        910, 920, 930, 940, 950, 960, 970, 980, 990,
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

      // Coletar todos os nr_transacao para buscar impostos (apenas vendas - operação 'S')
      const todasTransacoes = [
        ...varejoData
          .filter((r) => r.tp_operacao === 'S')
          .map((r) => r.nr_transacao),
        ...multimarcasData
          .filter((r) => r.tp_operacao === 'S')
          .map((r) => r.nr_transacao),
        ...franquiasData
          .filter((r) => r.tp_operacao === 'S')
          .map((r) => r.nr_transacao),
        ...revendaData
          .filter((r) => r.tp_operacao === 'S')
          .map((r) => r.nr_transacao),
      ].filter((nr, index, arr) => nr && arr.indexOf(nr) === index); // Remove duplicatas

      console.log(
        `📋 Total de transações únicas para buscar impostos: ${todasTransacoes.length}`,
      );

      // Buscar dados de impostos reais da rota VLIMPOSTO
      let impostosData;
      try {
        setLoadingStatus('Buscando dados de impostos...');
        impostosData = await buscarImpostos(todasTransacoes, (progress) => {
          setLoadingStatus(`Buscando impostos... ${progress}%`);
        });
      } catch (error) {
        console.error('Falha crítica ao buscar impostos reais:', error);
        setErro(
          'Erro ao buscar dados de impostos. Verifique a conexão e tente novamente.',
        );
        return;
      }

      // Usar dados reais de impostos da rota VLIMPOSTO
      const icmsReal = impostosData.totals.icms;
      const pisReal = impostosData.totals.pis;
      const cofinsReal = impostosData.totals.cofins;
      const totalImpostosReal = icmsReal + pisReal + cofinsReal;

      console.log('💰 Impostos reais calculados:', {
        icms: icmsReal,
        pis: pisReal,
        cofins: cofinsReal,
        total: totalImpostosReal,
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

      const totalDescontos =
        totalVendasBrutas - totalDevolucoes - somaLiquidoTotal;

      // Total das Deduções = Devoluções + Descontos + Impostos
      const totalDeducoesCalculado =
        totalDevolucoes + totalDescontos + totalImpostosReal;

      // ====== NOVO: Agregar despesas operacionais por categoria (a partir da emissão de contas a pagar) ======
      // Busca baseada no mesmo período/empresas
      let despesasOperacionais = {};
      try {
        // Garantir datas para a emissão (fallback ao período selecionado)
        const inicio = paramsVarejo?.dt_inicio || periodo?.dt_inicio || '';
        const fim = paramsVarejo?.dt_fim || periodo?.dt_fim || '';

        const empresasFinanceiro = Array.from(
          new Set([
            ...(paramsVarejo?.cd_empresa || []),
            ...(paramsFranquia?.cd_empresa || []),
            ...(paramsMultimarcas?.cd_empresa || []),
            ...(paramsRevenda?.cd_empresa || []),
          ]),
        );
        const paramsFinanceiro = {
          dt_inicio: inicio,
          dt_fim: fim,
          ...(empresasFinanceiro.length
            ? { cd_empresa: empresasFinanceiro }
            : {}),
        };
        setLoadingStatus('Buscando despesas (Emissão)...');
        const respEmissao = await api.financial.contasPagarEmissao(
          paramsFinanceiro,
        );
        const linhas = Array.isArray(respEmissao?.data) ? respEmissao.data : [];
        console.log('📦 Emissão (contas a pagar) recebida:', {
          empresasFinanceiro: empresasFinanceiro.length,
          linhas: linhas.length,
        });
        if (linhas.length) {
          console.log('🧾 Amostra emissão:', linhas.slice(0, 2));
        }

        // Somar por categoria utilizando getCategoriaPorCodigo(cd_despesaitem)
        const somaPorCategoria = {};
        for (const row of linhas) {
          const codigoDespesa = row?.cd_despesaitem;
          const categoria =
            getCategoriaPorCodigo(codigoDespesa) || 'DESPESAS GERAIS';
          const valor = Number(row?.vl_duplicata || 0);
          somaPorCategoria[categoria] =
            (somaPorCategoria[categoria] || 0) + valor;
        }
        despesasOperacionais = somaPorCategoria;
        console.log(
          '🧮 Despesas por categoria (Emissão):',
          despesasOperacionais,
        );
        setDespesasOperacionais(somaPorCategoria);
      } catch (e) {
        console.warn(
          'Não foi possível agregar despesas operacionais (emissão):',
          e,
        );
      }

      // Receita Líquida = Vendas Brutas - Deduções
      const receitaLiquidaCalculada =
        totalVendasBrutas - totalDeducoesCalculado;

      // Lucro Bruto = Receita Líquida - CMV
      const lucroBrutoCalculado = receitaLiquidaCalculada - totalCMV;

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
      setCmv(totalCMV);
      setReceitaLiquida(receitaLiquidaCalculada);
      setLucroBruto(lucroBrutoCalculado);

      // Estados dos impostos reais
      setIcms(icmsReal);
      setPis(pisReal);
      setCofins(cofinsReal);
      setTotalImpostos(totalImpostosReal);
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
    return [
      {
        id: 'vendas-bruta',
        label: 'Receitas Brutas',
        description: 'Quanto você vendeu no período (sem tirar nada ainda).',
        value: vendasBrutas,
        type: 'receita',
        children: [],
      },
      {
        id: 'deducoes-vendas',
        label: 'Deduções sobre Vendas',
        description:
          'Devoluções, descontos concedidos e impostos sobre vendas.',
        value: -totalDeducoes, // Valor negativo (dedução)
        type: 'deducao',
        children: [
          {
            id: 'devolucoes',
            label: 'Devoluções',
            description: 'Clientes devolveram mercadorias',
            value: -devolucoes, // Valor negativo (dedução)
            type: 'deducao',
          },
          {
            id: 'descontos',
            label: 'Descontos Concedidos',
            description: 'Descontos dados aos clientes',
            value: -descontos, // Valor negativo (dedução)
            type: 'deducao',
          },
          {
            id: 'impostos-vendas',
            label: 'Impostos sobre Vendas',
            description: 'ICMS, PIS, COFINS e outros impostos sobre vendas.',
            value: -totalImpostos, // Valor real calculado
            type: 'deducao',
            children: [
              {
                id: 'icms',
                label: 'ICMS',
                description:
                  'Imposto sobre Circulação de Mercadorias e Serviços',
                value: -icms, // Valor real calculado
                type: 'deducao',
              },
              {
                id: 'pis',
                label: 'PIS',
                description: 'Programa de Integração Social',
                value: -pis, // Valor real calculado
                type: 'deducao',
              },
              {
                id: 'cofins',
                label: 'COFINS',
                description:
                  'Contribuição para o Financiamento da Seguridade Social',
                value: -cofins, // Valor real calculado
                type: 'deducao',
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
        children: [],
      },
      {
        id: 'cmv',
        label: 'Custos da Mercadoria Vendida (CMV)',
        description:
          'Quanto custou comprar ou produzir o que você vendeu (matéria-prima, mercadorias para revenda, mão de obra da produção).',
        value: -cmv, // Valor negativo (custo)
        type: 'custo',
        children: [],
      },
      {
        id: 'lucro-bruto',
        label: 'Lucro Bruto',
        description: 'Receita Líquida – CMV',
        value: lucroBruto, // Valor real calculado
        type: 'resultado',
        children: [],
      },
      {
        id: 'despesas-operacionais',
        label: 'Despesas Operacionais',
        description:
          'Despesas comerciais, administrativas e financeiras (por plano de contas).',
        value: -(
          (despesasOperacionais?.['CUSTO DAS MERCADORIAS VENDIDAS'] || 0) +
          (despesasOperacionais?.['DESPESAS COM PESSOAL'] || 0) +
          (despesasOperacionais?.['IMPOSTOS, TAXAS E CONTRIBUIÇÕES'] || 0) +
          (despesasOperacionais?.['DESPESAS GERAIS'] || 0) +
          (despesasOperacionais?.['DESPESAS FINANCEIRAS'] || 0) +
          (despesasOperacionais?.['DESPESAS C/ VENDAS'] || 0)
        ),
        type: 'despesa',
        children: [
          {
            id: 'op-cmv',
            label: 'CUSTO DAS MERCADORIAS VENDIDAS',
            description: 'Itens mapeados como CMV no plano de contas',
            value: -(
              despesasOperacionais?.['CUSTO DAS MERCADORIAS VENDIDAS'] || 0
            ),
            type: 'despesa',
          },
          {
            id: 'op-pessoal',
            label: 'DESPESAS COM PESSOAL',
            description: 'Salários, encargos e benefícios',
            value: -(despesasOperacionais?.['DESPESAS COM PESSOAL'] || 0),
            type: 'despesa',
          },
          {
            id: 'op-impostos',
            label: 'IMPOSTOS, TAXAS E CONTRIBUIÇÕES',
            description: 'Tributos operacionais não vinculados a vendas',
            value: -(
              despesasOperacionais?.['IMPOSTOS, TAXAS E CONTRIBUIÇÕES'] || 0
            ),
            type: 'despesa',
          },
          {
            id: 'op-gerais',
            label: 'DESPESAS GERAIS',
            description: 'Custos administrativos e gerais',
            value: -(despesasOperacionais?.['DESPESAS GERAIS'] || 0),
            type: 'despesa',
          },
          {
            id: 'op-financeiras',
            label: 'DESPESAS FINANCEIRAS',
            description: 'Juros, tarifas e despesas financeiras',
            value: -(despesasOperacionais?.['DESPESAS FINANCEIRAS'] || 0),
            type: 'despesa',
          },
          {
            id: 'op-vendas',
            label: 'DESPESAS C/ VENDAS',
            description: 'Comercial/marketing e apoio às vendas',
            value: -(despesasOperacionais?.['DESPESAS C/ VENDAS'] || 0),
            type: 'despesa',
          },
        ],
      },
      {
        id: 'resultado-operacional',
        label: 'Resultado Operacional',
        description: 'O que sobrou depois das despesas.',
        value: 180000.0,
        type: 'resultado',
        children: [],
      },
      {
        id: 'outras-receitas-despesas',
        label: 'Outras Receitas e Despesas',
        description:
          'Venda de bens da empresa, ganhos ou perdas não recorrentes.',
        value: 15000.0,
        type: 'outro',
        children: [
          {
            id: 'venda-bens',
            label: 'Venda de Bens',
            description: 'Venda de equipamentos da empresa',
            value: 25000.0,
            type: 'receita',
          },
          {
            id: 'perdas-nao-recorrentes',
            label: 'Perdas Não Recorrentes',
            description: 'Perdas eventuais não recorrentes',
            value: -10000.0,
            type: 'despesa',
          },
        ],
      },
      {
        id: 'lucro-antes-impostos',
        label: 'Lucro Antes do IR/CSLL',
        description: 'Resultado antes dos impostos sobre o lucro.',
        value: 195000.0,
        type: 'resultado',
        children: [],
      },
      {
        id: 'impostos-lucro',
        label: 'Impostos sobre o Lucro (IR/CSLL)',
        description: 'Se a empresa paga esse tipo de imposto.',
        value: -58500.0,
        type: 'imposto',
        children: [
          {
            id: 'irpj',
            label: 'IRPJ',
            description: 'Imposto de Renda Pessoa Jurídica',
            value: -39000.0,
            type: 'imposto',
          },
          {
            id: 'csll',
            label: 'CSLL',
            description: 'Contribuição Social sobre o Lucro Líquido',
            value: -19500.0,
            type: 'imposto',
          },
        ],
      },
      {
        id: 'lucro-liquido',
        label: 'Lucro Líquido do Exercício',
        description: 'O resultado final: lucro ou prejuízo.',
        value: 136500.0,
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
    despesasOperacionais,
  ]);

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
            {/* Tree Root */}
            <div
              className="hs-accordion-treeview-root"
              role="tree"
              aria-orientation="vertical"
            >
              <div
                className="hs-accordion-group"
                role="group"
                data-hs-accordion-always-open=""
              >
                <div className="p-4">
                  {dreData.map((item, index) => {
                    const isLastInSection = index === dreData.length - 1;
                    const isEven = (index + 1) % 2 === 0;
                    return (
                      <div key={item.id}>
                        {renderTreeItem(item, 0, isLastInSection, isEven)}
                        {/* Divider between main sections */}
                        {!isLastInSection && (
                          <div className="border-b border-gray-300 my-3"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Resumo Final */}
            <div className="bg-blue-50 px-4 py-4 border-t-2 border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendUp className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-lg font-semibold text-blue-900">
                    Vendas Brutas do Período
                  </span>
                </div>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(vendasBrutas)}
                </span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                Total das vendas brutas das 4 rotas CMV (Varejo, Multimarcas,
                Franquias e Revenda)
              </p>
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

      {/* Informações Adicionais */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center">
              <span className="text-blue-800 text-xs font-bold">i</span>
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Dados Sob Demanda
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Clique em "Buscar Dados" para calcular as vendas brutas a partir
              das 4 rotas CMV (Varejo, Multimarcas, Franquias e Revenda),
              somando as operações de entrada (E) e saída (S) do período
              selecionado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DRE;
