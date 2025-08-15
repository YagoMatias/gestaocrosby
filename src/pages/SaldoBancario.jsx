import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { buscarSaldosPorConta } from '../lib/retornoBancario';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';

import { 
  Bank, 
  TrendUp, 
  TrendDown,
  Spinner,
  CaretUp,
  CaretDown,
  Calendar,
  CurrencyDollar,
  Plus,
  Minus
} from '@phosphor-icons/react';

const SaldoBancario = () => {
  // Função para obter dias do mês
  const obterDiasDoMes = (mes) => {
    const meses = {
      'JAN': 31, 'FEV': 28, 'MAR': 31, 'ABR': 30, 'MAI': 31, 'JUN': 30,
      'JUL': 31, 'AGO': 31, 'SET': 30, 'OUT': 31, 'NOV': 30, 'DEZ': 31
    };
    return meses[mes] || 0;
  };

  // Função para obter o mês atual em formato abreviado
  const getMesAtual = () => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const mesAtual = new Date().getMonth(); // 0-11
    return meses[mesAtual];
  };

  // Função para obter o dia atual
  const getDiaAtual = () => {
    return new Date().getDate();
  };

  // Função para obter o dia inicial válido para o mês atual
  const getDiaInicial = () => {
    const diaAtual = getDiaAtual();
    const mesAtual = getMesAtual();
    const diasNoMes = obterDiasDoMes(mesAtual);
    
    // Se o dia atual é maior que os dias no mês, usar o último dia do mês
    return Math.min(diaAtual, diasNoMes);
  };

  // Estados dos filtros - inicializar com mês e dia atual
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear());
  const [filtroMensal, setFiltroMensal] = useState(getMesAtual());
  const [filtroDia, setFiltroDia] = useState(getDiaInicial());
  const [filtroBanco, setFiltroBanco] = useState('TODOS');
  
  // Estados dos dados
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [saldosContas, setSaldosContas] = useState([]);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [dadosOriginais, setDadosOriginais] = useState([]);
  
  // Estado para ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

  // Função para formatar valores monetários
  const formatCurrency = (value) => {
    if (typeof value === 'number') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    }
    return 'R$ 0,00';
  };

  // Função para formatar número da conta (remover zeros à esquerda)
  const formatConta = (conta) => {
    if (!conta) return 'N/A';
    // Remove zeros à esquerda e converte para string
    return parseInt(conta, 10).toString();
  };

  // Função para formatar percentual
  const formatPercentage = (value) => {
    if (typeof value === 'number') {
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    }
    return '0%';
  };

  // Função para obter bancos únicos dos dados
  const obterBancosUnicos = useMemo(() => {
    if (dadosOriginais.length === 0) return [];
    
    const bancos = [...new Set(dadosOriginais.map(item => item.banco))].filter(Boolean).sort();
    console.log('Bancos únicos encontrados:', bancos);
    return bancos;
  }, [dadosOriginais]);



  // Função para lidar com mudança de filtro mensal
  const handleFiltroMensalChange = (novoFiltro) => {
    setFiltroMensal(novoFiltro);
    
    // Se mudou para um mês diferente, ajustar o dia
    if (novoFiltro !== filtroMensal) {
      const diasNoNovoMes = obterDiasDoMes(novoFiltro);
      
      // Se o dia atual é maior que os dias no novo mês, usar o último dia
      if (filtroDia > diasNoNovoMes) {
        setFiltroDia(diasNoNovoMes);
      } else {
        // Usar o dia atual (se válido) ou 1
        const diaAtual = new Date().getDate();
        setFiltroDia(Math.min(diaAtual, diasNoNovoMes));
      }
    }
  };

  // Função para aplicar filtro mensal, dia e banco
  const aplicarFiltroMensal = (dados, filtro, diaFiltro = null, anoFiltro = null, bancoFiltro = null) => {
    console.log('Aplicando filtro:', { filtro, diaFiltro, anoFiltro, bancoFiltro, totalDados: dados.length });
    
    const anoParaFiltrar = anoFiltro || new Date().getFullYear();
    
    const dadosFiltrados = dados.filter((item) => {
      // Usar data_geracao como base para o filtro mensal
      const dataGeracao = item.data_geracao;
      if (!dataGeracao) {
        console.log('Item sem data_geracao:', item);
        return false;
      }
      
      const data = new Date(dataGeracao);
      const ano = data.getFullYear();
      const mes = data.getMonth() + 1; // getMonth() retorna 0-11, então +1
      const dia = data.getDate();
      
      console.log(`Item ${item.numero}: data=${dataGeracao}, ano=${ano}, mes=${mes}, dia=${dia}`);
      
      // Filtros por mês específico
      const mesesMap = {
        'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4,
        'MAI': 5, 'JUN': 6, 'JUL': 7, 'AGO': 8,
        'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12
      };
      
      const mesDoFiltro = mesesMap[filtro];
      if (mesDoFiltro) {
        // Verificar se é do ano selecionado
        if (ano !== anoParaFiltrar) {
          console.log(`Item ${item.numero}: ano ${ano} diferente do ano selecionado ${anoParaFiltrar}`);
          return false;
        }
        
        // Se há filtro por dia, verificar também o dia
        if (diaFiltro !== null) {
          const match = mes === mesDoFiltro && dia === diaFiltro;
          console.log(`Filtro ${filtro} dia ${diaFiltro}: ano=${ano}, mes=${mes}, dia=${dia}, match=${match}`);
          return match;
        }
        const match = mes === mesDoFiltro;
        console.log(`Filtro ${filtro}: ano=${ano}, mes=${mes}, match=${match}`);
        return match;
      }
      
      return true;
    });

    // Aplicar filtro de banco se especificado
    let dadosFiltradosPorBanco = dadosFiltrados;
    if (bancoFiltro && bancoFiltro !== 'TODOS') {
      console.log(`Aplicando filtro de banco: ${bancoFiltro}`);
      dadosFiltradosPorBanco = dadosFiltrados.filter(item => {
        const bancoItem = (item.banco || '').toUpperCase();
        const bancoFiltroUpper = bancoFiltro.toUpperCase();
        
        // Verificar se o banco do item contém o filtro (para casos como "ITAU" vs "BANCO ITAU")
        const match = bancoItem.includes(bancoFiltroUpper) || bancoFiltroUpper.includes(bancoItem);
        console.log(`Filtro banco ${bancoFiltro}: ${bancoItem} -> ${match}`);
        return match;
      });
      console.log(`Filtro de banco aplicado: ${dadosFiltradosPorBanco.length} registros encontrados`);
    }
    
    console.log('Dados filtrados:', dadosFiltradosPorBanco.length);
    
    // Debug: mostrar as datas dos dados filtrados
    if (dadosFiltradosPorBanco.length > 0) {
      const datasFiltradas = [...new Set(dadosFiltradosPorBanco.map(item => {
        const data = new Date(item.data_geracao);
        return `${data.getDate()}/${data.getMonth() + 1}/${data.getFullYear()}`;
      }))].sort();
      console.log('Datas dos dados filtrados:', datasFiltradas);
    }
    
    return dadosFiltradosPorBanco;
  };

  // Função para buscar todos os dados da tabela retorno_bancario
  const buscarTodosDados = async () => {
    setLoading(true);
    setErro('');
    
    try {
      const result = await buscarSaldosPorConta({});
      
      if (result.success) {
        // Processar os dados para incluir todos os registros individuais
        const dadosProcessados = [];
        
        result.data.forEach(conta => {
          // Para cada registro da conta, criar um item separado
          conta.registros.forEach(registro => {
            dadosProcessados.push({
              numero: conta.numero,
              nome: conta.nome,
              saldo: parseFloat(registro.valor), // Usar o valor do registro específico
              banco: registro.banco_nome,
              agencia: registro.agencia,
              ultimaAtualizacao: new Date(registro.data_geracao),
              operacao: {
                tipo: registro.operacao_tipo,
                descricao: registro.operacao_descricao,
                sinal: registro.operacao_sinal,
                isPositive: registro.operacao_is_positive,
                valorAbsoluto: registro.operacao_valor_absoluto
              },
              registros: [registro], // Manter apenas este registro
              totalRegistros: 1,
              data_geracao: registro.data_geracao // Usar a data_geracao do registro específico
            });
          });
        });
        
        console.log('Dados processados:', dadosProcessados.length, 'registros individuais');
        
        // Contador para duplicatas
        let duplicatasRemovidas = 0;
        
        // Remover duplicatas baseado em banco, agência, conta, data_geração e saldo
        const dadosUnicos = [];
        const chavesUnicas = new Set();
        
        // Primeiro, ordenar por data_geracao para garantir consistência
        dadosProcessados.sort((a, b) => new Date(a.data_geracao) - new Date(b.data_geracao));
        
        dadosProcessados.forEach(item => {
          // Normalizar os campos para evitar diferenças sutis
          const bancoNormalizado = (item.banco || '').trim().toUpperCase();
          const agenciaNormalizada = (item.agencia || '').toString().trim();
          const contaNormalizada = (item.numero || '').toString().trim();
          const dataNormalizada = item.data_geracao ? new Date(item.data_geracao).toISOString().split('T')[0] : '';
          const saldoNormalizado = typeof item.saldo === 'number' ? item.saldo.toFixed(2) : item.saldo;
          
          const chaveUnica = `${bancoNormalizado}|${agenciaNormalizada}|${contaNormalizada}|${dataNormalizada}|${saldoNormalizado}`;
          
          if (!chavesUnicas.has(chaveUnica)) {
            chavesUnicas.add(chaveUnica);
            dadosUnicos.push(item);
          } else {
            duplicatasRemovidas++;
            console.log('Duplicata removida:', {
              banco: item.banco,
              agencia: item.agencia,
              conta: item.numero,
              data: item.data_geracao,
              saldo: item.saldo,
              chaveUnica: chaveUnica
            });
          }
        });
        
        console.log('Dados após remoção de duplicatas:', dadosUnicos.length, 'registros únicos');
        console.log('Duplicatas removidas:', duplicatasRemovidas);
        
        // Debug: mostrar algumas datas para verificar
        const datasUnicas = [...new Set(dadosUnicos.map(item => {
          const data = new Date(item.data_geracao);
          return `${data.getDate()}/${data.getMonth() + 1}/${data.getFullYear()}`;
        }))].sort();
        console.log('Datas disponíveis:', datasUnicas);
        
        // Debug específico para BRADESCO 11/08
        const bradesco1108 = dadosUnicos.filter(item => 
          item.banco && item.banco.toUpperCase().includes('BRADESCO') && 
          item.data_geracao && item.data_geracao.includes('2025-08-11')
        );
        console.log('BRADESCO 11/08 encontrados:', bradesco1108.length, 'registros');
        if (bradesco1108.length > 0) {
          console.log('Detalhes BRADESCO 11/08:', bradesco1108.map(item => ({
            banco: item.banco,
            agencia: item.agencia,
            conta: item.numero,
            data: item.data_geracao,
            saldo: item.saldo
          })));
        }
        
        setDadosOriginais(dadosUnicos);
        setDadosCarregados(true);
      } else {
        throw new Error(result.message || 'Erro ao buscar dados');
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setErro('Erro ao buscar dados do banco de dados.');
      setDadosOriginais([]);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados ao montar o componente
  useEffect(() => {
    buscarTodosDados();
  }, []);

  // Calcular estatísticas do dia específico
  const estatisticasDia = useMemo(() => {
    if (dadosOriginais.length === 0) {
      return {
        saldoTotal: 0,
        contasPositivas: 0,
        contasNegativas: 0
      };
    }

    // Filtrar apenas os dados do dia específico E banco selecionado
    const dadosDoDia = aplicarFiltroMensal(dadosOriginais, filtroMensal, filtroDia, filtroAno, filtroBanco);
    
    console.log('Dados do dia filtrados (com banco):', dadosDoDia); // Debug
    
    const saldoTotal = dadosDoDia.reduce((acc, conta) => acc + conta.saldo, 0);
    
    const contasPositivas = dadosDoDia.filter(conta => {
      // Se tem informação de operação, usar ela
      if (conta.operacao?.isPositive !== undefined && conta.operacao?.isPositive !== null) {
        console.log(`Conta ${conta.numero}: operacao.isPositive = ${conta.operacao.isPositive}`);
        return conta.operacao.isPositive === true;
      }
      // Senão, usar o valor do saldo
      const isPositive = conta.saldo > 0;
      console.log(`Conta ${conta.numero}: saldo = ${conta.saldo}, isPositive = ${isPositive}`);
      return isPositive;
    }).length;
    
    const contasNegativas = dadosDoDia.filter(conta => {
      // Se tem informação de operação, usar ela
      if (conta.operacao?.isPositive !== undefined && conta.operacao?.isPositive !== null) {
        return conta.operacao.isPositive === false;
      }
      // Senão, usar o valor do saldo
      return conta.saldo < 0;
    }).length;

    console.log('Estatísticas calculadas (com filtro de banco):', { 
      saldoTotal, 
      contasPositivas, 
      contasNegativas, 
      bancoFiltro: filtroBanco 
    });

    return {
      saldoTotal,
      contasPositivas,
      contasNegativas
    };
  }, [dadosOriginais, filtroMensal, filtroDia, filtroAno, filtroBanco]);

  // Aplicar filtros quando dados ou filtros mudarem
  useEffect(() => {
    if (dadosOriginais.length > 0) {
      const dadosFiltrados = aplicarFiltroMensal(dadosOriginais, filtroMensal, filtroDia, filtroAno, filtroBanco);
      setSaldosContas(dadosFiltrados);
    }
  }, [dadosOriginais, filtroMensal, filtroDia, filtroAno, filtroBanco]);



  const getVariacaoColor = (saldo) => {
    if (saldo > 0) return 'text-green-600';
    if (saldo < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Função para determinar a cor baseada na operação ou saldo
  const getSaldoColor = (conta) => {
    console.log(`getSaldoColor para conta ${conta.numero}:`, {
      operacao: conta.operacao,
      saldo: conta.saldo,
      operacaoIsPositive: conta.operacao?.isPositive
    });
    
    // Priorizar a informação da operação se disponível
    if (conta.operacao?.isPositive === true) {
      console.log(`Conta ${conta.numero}: usando operacao.isPositive=true -> verde`);
      return 'text-green-600';
    }
    if (conta.operacao?.isPositive === false) {
      console.log(`Conta ${conta.numero}: usando operacao.isPositive=false -> vermelho`);
      return 'text-red-600';
    }
    
    // Fallback para o valor do saldo
    if (conta.saldo > 0) {
      console.log(`Conta ${conta.numero}: usando saldo=${conta.saldo} > 0 -> verde`);
      return 'text-green-600';
    }
    if (conta.saldo < 0) {
      console.log(`Conta ${conta.numero}: usando saldo=${conta.saldo} < 0 -> vermelho`);
      return 'text-red-600';
    }
    console.log(`Conta ${conta.numero}: saldo=${conta.saldo} -> cinza`);
    return 'text-gray-600';
  };

  const getVariacaoIcon = (saldo) => {
    if (saldo > 0) return <TrendUp size={20} className="text-green-600" />;
    if (saldo < 0) return <TrendDown size={20} className="text-red-600" />;
    return null;
  };

  // Função para ordenar dados
  const handleOrdenar = (campo) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Função para obter ícone de ordenação
  const getIconeOrdenacao = (campo) => {
    if (ordenacao.campo !== campo) return null;
    return ordenacao.direcao === 'asc' ? 
      <CaretUp size={12} className="ml-1" /> : 
      <CaretDown size={12} className="ml-1" />;
  };

  // Dados ordenados
  const dadosOrdenados = useMemo(() => {
    if (!ordenacao.campo) return saldosContas;
    
    return [...saldosContas].sort((a, b) => {
      let valorA = a[ordenacao.campo];
      let valorB = b[ordenacao.campo];
      
      // Tratamento para valores monetários
      if (ordenacao.campo === 'saldo') {
        valorA = parseFloat(valorA) || 0;
        valorB = parseFloat(valorB) || 0;
      }
      
      // Tratamento para strings
      if (typeof valorA === 'string') {
        valorA = valorA.toLowerCase();
        valorB = valorB.toLowerCase();
      }
      
      if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
      if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
      return 0;
    });
  }, [saldosContas, ordenacao]);

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-barlow">
              Saldo Bancário
            </h1>
            <p className="text-gray-600 mt-2 font-barlow">
              Acompanhe o saldo das contas bancárias a partir dos arquivos .RET processados.
            </p>

          </div>

          {/* Filtros por Ano e Mês */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={18} className="text-[#000638]" />
              <h3 className="font-bold text-sm text-[#000638]">Filtro por Período (Data Geração)</h3>
            </div>
            
            {/* Filtro por Ano */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-[#000638]" />
                <h4 className="font-bold text-sm text-[#000638]">Ano</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Botões dos anos (últimos 5 anos) */}
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((ano) => (
                  <button
                    key={ano}
                    onClick={() => setFiltroAno(ano)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      filtroAno === ano
                        ? 'bg-[#000638] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {ano}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Botões dos Meses */}
              {['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'].map((mes) => (
                <button
                  key={mes}
                  onClick={() => handleFiltroMensalChange(mes)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    filtroMensal === mes
                      ? 'bg-[#000638] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  {mes}
                </button>
              ))}
            </div>

            {/* Informação do filtro ativo */}
            <div className="mt-3 text-xs text-gray-500">
              <span className="font-medium">Filtro ativo:</span> {filtroAno} - {filtroMensal} - Dia {filtroDia}
              {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
              <span className="ml-2">({saldosContas.length} registro{saldosContas.length !== 1 ? 's' : ''})</span>
            </div>

            {/* Filtro por Dia */}
            {(
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-[#000638]" />
                  <h4 className="font-bold text-sm text-[#000638]">Filtro por Dia - {filtroMensal}</h4>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {/* Botões dos dias */}
                  {Array.from({ length: obterDiasDoMes(filtroMensal) }, (_, i) => i + 1).map((dia) => (
                    <button
                      key={dia}
                      onClick={() => setFiltroDia(dia)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                        filtroDia === dia
                          ? 'bg-[#000638] text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      {dia}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filtro por Banco */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Bank size={16} className="text-[#000638]" />
                <h4 className="font-bold text-sm text-[#000638]">Filtro por Banco</h4>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {/* Botão TODOS */}
                <button
                  onClick={() => setFiltroBanco('TODOS')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    filtroBanco === 'TODOS'
                      ? 'bg-[#000638] text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  TODOS
                </button>
                
                {/* Botões dos bancos */}
                {obterBancosUnicos.map((banco) => (
                  <button
                    key={banco}
                    onClick={() => setFiltroBanco(banco)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      filtroBanco === banco
                        ? 'bg-[#000638] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {banco}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {erro && (
            <div className="mb-8 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center font-barlow">
              {erro}
            </div>
          )}

          {/* Cards de Estatísticas do Dia */}
          {dadosCarregados && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-w-7xl mx-auto">
              {/* Saldo Total do Dia */}
              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CurrencyDollar size={18} className="text-blue-600" />
                    <CardTitle className="text-sm font-bold text-blue-700">Saldo Total do Dia</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className={`text-lg font-extrabold mb-1 break-words ${getVariacaoColor(estatisticasDia.saldoTotal)}`}>
                    {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : 
                      formatCurrency(estatisticasDia.saldoTotal)
                    }
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {filtroAno} - {filtroMensal} - Dia {filtroDia}
                    {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                  </CardDescription>
                </CardContent>
              </Card>

              {/* Contas Positivas */}
              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Plus size={18} className="text-green-600" />
                    <CardTitle className="text-sm font-bold text-green-700">Contas Positivas</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-2xl font-extrabold text-green-600 mb-1">
                    {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                      estatisticasDia.contasPositivas
                    }
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {filtroAno} - {filtroMensal} - Dia {filtroDia}
                    {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                  </CardDescription>
                </CardContent>
              </Card>

              {/* Contas Negativas */}
              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Minus size={18} className="text-red-600" />
                    <CardTitle className="text-sm font-bold text-red-700">Contas Negativas</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-2xl font-extrabold text-red-600 mb-1">
                    {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : 
                      estatisticasDia.contasNegativas
                    }
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {filtroAno} - {filtroMensal} - Dia {filtroDia}
                    {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabela de Saldos */}
          {dadosCarregados && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
                Saldos por Conta
              </h2>
              
              <div className="overflow-x-auto">
                                 <table className="w-full">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th 
                         className="text-left py-3 px-4 font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('banco')}
                       >
                         <div className="flex items-center">
                           Banco
                           {getIconeOrdenacao('banco')}
                         </div>
                       </th>
                       <th 
                         className="text-left py-3 px-4 font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('numero')}
                       >
                         <div className="flex items-center">
                           Conta
                           {getIconeOrdenacao('numero')}
                         </div>
                       </th>
                       <th 
                         className="text-center py-3 px-4 font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('agencia')}
                       >
                         <div className="flex items-center justify-center">
                           Agência
                           {getIconeOrdenacao('agencia')}
                         </div>
                       </th>
                       <th 
                         className="text-center py-3 px-4 font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('data_geracao')}
                       >
                         <div className="flex items-center justify-center">
                           Data
                           {getIconeOrdenacao('data_geracao')}
                         </div>
                       </th>
                       <th 
                         className="text-right py-3 px-4 font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('saldo')}
                       >
                         <div className="flex items-center justify-end">
                           Saldo
                           {getIconeOrdenacao('saldo')}
                         </div>
                       </th>
                       <th className="text-center py-3 px-4 font-semibold text-gray-900 font-barlow">
                         Status
                       </th>
                     </tr>
                   </thead>
                                     <tbody>
                     {dadosOrdenados.map((conta) => (
                       <tr key={conta.numero} className="border-b border-gray-100 hover:bg-gray-50">
                         <td className="py-3 px-4 font-medium text-gray-900 font-barlow">
                           {conta.banco || 'N/A'}
                         </td>
                         <td className="py-3 px-4 text-gray-600 font-barlow">
                           {formatConta(conta.numero)}
                         </td>
                         <td className="py-3 px-4 text-center text-gray-600 font-barlow">
                           {conta.agencia || 'N/A'}
                         </td>
                         <td className="py-3 px-4 text-center text-gray-600 font-barlow">
                           {conta.data_geracao ? new Date(conta.data_geracao).toLocaleDateString('pt-BR') : 'N/A'}
                         </td>
                         <td className="py-3 px-4 text-right">
                           <div className="flex items-center justify-end gap-2">
                             <span className={`font-semibold text-lg ${getSaldoColor(conta)} font-barlow`}>
                               {formatCurrency(conta.saldo)}
                             </span>
                             {getVariacaoIcon(conta.saldo)}
                           </div>
                         </td>
                         <td className="py-3 px-4 text-center">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                             conta.operacao?.isPositive === true
                               ? 'bg-green-100 text-green-800' 
                               : conta.operacao?.isPositive === false
                               ? 'bg-red-100 text-red-800'
                               : conta.saldo > 0 
                               ? 'bg-green-100 text-green-800' 
                               : conta.saldo < 0
                               ? 'bg-red-100 text-red-800'
                               : 'bg-gray-100 text-gray-800'
                           } font-barlow`}>
                             {conta.operacao?.isPositive === true ? 'Positivo' : 
                              conta.operacao?.isPositive === false ? 'Negativo' :
                              conta.saldo > 0 ? 'Positivo' : 
                              conta.saldo < 0 ? 'Negativo' : 'Zerado'}
                           </span>
                         </td>
                       </tr>
                     ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Estado inicial */}
          {!dadosCarregados && !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Bank size={64} className="text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2 font-barlow">
                Nenhum saldo carregado
              </h3>
              <p className="text-gray-600 font-barlow">
                Os dados são carregados automaticamente da tabela retorno_bancario. Use os filtros acima para filtrar por período.
              </p>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-blue-700 font-barlow">
                  <strong>Dica:</strong> Os dados são extraídos dos arquivos .RET processados e armazenados no Supabase.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SaldoBancario;
