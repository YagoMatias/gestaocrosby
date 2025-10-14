import React, { memo, useCallback, useMemo, useState } from 'react';
import SEOHead from '../components/ui/SEOHead';
import FiltroEmpresa from '../components/FiltroEmpresa';
import LoadingSpinner from '../components/LoadingSpinner';
import { CurrencyDollar, ArrowsClockwise } from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import Modal from '../components/ui/Modal';

const FinanceiroPorCanal = memo(() => {
  const api = useApiClient();

  // Filtros
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d) => d.toISOString().split('T')[0];
  const [dtInicio, setDtInicio] = useState(fmt(firstDay));
  const [dtFim, setDtFim] = useState(fmt(today));
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Dados dos canais (agora vêm das views materializadas)
  const [dadosVarejo, setDadosVarejo] = useState([]);
  const [dadosFranquia, setDadosFranquia] = useState([]);
  const [dadosMultimarcas, setDadosMultimarcas] = useState([]);
  const [dadosRevenda, setDadosRevenda] = useState([]);
  const [dadosContasPagar, setDadosContasPagar] = useState([]);
  const [valorTotalContasPagar, setValorTotalContasPagar] = useState(0);
  const [totaisPorCentroCusto, setTotaisPorCentroCusto] = useState([]);
  const [ccTotaisPorCanal, setCcTotaisPorCanal] = useState({
    varejo: 0,
    multimarcas: 0,
    franquiasRevenda: 0,
    matriz: 0,
    diversos: 0,
  });
  const [modalAberto, setModalAberto] = useState(null);
  const [modalDadosCpDiversos, setModalDadosCpDiversos] = useState([]);

  // Cálculos simplificados usando as views materializadas
  // valor_sem_desconto - valor_com_desconto = valor bruto
  // valor_com_desconto_saida - valor_com_desconto_entrada = receita liquida
  // valor_com_desconto_entrada = devoluções liquidas
  // valor_sem_desconto_entrada = devoluções brutas

  const totais = useMemo(() => {
    const calcularReceita = (dados) => {
      if (!Array.isArray(dados)) return 0;
      return dados.reduce((acc, row) => {
        const receita =
          (Number(row.valor_com_desconto_saida) || 0) -
          (Number(row.valor_com_desconto_entrada) || 0);
        return acc + receita;
      }, 0);
    };

    return {
      varejo: calcularReceita(dadosVarejo),
      franquia: calcularReceita(dadosFranquia),
      multimarcas: calcularReceita(dadosMultimarcas),
      revenda: calcularReceita(dadosRevenda),
    };
  }, [dadosVarejo, dadosFranquia, dadosMultimarcas, dadosRevenda]);

  const totaisBrutos = useMemo(() => {
    const calcularValorBruto = (dados) => {
      if (!Array.isArray(dados)) return 0;
      return dados.reduce((acc, row) => {
        const bruto =
          (Number(row.valor_sem_desconto) || 0) -
          (Number(row.valor_com_desconto) || 0);
        return acc + bruto;
      }, 0);
    };

    return {
      varejo: calcularValorBruto(dadosVarejo),
      franquia: calcularValorBruto(dadosFranquia),
      multimarcas: calcularValorBruto(dadosMultimarcas),
      revenda: calcularValorBruto(dadosRevenda),
    };
  }, [dadosVarejo, dadosFranquia, dadosMultimarcas, dadosRevenda]);

  const devolucoes = useMemo(() => {
    const calcularDevolucoes = (dados) => {
      if (!Array.isArray(dados)) return { liquidas: 0, brutas: 0 };
      return dados.reduce(
        (acc, row) => {
          acc.liquidas += Number(row.valor_com_desconto_entrada) || 0;
          acc.brutas += Number(row.valor_sem_desconto_entrada) || 0;
          return acc;
        },
        { liquidas: 0, brutas: 0 },
      );
    };

    return {
      varejo: calcularDevolucoes(dadosVarejo),
      franquia: calcularDevolucoes(dadosFranquia),
      multimarcas: calcularDevolucoes(dadosMultimarcas),
      revenda: calcularDevolucoes(dadosRevenda),
    };
  }, [dadosVarejo, dadosFranquia, dadosMultimarcas, dadosRevenda]);

  // Pie por empresa Varejo
  const pieVarejoData = useMemo(() => {
    if (!Array.isArray(dadosVarejo)) return [];
    const map = new Map();
    dadosVarejo.forEach((row) => {
      const nome = row.nm_grupoempresa || `Empresa ${row.cd_grupoempresa}`;
      const valor =
        (Number(row.valor_com_desconto_saida) || 0) -
        (Number(row.valor_com_desconto_entrada) || 0);
      if (!map.has(nome)) map.set(nome, 0);
      map.set(nome, map.get(nome) + valor);
    });
    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value: Math.max(0, value),
    }));
  }, [dadosVarejo]);

  // Pie por empresa Multimarcas
  const pieMultimarcasData = useMemo(() => {
    if (!Array.isArray(dadosMultimarcas)) return [];
    const map = new Map();
    dadosMultimarcas.forEach((row) => {
      const nome = row.nm_grupoempresa || `Empresa ${row.cd_grupoempresa}`;
      const valor =
        (Number(row.valor_com_desconto_saida) || 0) -
        (Number(row.valor_com_desconto_entrada) || 0);
      if (!map.has(nome)) map.set(nome, 0);
      map.set(nome, map.get(nome) + valor);
    });
    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value: Math.max(0, value),
    }));
  }, [dadosMultimarcas]);

  const PIE_COLORS = ['#16a34a', '#1d4ed8', '#7e22ce', '#ea580c'];
  const formatBRL = useCallback(
    (v) =>
      (Number(v) || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    [],
  );
  const cpPieData = useMemo(
    () => [
      { name: 'Varejo', value: Math.max(0, ccTotaisPorCanal.varejo) },
      { name: 'Multimarcas', value: Math.max(0, ccTotaisPorCanal.multimarcas) },
      {
        name: 'Franquias + Revenda',
        value: Math.max(0, ccTotaisPorCanal.franquiasRevenda),
      },
      { name: 'Diversos', value: Math.max(0, ccTotaisPorCanal.diversos) },
    ],
    [ccTotaisPorCanal],
  );

  // Dados para o gráfico de barras comparativo (Vendas vs Contas a Pagar)
  const barChartData = useMemo(
    () => [
      {
        canal: 'VAREJO',
        receitaLiquida: Math.max(0, totais.varejo),
        valorBruto: Math.max(0, totaisBrutos.varejo),
        contasPagar: Math.max(0, ccTotaisPorCanal.varejo),
      },
      {
        canal: 'MULTIMARCAS',
        receitaLiquida: Math.max(0, totais.multimarcas),
        valorBruto: Math.max(0, totaisBrutos.multimarcas),
        contasPagar: Math.max(0, ccTotaisPorCanal.multimarcas),
      },
      {
        canal: 'FRANQUIAS + REVENDA',
        receitaLiquida: Math.max(0, totais.franquia + totais.revenda),
        valorBruto: Math.max(0, totaisBrutos.franquia + totaisBrutos.revenda),
        contasPagar: Math.max(0, ccTotaisPorCanal.franquiasRevenda),
      },
    ],
    [totais, totaisBrutos, ccTotaisPorCanal],
  );

  const handleBuscar = useCallback(
    async (e) => {
      e?.preventDefault?.();
      setErro('');
      if (!dtInicio || !dtFim) {
        setErro('Selecione o período.');
        return;
      }
      const empresas = (empresasSelecionadas || [])
        .filter((emp) => emp.cd_empresa)
        .map((emp) => emp.cd_empresa);
      if (empresas.length === 0) {
        setErro('Selecione pelo menos uma empresa.');
        return;
      }
      setLoading(true);
      try {
        // Parâmetros para as novas rotas materializadas
        const paramsVarejo = {
          dataInicio: dtInicio,
          dataFim: dtFim,
        };
        const paramsFranquia = {
          dataInicio: dtInicio,
          dataFim: dtFim,
        };
        const paramsMtm = {
          dataInicio: dtInicio,
          dataFim: dtFim,
        };
        const paramsRevenda = {
          dataInicio: dtInicio,
          dataFim: dtFim,
        };
        const paramsCp = {
          dt_inicio: dtInicio,
          dt_fim: dtFim,
          cd_empresa: empresas,
        };

        const [resVarejo, resFranquia, resMtm, resRev, resCp] =
          await Promise.all([
            api.sales.faturamentoVarejo(paramsVarejo),
            api.sales.faturamentoFranquias(paramsFranquia),
            api.sales.faturamentoMtm(paramsMtm),
            api.sales.faturamentoRevenda(paramsRevenda),
            api.financial.contasPagar(paramsCp),
          ]);

        setDadosVarejo(resVarejo?.data || []);
        setDadosFranquia(resFranquia?.data || []);
        setDadosMultimarcas(resMtm?.data || []);
        setDadosRevenda(resRev?.data || []);

        const linhasCp = resCp?.data || [];
        setDadosContasPagar(linhasCp);

        // ===== Lógica de agrupamento igual à página Contas a Pagar =====
        const agruparDadosIdenticos = (dados) => {
          const grupos = new Map();
          dados.forEach((item) => {
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
            if (item.vl_rateio && !grupo.rateios.includes(item.vl_rateio)) {
              grupo.rateios.push(item.vl_rateio);
            }
            if (
              item.ds_observacao &&
              !grupo.observacoes.includes(item.ds_observacao)
            ) {
              grupo.observacoes.push(item.ds_observacao);
            }
            if (
              item.tp_situacao &&
              !grupo.situacoes.includes(item.tp_situacao)
            ) {
              grupo.situacoes.push(item.tp_situacao);
            }
            if (item.tp_previsaoreal && !grupo.previsoes) {
              grupo.previsoes = [];
            }
            if (
              item.tp_previsaoreal &&
              !grupo.previsoes.includes(item.tp_previsaoreal)
            ) {
              grupo.previsoes.push(item.tp_previsaoreal);
            }
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
            let situacaoFinal = grupo.item.tp_situacao;
            if (grupo.situacoes && grupo.situacoes.length > 1) {
              if (grupo.situacoes.includes('C')) situacaoFinal = 'C';
              else if (grupo.situacoes.includes('N')) situacaoFinal = 'N';
            }
            return {
              ...grupo,
              item: { ...grupo.item, tp_situacao: situacaoFinal },
            };
          });
        };

        // Filtros locais para replicar lógica da página Contas a Pagar
        const criarDataSemFusoHorario = (isoDate) => {
          if (!isoDate) return null;
          try {
            const [datePart] = String(isoDate).split('T');
            const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
            if (!y || !m || !d) return null;
            return new Date(y, m - 1, d);
          } catch {
            return null;
          }
        };

        // 1) Situação NORMAIS: excluir canceladas
        // Considera normal quando tp_situacao === 'N' OU (sem cancelamento e sem indicador de cancelada)
        const somenteNormais = (linhasCp || []).filter((item) => {
          const situacao = (item.tp_situacao || '').toUpperCase();
          const normal = situacao === 'N';
          return normal; // apenas NORMAIS
        });

        // 2) Filtrar por período usando dt_vencimento (mesma base da tela)
        const ini = criarDataSemFusoHorario(dtInicio);
        const fim = criarDataSemFusoHorario(dtFim);
        const noPeriodo = somenteNormais.filter((item) => {
          const dv = criarDataSemFusoHorario(item.dt_vencimento);
          if (!dv) return false;
          return dv >= ini && dv <= fim;
        });

        const agrupados = agruparDadosIdenticos(noPeriodo);
        const totalValor = agrupados.reduce(
          (acc, g) => acc + (parseFloat(g?.item?.vl_duplicata) || 0),
          0,
        );
        setValorTotalContasPagar(totalValor);

        // Totais por Centro de Custo (separar por cd_ccusto do payload)
        const ccMap = new Map(); // key: cd_ccusto, value: { code, name, valor }
        agrupados.forEach((g) => {
          const code = g?.item?.cd_ccusto || 'S/CC';
          const name = g?.item?.ds_ccusto || '';
          const valor = parseFloat(g?.item?.vl_duplicata) || 0;
          const prev = ccMap.get(code) || { code, name, valor: 0 };
          prev.valor += valor;
          // Atualiza name se vier vazio antes
          if (!prev.name && name) prev.name = name;
          ccMap.set(code, prev);
        });
        // Buscar nomes de centro de custo (ds_ccusto) pela API quando necessário
        try {
          const codesToFetch = Array.from(ccMap.keys()).filter(
            (c) => c && c !== 'S/CC',
          );
          if (codesToFetch.length > 0) {
            const resultCentro = await api.financial.centrocusto({
              cd_ccusto: codesToFetch,
            });
            const listaCentro = Array.isArray(resultCentro?.data)
              ? resultCentro.data
              : [];
            const mapCentro = new Map(
              listaCentro.map((c) => [String(c.cd_ccusto), c.ds_ccusto]),
            );
            // Enriquecer nomes
            for (const [code, val] of ccMap.entries()) {
              const ds = mapCentro.get(String(code));
              if (ds) {
                val.name = ds;
                ccMap.set(code, val);
              }
            }
          }
        } catch (e) {
          console.warn('Falha ao buscar centros de custo:', e);
        }

        const ccArr = Array.from(ccMap.values())
          .map((x) => ({
            code: String(x.code),
            name: x.name,
            label: x.name ? `${x.code} - ${x.name}` : String(x.code),
            valor: x.valor,
          }))
          .sort((a, b) => b.valor - a.valor);
        setTotaisPorCentroCusto(ccArr);

        // Totais por Canal a partir do Centro de Custo (heurística por nome)
        // Buckets por cd_ccusto (regras fornecidas)
        const FRANQUIAS_REVENDA = new Set([
          '2',
          '3',
          '4',
          '6',
          '7',
          '8',
          '9',
          '12',
          '13',
          '14',
          '18',
        ]);
        const VAREJO = new Set([
          '5',
          '15',
          '16',
          '19',
          '30',
          '31',
          '32',
          '33',
          '34',
          '35',
          '36',
          '37',
        ]);
        const MULTIMARCAS = new Set(['17']);
        const MATRIZ = new Set([
          '26',
          '20',
          '28',
          '22',
          '27',
          '1',
          '23',
          '24',
          '29',
          '25',
          '10',
        ]);
        const bucket = {
          varejo: 0,
          multimarcas: 0,
          franquiasRevenda: 0,
          matriz: 0,
          diversos: 0,
        };
        ccArr.forEach((cc) => {
          const code = (cc.code || '').trim();
          if (FRANQUIAS_REVENDA.has(code)) bucket.franquiasRevenda += cc.valor;
          else if (VAREJO.has(code)) bucket.varejo += cc.valor;
          else if (MULTIMARCAS.has(code)) bucket.multimarcas += cc.valor;
          else if (MATRIZ.has(code)) bucket.matriz += cc.valor;
          else bucket.diversos += cc.valor;
        });
        setCcTotaisPorCanal(bucket);
        // Filtrar e setar os dados detalhados para o modal de Diversos
        const dadosDiversosCp = agrupados
          .filter((g) => {
            const code = (g?.item?.cd_ccusto || '').trim();
            return (
              !FRANQUIAS_REVENDA.has(code) &&
              !VAREJO.has(code) &&
              !MULTIMARCAS.has(code) &&
              !MATRIZ.has(code)
            );
          })
          .map((g) => g.item); // Pega apenas o item detalhado
        setModalDadosCpDiversos(dadosDiversosCp);
        console.log('Dados Diversos CP:', dadosDiversosCp);
      } catch (err) {
        console.error('Erro ao buscar dados por canal:', err);
        setErro('Erro ao buscar dados. Tente novamente.');
        setDadosVarejo([]);
        setDadosFranquia([]);
        setDadosMultimarcas([]);
        setDadosRevenda([]);
        setDadosContasPagar([]);
        setValorTotalContasPagar(0);
        setTotaisPorCentroCusto([]);
        setCcTotaisPorCanal({
          varejo: 0,
          multimarcas: 0,
          franquiasRevenda: 0,
          matriz: 0,
          diversos: 0,
        });
      } finally {
        setLoading(false);
      }
    },
    [api, dtInicio, dtFim, empresasSelecionadas],
  );

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <SEOHead
          title="Financeiro por Canal"
          description="Dashboard Financeiro por Canal"
        />
        <h1 className="text-2xl font-bold text-[#000638] mb-4">
          Financeiro por Canal
        </h1>

        {/* Filtros sempre visíveis */}
        <form
          onSubmit={handleBuscar}
          className="bg-white p-6 rounded-2xl shadow-lg border border-[#000638]/10 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <CurrencyDollar size={20} className="text-[#000638]" />
            <span className="text-lg font-bold text-[#000638]">Filtros</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-3">
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#000638]">
                Data Inicial
              </label>
              <input
                type="date"
                value={dtInicio}
                onChange={(e) => setDtInicio(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#000638]">
                Data Final
              </label>
              <input
                type="date"
                value={dtFim}
                onChange={(e) => setDtFim(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
              />
            </div>
            <div className="Flex items-end">
              <button
                type="submit"
                disabled={loading || (empresasSelecionadas ?? []).length === 0}
                className={`flex items-end gap-2 px-5 py-2 rounded-lg font-bold text-sm shadow-md transition-all ${
                  loading || (empresasSelecionadas ?? []).length === 0
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-[#000638] hover:bg-[#fe0000] text-white'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  </>
                ) : (
                  <>
                    <ArrowsClockwise size={18} /> Buscar
                  </>
                )}
              </button>
            </div>
          </div>
          {erro && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center text-sm">
              {erro}
            </div>
          )}
        </form>

        <div className="flex justify-center items-center py-32">
          <LoadingSpinner size="lg" text="Carregando dados financeiros..." />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <SEOHead
        title="Financeiro por Canal"
        description="Dashboard Financeiro por Canal"
      />
      <h1 className="text-2xl font-bold text-[#000638] mb-4">
        Financeiro por Canal
      </h1>

      {/* Filtros */}
      <form
        onSubmit={handleBuscar}
        className="bg-white p-6 rounded-2xl shadow-lg border border-[#000638]/10 mb-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <CurrencyDollar size={20} className="text-[#000638]" />
          <span className="text-lg font-bold text-[#000638]">Filtros</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-3">
            <FiltroEmpresa
              empresasSelecionadas={empresasSelecionadas}
              onSelectEmpresas={setEmpresasSelecionadas}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-[#000638]">
              Data Inicial
            </label>
            <input
              type="date"
              value={dtInicio}
              onChange={(e) => setDtInicio(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-[#000638]">
              Data Final
            </label>
            <input
              type="date"
              value={dtFim}
              onChange={(e) => setDtFim(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
            />
          </div>
          <div className="flex items-center">
            <button
              type="submit"
              disabled={loading || (empresasSelecionadas ?? []).length === 0}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm shadow-md transition-all ${
                loading || (empresasSelecionadas ?? []).length === 0
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-[#000638] hover:bg-[#fe0000] text-white'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                </>
              ) : (
                <>
                  <ArrowsClockwise size={18} /> Buscar
                </>
              )}
            </button>
          </div>
        </div>
        {erro && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center text-sm">
            {erro}
          </div>
        )}
      </form>

      {/* Seção: Receita Líquida */}
      <div className="mb-3">
        <h2 className="text-sm font-bold tracking-wide text-gray-700">
          RECEITA LÍQUIDA (Saída - Entrada)
        </h2>
      </div>

      {/* Layout 2 colunas: cards (esquerda) e gráfico (direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Cards (coluna esquerda) */}
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-md">
            <div className="text-sm font-semibold text-gray-600">Varejo</div>
            <div className="text-2xl font-extrabold text-green-700 mt-2">
              {formatBRL(totais.varejo)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Devoluções: {formatBRL(devolucoes.varejo.liquidas)}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-md">
            <div className="text-sm font-semibold text-gray-600">Franquias</div>
            <div className="text-2xl font-extrabold text-blue-700 mt-2">
              {formatBRL(totais.franquia)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Devoluções: {formatBRL(devolucoes.franquia.liquidas)}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-md">
            <div className="text-sm font-semibold text-gray-600">
              Multimarcas
            </div>
            <div className="text-2xl font-extrabold text-purple-700 mt-2">
              {formatBRL(totais.multimarcas)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Devoluções: {formatBRL(devolucoes.multimarcas.liquidas)}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-md">
            <div className="text-sm font-semibold text-gray-600">Revenda</div>
            <div className="text-2xl font-extrabold text-orange-700 mt-2">
              {formatBRL(totais.revenda)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Devoluções: {formatBRL(devolucoes.revenda.liquidas)}
            </div>
          </div>
        </div>

        {/* Gráfico Pizza por Canal (coluna direita) */}
        <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-md">
          <div className="text-sm font-semibold text-gray-700 mb-2">
            Varejo - Receita por Empresa
          </div>
          <div className="text-xs text-gray-500 mb-2">
            Distribuição da receita líquida por empresa (Varejo)
          </div>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieVarejoData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={110}
                  label={({ name, value }) => `${name}: ${formatBRL(value)}`}
                >
                  {pieVarejoData.map((entry, index) => (
                    <Cell
                      key={`cell-varejo-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend formatter={(value, entry) => `${value}`} />
                <RechartsTooltip formatter={(v) => formatBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Seção: Resumo Consolidado */}
      <div className="mt-8 mb-3">
        <h2 className="text-sm font-bold tracking-wide text-gray-700">
          RESUMO CONSOLIDADO
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-6 shadow-md">
          <div className="text-sm font-semibold text-blue-900 mb-3">
            Total Receita Líquida
          </div>
          <div className="text-3xl font-extrabold text-blue-700">
            {formatBRL(
              totais.varejo +
                totais.franquia +
                totais.multimarcas +
                totais.revenda,
            )}
          </div>
          <div className="text-xs text-blue-600 mt-2">
            Saídas - Entradas (com desconto)
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200 p-6 shadow-md">
          <div className="text-sm font-semibold text-green-900 mb-3">
            Total Descontos Concedidos
          </div>
          <div className="text-3xl font-extrabold text-green-700">
            {formatBRL(
              totaisBrutos.varejo +
                totaisBrutos.franquia +
                totaisBrutos.multimarcas +
                totaisBrutos.revenda,
            )}
          </div>
          <div className="text-xs text-green-600 mt-2">
            Valor sem desconto - Valor com desconto
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200 p-6 shadow-md">
          <div className="text-sm font-semibold text-red-900 mb-3">
            Total Devoluções Líquidas
          </div>
          <div className="text-3xl font-extrabold text-red-700">
            {formatBRL(
              devolucoes.varejo.liquidas +
                devolucoes.franquia.liquidas +
                devolucoes.multimarcas.liquidas +
                devolucoes.revenda.liquidas,
            )}
          </div>
          <div className="text-xs text-red-600 mt-2">
            Entradas com desconto (valor negativo)
          </div>
        </div>
      </div>

      {/* Seção: Devoluções */}
      <div className="mt-8 mb-3">
        <h2 className="text-sm font-bold tracking-wide text-gray-700">
          DEVOLUÇÕES POR CANAL
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl bg-white border border-red-200 p-4 shadow-md">
          <div className="text-sm font-semibold text-gray-600">Varejo</div>
          <div className="text-xl font-bold text-red-600 mt-2">
            {formatBRL(devolucoes.varejo.liquidas)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Brutas: {formatBRL(devolucoes.varejo.brutas)}
          </div>
        </div>
        <div className="rounded-xl bg-white border border-red-200 p-4 shadow-md">
          <div className="text-sm font-semibold text-gray-600">Franquias</div>
          <div className="text-xl font-bold text-red-600 mt-2">
            {formatBRL(devolucoes.franquia.liquidas)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Brutas: {formatBRL(devolucoes.franquia.brutas)}
          </div>
        </div>
        <div className="rounded-xl bg-white border border-red-200 p-4 shadow-md">
          <div className="text-sm font-semibold text-gray-600">Multimarcas</div>
          <div className="text-xl font-bold text-red-600 mt-2">
            {formatBRL(devolucoes.multimarcas.liquidas)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Brutas: {formatBRL(devolucoes.multimarcas.brutas)}
          </div>
        </div>
        <div className="rounded-xl bg-white border border-red-200 p-4 shadow-md">
          <div className="text-sm font-semibold text-gray-600">Revenda</div>
          <div className="text-xl font-bold text-red-600 mt-2">
            {formatBRL(devolucoes.revenda.liquidas)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Brutas: {formatBRL(devolucoes.revenda.brutas)}
          </div>
        </div>
      </div>

      {/* Seção: Contas a Pagar por Canal */}
      <div className="mt-8 mb-3">
        <h2 className="text-sm font-bold tracking-wide text-gray-700">
          CONTAS A PAGAR POR CANAL
        </h2>
      </div>

      {/* Layout 2 colunas: 4 cards (meia tela) + pizza comparativa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => setModalAberto('VAREJO')}
            className="text-left rounded-xl bg-white border border-gray-200 p-4 shadow-md"
          >
            <div className="text-sm font-semibold text-gray-600">VAREJO</div>
            <div className="text-2xl font-extrabold text-green-700 mt-2">
              {formatBRL(ccTotaisPorCanal.varejo)}
            </div>
          </button>
          <button
            onClick={() => setModalAberto('MULTIMARCAS')}
            className="text-left rounded-xl bg-white border border-gray-200 p-4 shadow-md"
          >
            <div className="text-sm font-semibold text-gray-600">
              MULTIMARCAS
            </div>
            <div className="text-2xl font-extrabold text-purple-700 mt-2">
              {formatBRL(ccTotaisPorCanal.multimarcas)}
            </div>
          </button>
          <button
            onClick={() => setModalAberto('FRANQUIAS_REVENDA')}
            className="text-left rounded-xl bg-white border border-gray-200 p-4 shadow-md"
          >
            <div className="text-sm font-semibold text-gray-600">
              FRANQUIAS + REVENDA
            </div>
            <div className="text-2xl font-extrabold text-blue-700 mt-2">
              {formatBRL(ccTotaisPorCanal.franquiasRevenda)}
            </div>
          </button>
          <button
            onClick={() => {
              setModalAberto('MATRIZ');
              console.log('Modal Aberto (Matriz):', 'MATRIZ');
            }}
            className="text-left rounded-xl bg-white border border-gray-200 p-4 shadow-md"
          >
            <div className="text-sm font-semibold text-gray-600">MATRIZ</div>
            <div className="text-2xl font-extrabold text-indigo-700 mt-2">
              {formatBRL(ccTotaisPorCanal.matriz)}
            </div>
          </button>
          <button
            onClick={() => {
              setModalAberto('DIVERSOS');
              console.log('Modal Aberto (Diversos):', 'DIVERSOS');
            }}
            className="text-left rounded-xl bg-white border border-gray-200 p-4 shadow-md cursor-pointer"
          >
            <div className="text-sm font-semibold text-gray-600">DIVERSOS</div>
            <div className="text-2xl font-extrabold text-orange-700 mt-2">
              {formatBRL(ccTotaisPorCanal.diversos)}
            </div>
          </button>
          {/* Valor Total*/}
          <div className="text-left rounded-xl bg-white border border-gray-200 p-4 shadow-md">
            <div className="text-sm font-semibold text-gray-600">
              Valor Total (R$)
            </div>
            <div className="text-2xl font-extrabold text-green-700 mt-2">
              {formatBRL(valorTotalContasPagar)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Mesmo cálculo e agrupamento da página Contas a Pagar
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-md">
          <div className="text-sm font-semibold text-gray-700 mb-2">
            Multimarcas - Receita por Empresa
          </div>
          <div className="text-xs text-gray-500 mb-2">
            Distribuição da receita líquida por empresa (Multimarcas)
          </div>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieMultimarcasData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={110}
                  label={({ name, value }) => `${name}: ${formatBRL(value)}`}
                >
                  {pieMultimarcasData.map((entry, index) => (
                    <Cell
                      key={`cell-multimarcas-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend formatter={(value, entry) => `${value}`} />
                <RechartsTooltip formatter={(v) => formatBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gráfico de Barras - Detalhamento MATRIZ */}
      <div className="mt-6">
        <div className="rounded-2xl bg-white border border-gray-200 p-8 shadow-md">
          <div className="text-base font-semibold text-gray-700 mb-4 text-center">
            Detalhamento MATRIZ - Centros de Custo
          </div>
          <div style={{ width: '100%', height: 400, padding: '20px' }}>
            <ResponsiveContainer>
              <BarChart
                data={totaisPorCentroCusto
                  .filter((cc) => {
                    const MATRIZ_CODES = new Set([
                      '26',
                      '20',
                      '28',
                      '22',
                      '27',
                      '1',
                      '23',
                      '24',
                      '29',
                      '25',
                      '10',
                    ]);
                    return MATRIZ_CODES.has(cc.code);
                  })
                  .sort((a, b) => b.valor - a.valor)}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={11}
                />
                <YAxis
                  tickFormatter={(value) => formatBRL(value)}
                  fontSize={11}
                />
                <RechartsTooltip formatter={(value) => formatBRL(value)} />
                <Bar dataKey="valor" name="Valor (R$)" fill="#6366f1">
                  {totaisPorCentroCusto
                    .filter((cc) => {
                      const MATRIZ_CODES = new Set([
                        '26',
                        '20',
                        '28',
                        '22',
                        '27',
                        '1',
                        '23',
                        '24',
                        '29',
                        '25',
                        '10',
                      ]);
                      return MATRIZ_CODES.has(cc.code);
                    })
                    .map((entry, index) => (
                      <text
                        x={entry.valor > 0 ? entry.valor : 0}
                        y={entry.valor > 0 ? entry.valor : 0}
                        textAnchor="middle"
                        fill="#6366f1"
                        fontSize="9"
                      >
                        {formatBRL(entry.valor)}
                      </text>
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gráfico de Barras Comparativo - Receita Líquida vs Valor Bruto vs Contas a Pagar */}
      <div className="mt-8">
        <div className="rounded-2xl bg-white border border-gray-200 p-8 shadow-md">
          <div className="text-base font-semibold text-gray-700 mb-4 text-center">
            Comparativo: Receita Líquida vs Valor Bruto vs Contas a Pagar por
            Canal
          </div>
          <div style={{ width: '100%', height: 400, padding: '20px' }}>
            <ResponsiveContainer>
              <BarChart
                data={barChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="canal" fontSize={11} />
                <YAxis
                  tickFormatter={(value) => formatBRL(value)}
                  fontSize={11}
                />
                <RechartsTooltip formatter={(value) => formatBRL(value)} />
                <Legend fontSize={11} />
                <Bar
                  dataKey="receitaLiquida"
                  name="Receita Líquida"
                  fill="#1d4ed8"
                />
                <Bar
                  dataKey="valorBruto"
                  name="Valor Bruto (Descontos)"
                  fill="#16a34a"
                />
                <Bar
                  dataKey="contasPagar"
                  name="Contas a Pagar"
                  fill="#dc2626"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Modal Tabela por Canal (centros de custo e valores) */}
      <Modal
        isOpen={!!modalAberto}
        onClose={() => setModalAberto(null)}
        title={
          modalAberto === 'VAREJO'
            ? 'Varejo'
            : modalAberto === 'MULTIMARCAS'
            ? 'Multimarcas'
            : modalAberto === 'FRANQUIAS_REVENDA'
            ? 'Franquias + Revenda'
            : modalAberto === 'MATRIZ'
            ? 'Matriz'
            : modalAberto === 'DIVERSOS'
            ? 'Diversos'
            : ''
        }
        size="4xl"
      >
        <div className="overflow-x-auto">
          {modalAberto === 'DIVERSOS' ? (
            <table className="min-w-full text-sm">
              <thead className="bg-[#000638] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Duplicata</th>
                  <th className="px-3 py-2 text-left">Fornecedor</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-left">Vencimento</th>
                  <th className="px-3 py-2 text-left">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {modalDadosCpDiversos.map((item, idx) => (
                  <tr
                    key={`${item.nr_duplicata}-${idx}`}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-3 py-2 text-gray-900">
                      {item.nr_duplicata}
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      {item.nm_fornecedor}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatBRL(item.vl_duplicata)}
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      {new Date(item.dt_vencimento).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      {item.tp_situacao}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-[#000638] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Código CC</th>
                  <th className="px-3 py-2 text-left">Centro de Custo</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {totaisPorCentroCusto
                  .filter((cc) => {
                    const FR = new Set([
                      '2',
                      '3',
                      '4',
                      '6',
                      '7',
                      '8',
                      '9',
                      '12',
                      '13',
                      '14',
                      '18',
                    ]);
                    const VR = new Set([
                      '5',
                      '15',
                      '16',
                      '19',
                      '30',
                      '31',
                      '32',
                      '33',
                      '34',
                      '35',
                      '36',
                      '37',
                    ]);
                    const MM = new Set(['17']);
                    const MT = new Set([
                      '26',
                      '20',
                      '28',
                      '22',
                      '27',
                      '1',
                      '23',
                      '24',
                      '29',
                      '25',
                      '10',
                    ]);
                    const code = (cc.code || '').trim();
                    if (modalAberto === 'FRANQUIAS_REVENDA')
                      return FR.has(code);
                    if (modalAberto === 'VAREJO') return VR.has(code);
                    if (modalAberto === 'MULTIMARCAS') return MM.has(code);
                    if (modalAberto === 'MATRIZ') return MT.has(code);
                    if (modalAberto === 'DIVERSOS')
                      return (
                        !FR.has(code) &&
                        !VR.has(code) &&
                        !MM.has(code) &&
                        !MT.has(code)
                      );
                    return true;
                  })
                  .map((cc, idx) => (
                    <tr
                      key={`${cc.code}-${idx}`}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-3 py-2 text-gray-900">{cc.code}</td>
                      <td className="px-3 py-2 text-gray-900">
                        {cc.name || '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatBRL(cc.valor)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  );
});

FinanceiroPorCanal.displayName = 'FinanceiroPorCanal';

export default FinanceiroPorCanal;
