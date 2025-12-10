import React, { useState, useEffect, useMemo } from 'react';
import DropdownContas from '../components/DropdownContas';
import { contas } from '../utils/contas';
import {
  ArrowsClockwise,
  ArrowCircleDown,
  ArrowCircleUp,
  Receipt,
  Spinner,
  Upload,
  CheckCircle,
  XCircle,
  Warning,
} from '@phosphor-icons/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/cards';
import useApiClient from '../hooks/useApiClient';
import ExtratoTotvsTable from '../components/ExtratoTotvsTable';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 100;

const ExtratoTotvs = () => {
  const apiClient = useApiClient();
  const [dadosTotvs, setDadosTotvs] = useState([]);
  const [totalTotvs, setTotalTotvs] = useState(0);
  const [loadingTotvs, setLoadingTotvs] = useState(false);
  const [erroTotvs, setErroTotvs] = useState('');
  const [expandTabelaTotvs, setExpandTabelaTotvs] = useState(true);
  const [filtros, setFiltros] = useState({
    nr_ctapes: [],
    dt_movim_ini: '',
    dt_movim_fim: '',
  });
  const [currentPageTotvs, setCurrentPageTotvs] = useState(1);
  const [filtroValorTotvs, setFiltroValorTotvs] = useState('');
  const [filtroTipoOperacao, setFiltroTipoOperacao] = useState('');
  const [filtroAuxiliar, setFiltroAuxiliar] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState(
    new Date().getFullYear(),
  );
  const [mesSelecionado, setMesSelecionado] = useState('');
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [linhasSelecionadas, setLinhasSelecionadas] = useState([]);
  const [dadosPlanilha, setDadosPlanilha] = useState([]);
  const [conferencia, setConferencia] = useState(null);
  const [mostrarConferencia, setMostrarConferencia] = useState(false);

  // Resetar página TOTVS quando dados TOTVS mudarem
  useEffect(() => {
    setCurrentPageTotvs(1);
  }, [dadosTotvs]);

  // Função para buscar dados do TOTVS
  const fetchDados = async (filtrosParam = filtros) => {
    setLoadingTotvs(true);
    setErroTotvs('');
    try {
      const params = {
        nr_ctapes: filtrosParam.nr_ctapes,
        dt_movim_ini: filtrosParam.dt_movim_ini,
        dt_movim_fim: filtrosParam.dt_movim_fim,
        limit: 1000000,
        offset: 0,
      };

      const resultTotvs = await apiClient.financial.extratoTotvs(params);

      if (resultTotvs.success) {
        setDadosTotvs(resultTotvs.data || []);
        setTotalTotvs(resultTotvs.total || 0);
      } else {
        throw new Error(resultTotvs.message || 'Erro ao buscar dados TOTVS');
      }
    } catch (err) {
      console.error('Erro ao buscar extrato TOTVS:', err);
      setErroTotvs('Erro ao buscar dados do servidor TOTVS.');
      setDadosTotvs([]);
      setTotalTotvs(0);
    } finally {
      setLoadingTotvs(false);
      setDadosCarregados(true);
    }
  };

  const handleChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  // Aplica dt_inicio/dt_fim conforme ano/mês escolhidos
  const aplicarPeriodoMes = (ano, mes) => {
    if (!ano) return;
    if (mes === 'ANO') {
      const inicio = new Date(ano, 0, 1).toISOString().split('T')[0];
      const fim = new Date(ano, 12, 0).toISOString().split('T')[0];
      setFiltros((prev) => ({
        ...prev,
        dt_movim_ini: inicio,
        dt_movim_fim: fim,
      }));
      return;
    }
    if (mes !== '' && !Number.isNaN(Number(mes))) {
      const m = Number(mes);
      const inicio = new Date(ano, m, 1).toISOString().split('T')[0];
      const fim = new Date(ano, m + 1, 0).toISOString().split('T')[0];
      setFiltros((prev) => ({
        ...prev,
        dt_movim_ini: inicio,
        dt_movim_fim: fim,
      }));
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    setCurrentPageTotvs(1);
    fetchDados({ ...filtros, [e.target.name]: e.target.value });
  };

  const handlePageChangeTotvs = (newPage) => {
    setCurrentPageTotvs(newPage);
  };

  // Dados processados TOTVS (filtrados)
  const dadosProcessadosTotvs = useMemo(() => {
    let dadosFiltrados = [...dadosTotvs];

    // Aplicar filtro de valor se existir
    if (filtroValorTotvs.trim() !== '') {
      const valorBusca = parseFloat(filtroValorTotvs.replace(',', '.'));
      if (!isNaN(valorBusca)) {
        dadosFiltrados = dadosFiltrados.filter((item) => {
          const valorItem = parseFloat(item.vl_lancto) || 0;
          return Math.abs(valorItem - valorBusca) < 0.01;
        });
      } else {
        dadosFiltrados = [];
      }
    }

    // Aplicar filtro de tipo de operação (Débito/Crédito)
    if (filtroTipoOperacao !== '') {
      dadosFiltrados = dadosFiltrados.filter(
        (item) => item.tp_operacao === filtroTipoOperacao,
      );
    }

    // Aplicar filtro de auxiliar
    if (filtroAuxiliar.trim() !== '') {
      const auxiliarBusca = filtroAuxiliar.toLowerCase();
      dadosFiltrados = dadosFiltrados.filter((item) => {
        const auxiliar = (item.nm_auxliar || '').toLowerCase();
        return auxiliar.includes(auxiliarBusca);
      });
    }

    return dadosFiltrados;
  }, [dadosTotvs, filtroValorTotvs, filtroTipoOperacao, filtroAuxiliar]);

  // Dados paginados TOTVS para exibição
  const dadosPaginadosTotvs = useMemo(() => {
    const startIndex = (currentPageTotvs - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return dadosProcessadosTotvs.slice(startIndex, endIndex);
  }, [dadosProcessadosTotvs, currentPageTotvs]);

  // Total de páginas para paginação TOTVS
  const totalPagesTotvs = Math.ceil(dadosProcessadosTotvs.length / PAGE_SIZE);

  // Resetar seleção quando dados filtrados mudarem
  useEffect(() => {
    setLinhasSelecionadas([]);
  }, [dadosProcessadosTotvs.length]);

  // Cards TOTVs
  const estatisticasTotvs = useMemo(() => {
    const qtdDebitosTotvs = dadosTotvs.filter(
      (row) => row.tp_operacao === 'D',
    ).length;
    const valorDebitosTotvs = dadosTotvs
      .filter((row) => row.tp_operacao === 'D')
      .reduce((acc, row) => acc + (row.vl_lancto || 0), 0);
    const qtdCreditosTotvs = dadosTotvs.filter(
      (row) => row.tp_operacao === 'C',
    ).length;
    const valorCreditosTotvs = dadosTotvs
      .filter((row) => row.tp_operacao === 'C')
      .reduce((acc, row) => acc + (row.vl_lancto || 0), 0);

    return {
      qtdDebitosTotvs,
      valorDebitosTotvs,
      qtdCreditosTotvs,
      valorCreditosTotvs,
    };
  }, [dadosTotvs]);

  // Soma dos valores selecionados
  const somaSelecionados = useMemo(() => {
    if (linhasSelecionadas.length === 0) return 0;
    return linhasSelecionadas.reduce(
      (acc, row) => acc + (row.vl_lancto || 0),
      0,
    );
  }, [linhasSelecionadas]);

  // Funções de seleção
  const handleSelectRow = (row) => {
    const index = linhasSelecionadas.findIndex(
      (item) =>
        item.dt_movim === row.dt_movim &&
        item.ds_doc === row.ds_doc &&
        item.vl_lancto === row.vl_lancto,
    );
    if (index > -1) {
      setLinhasSelecionadas(linhasSelecionadas.filter((_, i) => i !== index));
    } else {
      setLinhasSelecionadas([...linhasSelecionadas, row]);
    }
  };

  const handleSelectAll = () => {
    if (linhasSelecionadas.length === dadosPaginadosTotvs.length) {
      setLinhasSelecionadas([]);
    } else {
      setLinhasSelecionadas([...dadosPaginadosTotvs]);
    }
  };

  const isRowSelected = (row) => {
    return linhasSelecionadas.some(
      (item) =>
        item.dt_movim === row.dt_movim &&
        item.ds_doc === row.ds_doc &&
        item.vl_lancto === row.vl_lancto,
    );
  };

  // Função para processar upload da planilha
  const handleUploadPlanilha = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Processar dados da planilha (assumindo que tem cabeçalho)
        const headers = data[0];
        const rows = data.slice(1);

        const dadosProcessados = rows
          .filter((row) => row && row.length > 0)
          .map((row) => {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = row[index];
            });
            return obj;
          });

        console.log('📋 Colunas da planilha:', headers);
        console.log('📋 Total de linhas processadas:', dadosProcessados.length);

        setDadosPlanilha(dadosProcessados);
        realizarConferencia(dadosProcessados);
      } catch (error) {
        console.error('Erro ao processar planilha:', error);
        alert('Erro ao processar planilha. Verifique o formato do arquivo.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Função para realizar conferência
  const realizarConferencia = (dadosPlanilhaParam) => {
    console.log('=== INÍCIO DA CONFERÊNCIA ===');
    console.log('Total de registros na planilha:', dadosPlanilhaParam.length);
    console.log('Total de registros no TOTVS:', dadosTotvs.length);
    console.log('Primeiro registro da planilha:', dadosPlanilhaParam[0]);
    console.log('Primeiro registro do TOTVS:', dadosTotvs[0]);

    // Verificar se há dados do TOTVS
    if (dadosTotvs.length === 0) {
      alert(
        '⚠️ Atenção: Não há dados do TOTVS carregados!\n\nPor favor, selecione os filtros (conta, período) e clique em "Filtrar" antes de fazer o upload da planilha.',
      );
      return;
    }

    const encontrados = [];
    const naoEncontrados = [];
    const divergentes = [];

    dadosPlanilhaParam.forEach((itemPlanilha, index) => {
      // Tentar múltiplas variações de nomes de colunas
      let valorBruto =
        itemPlanilha['valor (R$)'] ||
        itemPlanilha['valor (r$)'] ||
        itemPlanilha['Valor (R$)'] ||
        itemPlanilha.Valor ||
        itemPlanilha.valor ||
        itemPlanilha.VALOR ||
        itemPlanilha['Valor'] ||
        itemPlanilha['valor da transação'] ||
        itemPlanilha['valor da transação'] ||
        itemPlanilha['Valor da Transação'] ||
        0;

      // Processar valor - remover formatação brasileira e converter
      let valorPlanilha = 0;
      if (typeof valorBruto === 'string') {
        // Remover "R$", espaços, pontos de milhar
        let valorLimpo = valorBruto
          .replace(/R\$|\s/g, '')
          .replace(/\./g, '')
          .replace(',', '.');
        // Checar se tem parênteses (valor negativo)
        if (valorLimpo.includes('(') || valorLimpo.includes(')')) {
          valorLimpo = '-' + valorLimpo.replace(/[()]/g, '');
        }
        valorPlanilha = parseFloat(valorLimpo) || 0;
      } else {
        valorPlanilha = parseFloat(valorBruto) || 0;
      }

      // Garantir que o valor seja sempre positivo para comparação
      valorPlanilha = Math.abs(valorPlanilha);

      const dataPlanilha =
        itemPlanilha.Data ||
        itemPlanilha.data ||
        itemPlanilha.DATA ||
        itemPlanilha['Data'] ||
        itemPlanilha.Dt ||
        itemPlanilha.dt ||
        itemPlanilha['data do pagamento'] ||
        itemPlanilha['data do pagamento'] ||
        itemPlanilha['Data do Pagamento'] ||
        '';

      // Log dos primeiros 3 registros para debug
      if (index < 3) {
        console.log(`\n--- Registro ${index + 1} da Planilha ---`);
        console.log('Item completo:', itemPlanilha);
        console.log('Valor bruto extraído:', valorBruto);
        console.log('Valor processado:', valorPlanilha);
        console.log('Data extraída:', dataPlanilha);
      }

      // Normalizar data da planilha
      let dataPlanilhaNormalizada = '';
      if (dataPlanilha) {
        // Se for número (data Excel)
        if (typeof dataPlanilha === 'number') {
          const date = XLSX.SSF.parse_date_code(dataPlanilha);
          dataPlanilhaNormalizada = `${date.y}-${String(date.m).padStart(
            2,
            '0',
          )}-${String(date.d).padStart(2, '0')}`;
        } else if (typeof dataPlanilha === 'string') {
          // Tentar converter string para formato YYYY-MM-DD
          const partes = dataPlanilha.split('/');
          if (partes.length === 3) {
            dataPlanilhaNormalizada = `${partes[2]}-${partes[1]}-${partes[0]}`;
          } else if (dataPlanilha.includes('-')) {
            // Já está em formato YYYY-MM-DD ou similar
            dataPlanilhaNormalizada = dataPlanilha.split('T')[0];
          }
        }
      }

      if (index < 3) {
        console.log('Data normalizada:', dataPlanilhaNormalizada);
      }

      // Buscar no TOTVS - busca exata
      let encontrado = dadosTotvs.find((itemTotvs) => {
        const valorTotvs = Math.abs(parseFloat(itemTotvs.vl_lancto) || 0);
        const valorPlanilhaAbs = Math.abs(valorPlanilha);
        const dataTotvs = itemTotvs.dt_movim
          ? itemTotvs.dt_movim.split('T')[0]
          : '';

        const valorMatch = Math.abs(valorTotvs - valorPlanilhaAbs) < 0.01;
        const dataMatch = dataTotvs === dataPlanilhaNormalizada;

        return valorMatch && dataMatch;
      });

      if (index < 3) {
        console.log('Encontrado exato?', !!encontrado);
      }

      if (encontrado) {
        encontrados.push({
          planilha: itemPlanilha,
          totvs: encontrado,
        });
      } else {
        // Buscar apenas por valor (ignorar data temporariamente para debug)
        const valorIgual = dadosTotvs.find((itemTotvs) => {
          const valorTotvs = Math.abs(parseFloat(itemTotvs.vl_lancto) || 0);
          const valorPlanilhaAbs = Math.abs(valorPlanilha);
          return Math.abs(valorTotvs - valorPlanilhaAbs) < 0.01;
        });

        if (index < 3) {
          console.log('Valor igual encontrado?', !!valorIgual);
          if (valorIgual) {
            console.log('Dados do TOTVS encontrado:', {
              valor: valorIgual.vl_lancto,
              data: valorIgual.dt_movim,
              tipo: valorIgual.tp_operacao,
              conta: valorIgual.nr_ctapes,
            });
          }
        }

        if (valorIgual) {
          const dataTotvs = valorIgual.dt_movim
            ? valorIgual.dt_movim.split('T')[0]
            : '';
          divergentes.push({
            planilha: itemPlanilha,
            totvs: valorIgual,
            motivo:
              dataTotvs !== dataPlanilhaNormalizada
                ? 'Data divergente'
                : 'Outro motivo',
            dataPlanilha: dataPlanilhaNormalizada,
            dataTotvs: dataTotvs,
          });
        } else {
          naoEncontrados.push(itemPlanilha);

          if (index < 3) {
            console.log('❌ Não encontrado valor próximo no TOTVS');
          }
        }
      }
    });

    console.log('\n=== RESUMO DA CONFERÊNCIA ===');
    console.log('Encontrados:', encontrados.length);
    console.log('Divergentes:', divergentes.length);
    console.log('Não encontrados:', naoEncontrados.length);

    setConferencia({
      total: dadosPlanilhaParam.length,
      encontrados,
      naoEncontrados,
      divergentes,
    });
    setMostrarConferencia(true);
  };

  // Função para verificar se linha do TOTVS foi encontrada na planilha
  const isLinhaEncontradaNaPlanilha = (rowTotvs) => {
    if (!conferencia || !conferencia.encontrados) return null;

    const encontrado = conferencia.encontrados.find((item) => {
      const valorTotvs = Math.abs(parseFloat(rowTotvs.vl_lancto) || 0);
      const valorEncontrado = Math.abs(parseFloat(item.totvs.vl_lancto) || 0);
      const dataTotvs = rowTotvs.dt_movim
        ? rowTotvs.dt_movim.split('T')[0]
        : '';
      const dataEncontrado = item.totvs.dt_movim
        ? item.totvs.dt_movim.split('T')[0]
        : '';

      return (
        Math.abs(valorTotvs - valorEncontrado) < 0.01 &&
        dataTotvs === dataEncontrado
      );
    });

    return encontrado ? 'encontrado' : 'nao-encontrado';
  };

  // Função para cor da fonte da conta
  function corConta(nome) {
    if (!nome) return '';
    if (nome.includes('CROSBY')) return 'text-blue-500';
    if (nome.includes('FABIO')) return 'text-yellow-600';
    if (nome.includes('IRMÃOS CR')) return 'text-orange-500';
    if (nome.includes('FLAVIO')) return 'text-green-500';
    return '';
  }

  return (
    <ErrorBoundary
      message="Erro ao carregar a página de Extrato TOTVS"
      onError={(error, errorInfo) => {
        console.error('ExtratoTotvs Error:', error, errorInfo);
      }}
    >
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">
          Extrato TOTVS
        </h1>
        <div className="mb-4">
          <form
            onSubmit={handleFiltrar}
            className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10"
          >
            <div className="mb-6">
              <span className="text-lg font-bold text-[#000638] flex items-center gap-2">
                <Receipt size={22} weight="bold" />
                Filtros
              </span>
              <span className="text-sm text-gray-500 mt-1">
                Selecione o período e as contas para análise
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-2 w-full mb-4">
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Contas
                </label>
                <DropdownContas
                  contas={contas}
                  contasSelecionadas={
                    Array.isArray(filtros.nr_ctapes) ? filtros.nr_ctapes : []
                  }
                  setContasSelecionadas={(fn) =>
                    setFiltros((prev) => ({
                      ...prev,
                      nr_ctapes:
                        typeof fn === 'function'
                          ? fn(
                              Array.isArray(prev.nr_ctapes)
                                ? prev.nr_ctapes
                                : [],
                            )
                          : fn,
                    }))
                  }
                  minWidth={200}
                  maxWidth={400}
                  placeholder="Selecione as contas"
                  hideLabel={true}
                  className="!bg-[#f8f9fb] !text-[#000638] !placeholder:text-gray-400 !px-3 !py-2 !w-full !rounded-lg !border !border-[#000638]/30 focus:!outline-none focus:!ring-2 focus:!ring-[#000638] !h-[42px] !text-base"
                />
              </div>
              {/* Seletor de Ano e Mês */}
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Ano
                </label>
                <select
                  value={anoSelecionado}
                  onChange={(e) => {
                    const novoAno = Number(e.target.value);
                    setAnoSelecionado(novoAno);
                    aplicarPeriodoMes(novoAno, mesSelecionado);
                  }}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                >
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const y = new Date().getFullYear() - idx;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Mês
                </label>
                <select
                  value={mesSelecionado}
                  onChange={(e) => {
                    const novoMes = e.target.value;
                    setMesSelecionado(novoMes);
                    aplicarPeriodoMes(anoSelecionado, novoMes);
                  }}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                >
                  <option value="">— Selecionar —</option>
                  <option value="ANO">Ano inteiro</option>
                  <option value="0">Jan</option>
                  <option value="1">Fev</option>
                  <option value="2">Mar</option>
                  <option value="3">Abr</option>
                  <option value="4">Mai</option>
                  <option value="5">Jun</option>
                  <option value="6">Jul</option>
                  <option value="7">Ago</option>
                  <option value="8">Set</option>
                  <option value="9">Out</option>
                  <option value="10">Nov</option>
                  <option value="11">Dez</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Data Inicial
                </label>
                <input
                  type="date"
                  name="dt_movim_ini"
                  value={filtros.dt_movim_ini}
                  onChange={handleChange}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Data Final
                </label>
                <input
                  type="date"
                  name="dt_movim_fim"
                  value={filtros.dt_movim_fim}
                  onChange={handleChange}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Tipo Operação
                </label>
                <select
                  value={filtroTipoOperacao}
                  onChange={(e) => setFiltroTipoOperacao(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                >
                  <option value="">Todos</option>
                  <option value="D">Débito</option>
                  <option value="C">Crédito</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">
                  Auxiliar
                </label>
                <input
                  type="text"
                  value={filtroAuxiliar}
                  onChange={(e) => setFiltroAuxiliar(e.target.value)}
                  placeholder="Filtrar por auxiliar"
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
            </div>
            <div className="flex justify-end w-full mt-1">
              <button
                type="submit"
                className="flex items-center gap-1 bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition h-9 text-sm font-bold shadow tracking-wide uppercase min-w-[90px] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loadingTotvs}
              >
                {loadingTotvs ? (
                  <Spinner size={18} className="animate-spin" />
                ) : (
                  <ArrowsClockwise size={18} weight="bold" />
                )}
                {loadingTotvs ? 'Carregando...' : 'Filtrar'}
              </button>
            </div>
          </form>
          {erroTotvs && (
            <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">
              {erroTotvs}
            </div>
          )}
        </div>

        {/* Upload de Planilha para Conferência */}
        <div className="mb-6 bg-white p-6 rounded-2xl shadow-lg border border-[#000638]/10 max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-[#000638] flex items-center gap-2">
                <Upload size={22} weight="bold" />
                Conferência de Planilha
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Faça upload da planilha consultaPagamento.xlsx para conferir com
                o TOTVS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer bg-[#000638] text-white px-5 py-2 rounded-lg hover:bg-[#fe0000] transition text-sm font-bold shadow tracking-wide uppercase flex items-center gap-2">
              <Upload size={18} weight="bold" />
              Selecionar Planilha
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUploadPlanilha}
                className="hidden"
              />
            </label>
            {dadosPlanilha.length > 0 && (
              <span className="text-sm text-green-600 font-semibold">
                ✓ {dadosPlanilha.length} registros carregados
              </span>
            )}
          </div>
        </div>

        {/* Resultado da Conferência */}
        {conferencia && mostrarConferencia && (
          <div className="mb-6 bg-white p-6 rounded-2xl shadow-lg border border-[#000638]/10 max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#000638]">
                Resultado da Conferência
              </h3>
              <button
                onClick={() => setMostrarConferencia(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt size={20} className="text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">
                    Total
                  </span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {conferencia.total}
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={20} className="text-green-600" />
                  <span className="text-sm font-semibold text-green-900">
                    Encontrados
                  </span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {conferencia.encontrados.length}
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <Warning size={20} className="text-yellow-600" />
                  <span className="text-sm font-semibold text-yellow-900">
                    Divergentes
                  </span>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {conferencia.divergentes.length}
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={20} className="text-red-600" />
                  <span className="text-sm font-semibold text-red-900">
                    Não Encontrados
                  </span>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {conferencia.naoEncontrados.length}
                </div>
              </div>
            </div>

            {/* Detalhes - Divergentes */}
            {conferencia.divergentes.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-bold text-yellow-600 mb-3 flex items-center gap-2">
                  <Warning size={18} />
                  Divergentes (Valor encontrado, mas com diferença) (
                  {conferencia.divergentes.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg text-sm">
                    <thead className="bg-yellow-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-yellow-900">
                          Data Planilha
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-yellow-900">
                          Data TOTVS
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-yellow-900">
                          Valor
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-yellow-900">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-yellow-900">
                          Conta
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-yellow-900">
                          Motivo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {conferencia.divergentes.map((item, idx) => {
                        const conta = contas.find(
                          (c) => c.numero === String(item.totvs.nr_ctapes),
                        );
                        return (
                          <tr key={idx} className="border-b hover:bg-yellow-50">
                            <td className="px-3 py-2">
                              {item.dataPlanilha ||
                                item.planilha.Data ||
                                item.planilha.data ||
                                '-'}
                            </td>
                            <td className="px-3 py-2">
                              {item.dataTotvs ||
                                item.totvs.dt_movim?.split('T')[0] ||
                                '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {parseFloat(
                                item.planilha.Valor || item.planilha.valor || 0,
                              ).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`font-bold ${
                                  item.totvs.tp_operacao === 'D'
                                    ? 'text-red-600'
                                    : 'text-green-600'
                                }`}
                              >
                                {item.totvs.tp_operacao === 'D'
                                  ? 'Débito'
                                  : 'Crédito'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {conta
                                ? `${conta.numero} - ${conta.nome}`
                                : item.totvs.nr_ctapes}
                            </td>
                            <td className="px-3 py-2 text-yellow-700">
                              {item.motivo}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cards em linha */}
        <div className="flex flex-row gap-2 mb-8 max-w-full justify-center items-stretch flex-wrap">
          {/* Card Selecionados */}
          {linhasSelecionadas.length > 0 && (
            <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 cursor-pointer p-1">
              <CardHeader className="pb-0 px-1 pt-1">
                <div className="flex flex-row items-center gap-1">
                  <Receipt size={15} className="text-white" />
                  <CardTitle className="text-xs font-bold text-white">
                    Selecionados
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-1 pl-2">
                <div className="text-lg font-extrabold text-white mb-0.5">
                  {linhasSelecionadas.length}
                </div>
                <CardDescription className="text-[10px] text-blue-100">
                  Qtd
                </CardDescription>
                <div className="text-xs font-bold text-white mt-0.5">
                  {somaSelecionados.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </div>
                <CardDescription className="text-[10px] text-blue-100 mt-1">
                  Soma
                </CardDescription>
              </CardContent>
            </Card>
          )}
          {/* Card Débitos TOTVs */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleDown size={15} className="text-[#fe0000]" />
                <CardTitle className="text-xs font-bold text-[#fe0000]">
                  Déb. TOTVs (D)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-[#fe0000] mb-0.5">
                {estatisticasTotvs.qtdDebitosTotvs}
              </div>
              <CardDescription className="text-[10px] text-gray-500">
                Qtd
              </CardDescription>
              <div className="text-xs font-bold text-[#fe0000] mt-0.5">
                {estatisticasTotvs.valorDebitosTotvs.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-[10px] text-gray-500 mt-1">
                Soma
              </CardDescription>
            </CardContent>
          </Card>

          {/* Card Créditos TOTVs */}
          <Card className="min-w-[140px] max-w-[160px] shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-lg bg-white cursor-pointer p-1">
            <CardHeader className="pb-0 px-1 pt-1">
              <div className="flex flex-row items-center gap-1">
                <ArrowCircleUp size={15} className="text-green-600" />
                <CardTitle className="text-xs font-bold text-green-600">
                  Créd. TOTVs (C)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pl-2">
              <div className="text-lg font-extrabold text-green-600 mb-0.5">
                {estatisticasTotvs.qtdCreditosTotvs}
              </div>
              <CardDescription className="text-[10px] text-gray-500">
                Qtd
              </CardDescription>
              <div className="text-xs font-bold text-green-600 mt-0.5">
                {estatisticasTotvs.valorCreditosTotvs.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <CardDescription className="text-[10px] text-gray-500 mt-1">
                Soma
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Tabela Extrato TOTVS */}
        <ExtratoTotvsTable
          dados={dadosPaginadosTotvs}
          dadosCompletos={dadosTotvs}
          loading={loadingTotvs}
          erro={erroTotvs}
          expandTabela={expandTabelaTotvs}
          setExpandTabela={setExpandTabelaTotvs}
          contas={contas}
          corConta={corConta}
          currentPage={currentPageTotvs}
          totalPages={totalPagesTotvs}
          totalRegistros={dadosProcessadosTotvs.length}
          onPageChange={handlePageChangeTotvs}
          pageSize={PAGE_SIZE}
          filtroValor={filtroValorTotvs}
          setFiltroValor={setFiltroValorTotvs}
          linhasSelecionadas={linhasSelecionadas}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          isRowSelected={isRowSelected}
          isLinhaEncontradaNaPlanilha={isLinhaEncontradaNaPlanilha}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ExtratoTotvs;
