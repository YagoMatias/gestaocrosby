import React, { useEffect, useMemo, useState, memo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import FiltroEmpresa from '../components/FiltroEmpresa';
import FiltroFormaPagamento from '../components/FiltroFormaPagamento';
import { TotvsURL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import {
  Calendar,
  Funnel,
  Spinner,
  CurrencyDollar,
  Table as TableIcon,
  FileArrowDown,
  Receipt,
  ArrowsOut,
  ArrowsIn,
  X,
  CaretRight,
  CaretDown,
  Bank,
} from '@phosphor-icons/react';
import {
  formatCurrency,
  getFormaPagamentoLabel,
  getFormaOriginalLabel,
  listaFormasPagamento,
  parseDateNoTZ,
  rotuloSituacao,
  rotuloTipoBaixa,
  ehFaturaBancoSafra,
  parearPixComAdiantamento,
} from '../utils/formasPagamento';

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const SIGLAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// 'YYYY-MM' -> 'Março/2026'
const rotuloMes = (chave) => {
  const [ano, mes] = chave.split('-').map(Number);
  return `${NOMES_MESES[mes - 1]}/${ano}`;
};

const diasNoMes = (chave) => {
  const [ano, mes] = chave.split('-').map(Number);
  return new Date(ano, mes, 0).getDate();
};

const formatarData = (iso) => {
  const d = parseDateNoTZ(iso);
  return d ? d.toLocaleDateString('pt-BR') : '-';
};

const FluxoCaixa = memo(() => {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [formasPagamentoSelecionadas, setFormasPagamentoSelecionadas] =
    useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoBuscaData, setTipoBuscaData] = useState('pagamento');
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [maximizado, setMaximizado] = useState(false);
  // { forma: string | null, dia: number } — forma null = todas as formas do dia
  const [celulaSelecionada, setCelulaSelecionada] = useState(null);
  const [portadorExpandido, setPortadorExpandido] = useState(null);
  const [tituloExpandido, setTituloExpandido] = useState(null);
  const [nomesClientes, setNomesClientes] = useState({});
  const [buscandoNomes, setBuscandoNomes] = useState(false);

  const dadosFormasPagamento = useMemo(() => listaFormasPagamento(), []);

  // Período padrão: mês corrente
  useEffect(() => {
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    setDataInicio(primeiro.toISOString().split('T')[0]);
    setDataFim(hoje.toISOString().split('T')[0]);
  }, []);

  // Esc fecha o modal, depois a tela cheia
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (celulaSelecionada) setCelulaSelecionada(null);
      else if (maximizado) setMaximizado(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [celulaSelecionada, maximizado]);

  // ======================== BUSCAR DADOS ========================
  // Mesma rota do Dashboard de Contas a Receber. Os nomes de cliente não são
  // buscados aqui: só o modal precisa deles, e lá a busca é sob demanda.
  const buscarDados = async () => {
    if (!dataInicio || !dataFim) return;
    if (empresasSelecionadas.length === 0) {
      alert('Selecione pelo menos uma empresa para consultar!');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('dt_inicio', dataInicio);
      params.append('dt_fim', dataFim);
      params.append('modo', tipoBuscaData);
      params.append('situacao', '1'); // NORMAIS

      if (formasPagamentoSelecionadas.length > 0) {
        params.append(
          'tp_documento',
          formasPagamentoSelecionadas.map((f) => f.codigo).join(','),
        );
      }

      params.append(
        'branches',
        empresasSelecionadas.map((e) => e.cd_empresa).join(','),
      );

      const response = await fetch(
        `${TotvsURL}accounts-receivable/filter?${params.toString()}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      let items = result.data?.items || [];

      // Só situação NORMAL (1), sem Desconto Financeiro (11) e DOFNI (12).
      // Fatura do Banco Safra é desconsiderada no fluxo de caixa.
      items = items.filter((item) => {
        const sit = parseInt(item.tp_situacao);
        const tp = parseInt(item.tp_documento);
        if (ehFaturaBancoSafra(item)) return false;
        return (isNaN(sit) || sit === 1) && tp !== 11 && tp !== 12;
      });

      setDados(items);
      setDadosCarregados(true);
      setMesSelecionado('');
      setCelulaSelecionada(null);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      alert(`Erro ao buscar dados: ${err.message}`);
      setDados([]);
      setDadosCarregados(false);
    } finally {
      setLoading(false);
    }
  };

  // Casa cada PIX de portador 1010 com o adiantamento que ele gerou.
  const pareamento = useMemo(() => parearPixComAdiantamento(dados), [dados]);

  // ======================== BAIXAS DO PERÍODO ========================
  // Uma "baixa" é um título com valor pago e data de liquidação: é isso que
  // entra no fluxo de caixa, no dia em que o dinheiro entrou.
  const baixas = useMemo(() => {
    const lista = [];
    let semData = 0;
    let ecoRemovido = { qtd: 0, valor: 0 };
    dados.forEach((item) => {
      const vlPago = parseFloat(item.vl_pago) || 0;
      if (vlPago <= 0.01) return;

      // Adiantamento que é eco de um PIX: o dinheiro já está na linha do PIX.
      // Fica acessível pelo título de PIX que o gerou, dentro do modal.
      if (pareamento.ecoDePix.has(item)) {
        ecoRemovido = {
          qtd: ecoRemovido.qtd + 1,
          valor: ecoRemovido.valor + vlPago,
        };
        return;
      }

      const dtLiq = parseDateNoTZ(item.dt_liq);
      if (!dtLiq) {
        semData += 1;
        return;
      }
      lista.push({
        forma: getFormaPagamentoLabel(item),
        ano: dtLiq.getFullYear(),
        mes: dtLiq.getMonth() + 1,
        dia: dtLiq.getDate(),
        valor: vlPago,
        item,
      });
    });
    return { lista, semData, ecoRemovido };
  }, [dados, pareamento]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(
      baixas.lista.map((b) => `${b.ano}-${String(b.mes).padStart(2, '0')}`),
    );
    return [...set].sort();
  }, [baixas]);

  // Seleciona um mês assim que os dados chegam (o do início do filtro, se houver)
  useEffect(() => {
    if (!mesesDisponiveis.length) {
      setMesSelecionado('');
      return;
    }
    if (mesesDisponiveis.includes(mesSelecionado)) return;
    const mesDoFiltro = dataInicio ? dataInicio.substring(0, 7) : '';
    setMesSelecionado(
      mesesDisponiveis.includes(mesDoFiltro) ? mesDoFiltro : mesesDisponiveis[0],
    );
  }, [mesesDisponiveis, mesSelecionado, dataInicio]);

  // cd_empresa -> nome do grupo, para exibir no modal
  const grupoPorEmpresa = useMemo(() => {
    const mapa = {};
    empresasSelecionadas.forEach((emp) => {
      mapa[String(emp.cd_empresa)] = emp.nm_grupoempresa || '';
    });
    return mapa;
  }, [empresasSelecionadas]);

  // ======================== PLANILHA (forma x dia) ========================
  const planilha = useMemo(() => {
    if (!mesSelecionado) return null;
    const [ano, mes] = mesSelecionado.split('-').map(Number);
    const totalDias = diasNoMes(mesSelecionado);

    const dias = Array.from({ length: totalDias }, (_, i) => {
      const numero = i + 1;
      const diaSemana = new Date(ano, mes - 1, numero).getDay();
      return {
        numero,
        diaSemana,
        sabado: diaSemana === 6,
        domingo: diaSemana === 0,
      };
    });

    const mapa = {};
    const totaisPorDia = Array(totalDias).fill(0);
    let totalGeral = 0;

    baixas.lista.forEach((b) => {
      if (b.ano !== ano || b.mes !== mes) return;
      if (!mapa[b.forma]) {
        mapa[b.forma] = { valores: Array(totalDias).fill(0), total: 0 };
      }
      mapa[b.forma].valores[b.dia - 1] += b.valor;
      mapa[b.forma].total += b.valor;
      totaisPorDia[b.dia - 1] += b.valor;
      totalGeral += b.valor;
    });

    const linhas = Object.entries(mapa)
      .map(([forma, d]) => ({ forma, ...d }))
      .sort((a, b) => b.total - a.total);

    return { ano, mes, dias, linhas, totaisPorDia, totalGeral };
  }, [baixas, mesSelecionado]);

  // ======================== TÍTULOS DA CÉLULA ========================
  const titulosCelula = useMemo(() => {
    if (!celulaSelecionada || !planilha) return [];
    const { forma, dia } = celulaSelecionada;
    return baixas.lista
      .filter(
        (b) =>
          b.ano === planilha.ano &&
          b.mes === planilha.mes &&
          b.dia === dia &&
          (forma === null || b.forma === forma),
      )
      .sort((a, b) => b.valor - a.valor);
  }, [celulaSelecionada, planilha, baixas]);

  // ======================== DRILL DOWN POR PORTADOR ========================
  // Nível 1 do modal: uma linha por portador com o total do dia. Os títulos
  // só aparecem ao expandir o portador.
  const gruposPortador = useMemo(() => {
    const mapa = {};
    titulosCelula.forEach((b) => {
      const nome =
        b.item.nm_portador ||
        (b.item.cd_portador
          ? `Portador ${b.item.cd_portador}`
          : 'Sem portador');
      if (!mapa[nome]) {
        mapa[nome] = { portador: nome, total: 0, qtd: 0, titulos: [] };
      }
      mapa[nome].total += b.valor;
      mapa[nome].qtd += 1;
      mapa[nome].titulos.push(b);
    });
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [titulosCelula]);

  // Com um único portador não há o que escolher: já abre expandido.
  useEffect(() => {
    setPortadorExpandido(
      gruposPortador.length === 1 ? gruposPortador[0].portador : null,
    );
    setTituloExpandido(null);
  }, [gruposPortador]);

  const titulosVisiveis = useMemo(() => {
    if (!portadorExpandido) return [];
    const grupo = gruposPortador.find((g) => g.portador === portadorExpandido);
    return grupo ? grupo.titulos : [];
  }, [gruposPortador, portadorExpandido]);

  // Busca os nomes dos clientes em lotes de 50, só do portador expandido.
  useEffect(() => {
    if (!titulosVisiveis.length) return;
    const codigos = [
      ...new Set(
        titulosVisiveis
          .map((b) => Number(b.item.cd_cliente))
          .filter((c) => c > 0),
      ),
    ].filter((c) => !(c in nomesClientes));
    if (!codigos.length) return;

    let cancelado = false;
    const buscar = async () => {
      setBuscandoNomes(true);
      const encontrados = {};
      try {
        for (let i = 0; i < codigos.length; i += 50) {
          const lote = codigos.slice(i, i + 50);
          const resp = await fetch(`${TotvsURL}persons/batch-lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personCodes: lote }),
          });
          if (!resp.ok) continue;
          const data = await resp.json();
          const pessoas = data?.data || data || {};
          for (const [codigo, pessoa] of Object.entries(pessoas)) {
            encontrados[String(codigo).trim()] =
              pessoa.fantasyName || pessoa.name || '';
          }
        }
      } catch (err) {
        console.error('Erro ao buscar nomes de clientes:', err);
      }
      if (cancelado) return;
      // Marca também os códigos sem retorno, para não repetir a busca
      const atualizado = { ...encontrados };
      codigos.forEach((c) => {
        if (!(String(c) in atualizado)) atualizado[String(c)] = '';
      });
      setNomesClientes((anterior) => ({ ...anterior, ...atualizado }));
      setBuscandoNomes(false);
    };
    buscar();
    return () => {
      // Recolher o portador no meio da busca não pode deixar o aviso preso.
      cancelado = true;
      setBuscandoNomes(false);
    };
  }, [titulosVisiveis, nomesClientes]);

  const totalCelula = useMemo(
    () => titulosCelula.reduce((acc, b) => acc + b.valor, 0),
    [titulosCelula],
  );

  // ======================== EXPORTAR EXCEL ========================
  const exportarExcel = () => {
    if (!planilha) return;
    const cabecalho = [
      'Forma de Pagamento',
      ...planilha.dias.map((d) => String(d.numero)),
      'Total',
    ];
    const linhas = planilha.linhas.map((l) => [l.forma, ...l.valores, l.total]);
    linhas.push(['TOTAL', ...planilha.totaisPorDia, planilha.totalGeral]);

    const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
    ws['!cols'] = [
      { wch: 24 },
      ...planilha.dias.map(() => ({ wch: 12 })),
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `FluxoCaixa_${mesSelecionado}.xlsx`,
    );
  };

  const hoje = new Date();
  const ehMesCorrente =
    mesSelecionado ===
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  // Fundo das colunas de fim de semana (sábado mais claro que domingo)
  const fundoDia = (dia, zebrado) => {
    if (dia.domingo) return 'bg-red-50';
    if (dia.sabado) return 'bg-blue-50';
    return zebrado ? 'bg-gray-50' : 'bg-white';
  };

  // Em tela cheia a planilha ganha fonte e respiro maiores.
  const txtTabela = maximizado ? 'text-sm' : 'text-xs';
  const padCelula = maximizado ? 'px-3 py-2.5' : 'px-2 py-1.5';
  const padPrimeira = maximizado ? 'px-4 py-2.5' : 'px-3 py-1.5';

  // ======================== BLOCO DA PLANILHA ========================
  // Renderizado tanto embutido na página quanto dentro da tela cheia.
  const blocoPlanilha = (
    <>
      {/* ---- BARRA: MÊS + AÇÕES ---- */}
      <div
        className={`bg-white p-3 rounded-lg shadow-md border border-[#000638]/10 mb-4 ${
          maximizado ? 'shrink-0' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[#000638]">Mês:</span>
            {mesesDisponiveis.length === 0 && (
              <span className="text-xs text-gray-500">
                Nenhum recebimento no período
              </span>
            )}
            {mesesDisponiveis.map((m) => (
              <button
                key={m}
                onClick={() => setMesSelecionado(m)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  mesSelecionado === m
                    ? 'bg-[#000638] text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {rotuloMes(m)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {planilha && planilha.linhas.length > 0 && (
              <button
                onClick={exportarExcel}
                className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs font-bold shadow-md"
                title="Exportar para Excel"
              >
                <FileArrowDown size={14} />
                Excel
              </button>
            )}
            <button
              onClick={() => setMaximizado((v) => !v)}
              className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1.5 rounded-lg hover:bg-[#fe0000] transition-colors text-xs font-bold shadow-md"
              title={
                maximizado
                  ? 'Sair da tela cheia (Esc)'
                  : 'Maximizar planilha em tela cheia'
              }
            >
              {maximizado ? <ArrowsIn size={14} /> : <ArrowsOut size={14} />}
              {maximizado ? 'Restaurar' : 'Maximizar'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-blue-50 border border-blue-200" />
            Sábado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />
            Domingo
          </span>
          <span>Clique numa célula para ver os títulos do dia.</span>
        </div>

        {baixas.ecoRemovido.qtd > 0 && (
          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1.5 mt-2">
            <strong>{baixas.ecoRemovido.qtd} adiantamento(s)</strong> somando{' '}
            <strong>{formatCurrency(baixas.ecoRemovido.valor)}</strong> saíram da
            linha de Adiantamento: foram gerados por PIX e o dinheiro já está na
            linha de PIX. No modal, o PIX que gerou aparece em laranja e abre o
            adiantamento correspondente. Nota Promissória conta como PIX; fatura
            do Banco Safra é desconsiderada.
          </div>
        )}

        {baixas.semData > 0 && (
          <div className="text-xs text-orange-600 mt-2">
            {baixas.semData} título(s) com valor pago não têm data de liquidação
            e ficaram fora da planilha.
          </div>
        )}
      </div>

      {/* ---- TABELA ---- */}
      {planilha && planilha.linhas.length > 0 ? (
        <div
          className={`bg-white rounded-lg shadow-md border border-[#000638]/10 ${
            maximizado ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto'
          }`}
        >
          <table className={`min-w-full ${txtTabela} border-collapse`}>
            <thead>
              <tr className="bg-[#000638] text-white">
                <th
                  className={`sticky left-0 top-0 z-30 bg-[#000638] ${padPrimeira} text-left font-bold whitespace-nowrap`}
                >
                  Forma de Pagamento
                </th>
                {planilha.dias.map((d) => (
                  <th
                    key={d.numero}
                    className={`sticky top-0 z-20 ${padCelula} text-right font-bold whitespace-nowrap ${
                      d.domingo
                        ? 'bg-red-900'
                        : d.sabado
                          ? 'bg-blue-900'
                          : 'bg-[#000638]'
                    }`}
                  >
                    <div>{String(d.numero).padStart(2, '0')}</div>
                    <div className="font-normal opacity-70">
                      {SIGLAS_SEMANA[d.diaSemana]}
                    </div>
                  </th>
                ))}
                <th
                  className={`sticky top-0 z-20 ${padPrimeira} text-right font-bold whitespace-nowrap bg-[#000a5c]`}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {planilha.linhas.map((linha, i) => {
                const zebrado = i % 2 !== 0;
                return (
                  <tr key={linha.forma}>
                    <td
                      className={`sticky left-0 z-10 ${padPrimeira} font-semibold text-[#000638] whitespace-nowrap ${
                        zebrado ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      {linha.forma}
                    </td>
                    {linha.valores.map((v, idx) => {
                      const dia = planilha.dias[idx];
                      return (
                        <td
                          key={dia.numero}
                          onClick={
                            v > 0
                              ? () =>
                                  setCelulaSelecionada({
                                    forma: linha.forma,
                                    dia: dia.numero,
                                  })
                              : undefined
                          }
                          className={`${padCelula} text-right whitespace-nowrap ${fundoDia(
                            dia,
                            zebrado,
                          )} ${
                            v > 0
                              ? 'text-gray-800 cursor-pointer hover:bg-[#000638] hover:text-white transition-colors'
                              : 'text-gray-300'
                          }`}
                          title={
                            v > 0
                              ? `${linha.forma} — dia ${String(dia.numero).padStart(2, '0')}`
                              : undefined
                          }
                        >
                          {v > 0 ? formatCurrency(v) : '-'}
                        </td>
                      );
                    })}
                    <td
                      className={`${padPrimeira} text-right font-bold text-green-700 whitespace-nowrap bg-green-50`}
                    >
                      {formatCurrency(linha.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className={maximizado ? 'sticky bottom-0 z-20' : ''}>
              <tr className="font-bold text-[#000638]">
                <td
                  className={`sticky left-0 z-20 bg-[#e6e7ef] ${padPrimeira} whitespace-nowrap`}
                >
                  TOTAL
                </td>
                {planilha.totaisPorDia.map((v, idx) => {
                  const dia = planilha.dias[idx];
                  return (
                    <td
                      key={dia.numero}
                      onClick={
                        v > 0
                          ? () =>
                              setCelulaSelecionada({
                                forma: null,
                                dia: dia.numero,
                              })
                          : undefined
                      }
                      className={`${padCelula} text-right whitespace-nowrap ${
                        dia.domingo
                          ? 'bg-red-100'
                          : dia.sabado
                            ? 'bg-blue-100'
                            : 'bg-[#e6e7ef]'
                      } ${
                        v > 0
                          ? 'cursor-pointer hover:bg-[#000638] hover:text-white transition-colors'
                          : 'text-gray-400'
                      }`}
                      title={
                        v > 0
                          ? `Todas as formas — dia ${String(dia.numero).padStart(2, '0')}`
                          : undefined
                      }
                    >
                      {v > 0 ? formatCurrency(v) : '-'}
                    </td>
                  );
                })}
                <td
                  className={`${padPrimeira} text-right whitespace-nowrap bg-green-100 text-green-800`}
                >
                  {formatCurrency(planilha.totalGeral)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div
          className={`flex justify-center items-center py-16 text-gray-500 text-sm bg-white rounded-lg shadow-md border border-[#000638]/10 ${
            maximizado ? 'flex-1' : ''
          }`}
        >
          Nenhum recebimento no mês selecionado
        </div>
      )}
    </>
  );

  // ======================== RENDER ========================
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Fluxo de Caixa"
        subtitle="Valores recebidos por forma de pagamento, dia a dia"
        icon={TableIcon}
        iconColor="text-green-600"
      />

      {/* ============ FILTROS ============ */}
      <div className="mb-4">
        <div className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full border border-[#000638]/10">
          <div className="mb-2">
            <span className="text-lg font-bold text-[#000638] flex items-center gap-1">
              <Funnel size={18} weight="bold" />
              Filtros
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
            <div>
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Tipo de Data
              </label>
              <select
                value={tipoBuscaData}
                onChange={(e) => setTipoBuscaData(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="pagamento">Pagamento</option>
                <option value="vencimento">Vencimento</option>
                <option value="emissao">Emissão</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              />
            </div>
            <div>
              <FiltroFormaPagamento
                formasPagamentoSelecionadas={formasPagamentoSelecionadas}
                onSelectFormasPagamento={setFormasPagamentoSelecionadas}
                dadosFormasPagamento={dadosFormasPagamento}
              />
            </div>
            <div>
              <button
                onClick={buscarDados}
                className="flex gap-1 bg-[#000638] text-white px-4 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-8 text-xs font-bold shadow-md tracking-wide uppercase w-full justify-center mt-4"
                disabled={loading || !dataInicio || !dataFim}
              >
                {loading ? (
                  <>
                    <Spinner size={12} className="animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Calendar size={12} />
                    Buscar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============ LOADING ============ */}
      {loading && (
        <div className="flex justify-center items-center py-16">
          <Spinner size={32} className="animate-spin text-[#000638]" />
          <span className="ml-3 text-gray-600">Carregando dados...</span>
        </div>
      )}

      {/* ============ SEM DADOS ============ */}
      {!loading && !dadosCarregados && (
        <div className="flex justify-center items-center py-16 text-gray-500 text-sm">
          Selecione o período e empresa, depois clique em &quot;Buscar&quot;
        </div>
      )}

      {/* ============ PLANILHA ============ */}
      {!loading && dadosCarregados && (
        <>
          {/* ---- CARDS ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CurrencyDollar size={16} className="text-green-600" />
                  <CardTitle className="text-xs font-bold text-green-700">
                    Recebido no Mês
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-green-700">
                  {formatCurrency(planilha?.totalGeral || 0)}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  {mesSelecionado ? rotuloMes(mesSelecionado) : '-'}
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-blue-600" />
                  <CardTitle className="text-xs font-bold text-blue-700">
                    Formas de Pagamento
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-blue-700">
                  {planilha?.linhas.length || 0}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  com recebimento no mês
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-lg rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[#000638]" />
                  <CardTitle className="text-xs font-bold text-[#000638]">
                    Média por Dia
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-[#000638]">
                  {formatCurrency(
                    planilha && planilha.dias.length
                      ? planilha.totalGeral /
                          (ehMesCorrente
                            ? Math.min(hoje.getDate(), planilha.dias.length)
                            : planilha.dias.length)
                      : 0,
                  )}
                </div>
                <CardDescription className="text-xs text-gray-500">
                  {ehMesCorrente ? 'até hoje' : 'no mês inteiro'}
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {maximizado ? (
            <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col p-4">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <TableIcon size={24} className="text-green-600" />
                <h2 className="text-xl font-bold text-[#000638]">
                  Fluxo de Caixa
                  {mesSelecionado ? ` — ${rotuloMes(mesSelecionado)}` : ''}
                </h2>
              </div>
              {blocoPlanilha}
            </div>
          ) : (
            blocoPlanilha
          )}
        </>
      )}

      {/* ============ MODAL DA CÉLULA ============ */}
      {celulaSelecionada && planilha && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setCelulaSelecionada(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-[#000638]">
                  {celulaSelecionada.forma || 'Todas as formas'} —{' '}
                  {String(celulaSelecionada.dia).padStart(2, '0')}/
                  {String(planilha.mes).padStart(2, '0')}/{planilha.ano}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {gruposPortador.length} portador(es) · {titulosCelula.length}{' '}
                  título(s) · {formatCurrency(totalCelula)}
                  {buscandoNomes && ' · buscando nomes dos clientes...'}
                </p>
                {titulosCelula.some((b) =>
                  pareamento.adiantamentoDoPix.has(b.item),
                ) && (
                  <p className="text-xs text-orange-700 mt-1 flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300" />
                    PIX que gerou adiantamento — clique na linha para ver o
                    título gerado
                  </p>
                )}
              </div>
              <button
                onClick={() => setCelulaSelecionada(null)}
                className="text-gray-400 hover:text-[#fe0000] transition-colors"
                title="Fechar (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-auto flex-1">
              <table className="min-w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-[#000638] text-white">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold whitespace-nowrap">
                      Portador
                    </th>
                    <th className="px-3 py-2 text-right font-bold whitespace-nowrap">
                      Títulos
                    </th>
                    <th className="px-3 py-2 text-right font-bold whitespace-nowrap">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gruposPortador.map((grupo, gi) => {
                    const expandido = portadorExpandido === grupo.portador;
                    return (
                      <React.Fragment key={grupo.portador}>
                        <tr
                          onClick={() =>
                            setPortadorExpandido(
                              expandido ? null : grupo.portador,
                            )
                          }
                          className={`cursor-pointer transition-colors ${
                            expandido
                              ? 'bg-[#000638] text-white'
                              : `${gi % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`
                          }`}
                          title={
                            expandido
                              ? 'Recolher'
                              : 'Ver os títulos deste portador'
                          }
                        >
                          <td className="px-3 py-2 whitespace-nowrap font-semibold">
                            <span className="inline-flex items-center gap-1.5">
                              {expandido ? (
                                <CaretDown size={14} weight="bold" />
                              ) : (
                                <CaretRight size={14} weight="bold" />
                              )}
                              <Bank
                                size={14}
                                className={
                                  expandido ? 'text-white' : 'text-[#000638]'
                                }
                              />
                              {grupo.portador}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {grupo.qtd}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-bold whitespace-nowrap ${
                              expandido ? 'text-white' : 'text-green-700'
                            }`}
                          >
                            {formatCurrency(grupo.total)}
                          </td>
                        </tr>

                        {expandido && (
                          <tr>
                            <td colSpan={3} className="p-0">
                              <div className="overflow-x-auto border-y-2 border-[#000638]/20">
                                <table className="min-w-full text-xs border-collapse">
                                  <thead className="bg-[#e6e7ef] text-[#000638]">
                                    <tr>
                                      <th className="px-3 py-1.5 text-left font-bold whitespace-nowrap">
                                        Cliente
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-bold whitespace-nowrap">
                                        Empresa
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-bold whitespace-nowrap">
                                        Fatura
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-bold whitespace-nowrap">
                                        Vencimento
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-bold whitespace-nowrap">
                                        Liquidação
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-bold whitespace-nowrap">
                                        Forma de Pagamento
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-bold whitespace-nowrap">
                                        Situação
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-bold whitespace-nowrap">
                                        Tipo de Baixa
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-bold whitespace-nowrap">
                                        Valor Pago
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {grupo.titulos.map((b, i) => {
                                      const t = b.item;
                                      const codigo = String(
                                        t.cd_cliente || '',
                                      ).trim();
                                      const nome = nomesClientes[codigo];
                                      const nomeEmpresa =
                                        grupoPorEmpresa[String(t.cd_empresa)];
                                      const adi =
                                        pareamento.adiantamentoDoPix.get(t);
                                      const chave = `${t.cd_empresa}-${t.nr_fatura}-${t.nr_parcela}-${i}`;
                                      const aberto = tituloExpandido === chave;
                                      return (
                                        <React.Fragment key={chave}>
                                          <tr
                                            onClick={
                                              adi
                                                ? () =>
                                                    setTituloExpandido(
                                                      aberto ? null : chave,
                                                    )
                                                : undefined
                                            }
                                            title={
                                              adi
                                                ? 'Este PIX gerou um adiantamento — clique para ver'
                                                : undefined
                                            }
                                            className={
                                              adi
                                                ? `cursor-pointer ${aberto ? 'bg-orange-200' : 'bg-orange-100 hover:bg-orange-200'}`
                                                : i % 2 === 0
                                                  ? 'bg-white'
                                                  : 'bg-gray-50'
                                            }
                                          >
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                              {adi && (
                                                <span className="inline-block mr-1 text-orange-700">
                                                  {aberto ? (
                                                    <CaretDown
                                                      size={12}
                                                      weight="bold"
                                                    />
                                                  ) : (
                                                    <CaretRight
                                                      size={12}
                                                      weight="bold"
                                                    />
                                                  )}
                                                </span>
                                              )}
                                              <span className="text-gray-400">
                                                {codigo || '-'}
                                              </span>
                                              {nome ? ` · ${nome}` : ''}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                              {t.cd_empresa}
                                              {nomeEmpresa
                                                ? ` · ${nomeEmpresa}`
                                                : ''}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                              {t.nr_fatura}
                                              {t.nr_parcela
                                                ? `/${t.nr_parcela}`
                                                : ''}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                              {formatarData(t.dt_vencimento)}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                              {formatarData(t.dt_liq)}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                              {getFormaOriginalLabel(t)}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                              {rotuloSituacao(t.tp_situacao)}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                              {rotuloTipoBaixa(t.tp_baixa)}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-bold text-green-700 whitespace-nowrap">
                                              {formatCurrency(b.valor)}
                                            </td>
                                          </tr>

                                          {adi && aberto && (
                                            <tr className="bg-orange-50">
                                              <td className="px-3 py-1.5 whitespace-nowrap pl-8 text-orange-800 font-semibold">
                                                ↳ Adiantamento gerado
                                              </td>
                                              <td className="px-3 py-1.5 whitespace-nowrap">
                                                {adi.cd_empresa}
                                                {grupoPorEmpresa[
                                                  String(adi.cd_empresa)
                                                ]
                                                  ? ` · ${grupoPorEmpresa[String(adi.cd_empresa)]}`
                                                  : ''}
                                              </td>
                                              <td className="px-3 py-1.5 whitespace-nowrap">
                                                {adi.nr_fatura}
                                                {adi.nr_parcela
                                                  ? `/${adi.nr_parcela}`
                                                  : ''}
                                              </td>
                                              <td className="px-3 py-1.5 whitespace-nowrap">
                                                {formatarData(
                                                  adi.dt_vencimento,
                                                )}
                                              </td>
                                              <td className="px-3 py-1.5 whitespace-nowrap">
                                                {formatarData(adi.dt_liq)}
                                              </td>
                                              <td className="px-3 py-1.5 whitespace-nowrap">
                                                {getFormaOriginalLabel(adi)}
                                              </td>
                                              <td className="px-3 py-1.5 whitespace-nowrap">
                                                {rotuloSituacao(
                                                  adi.tp_situacao,
                                                )}
                                              </td>
                                              <td className="px-3 py-1.5 whitespace-nowrap">
                                                {rotuloTipoBaixa(adi.tp_baixa)}
                                              </td>
                                              <td className="px-3 py-1.5 text-right whitespace-nowrap text-orange-800">
                                                {formatCurrency(
                                                  parseFloat(adi.vl_pago) || 0,
                                                )}
                                                <div className="text-[10px] font-normal opacity-80">
                                                  não somado
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0">
                  <tr className="bg-[#e6e7ef] font-bold text-[#000638]">
                    <td className="px-3 py-2">TOTAL</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {titulosCelula.length}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatCurrency(totalCelula)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FluxoCaixa.displayName = 'FluxoCaixa';

export default FluxoCaixa;
