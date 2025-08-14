import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { buscarSaldosPorConta } from '../lib/retornoBancario';

import { 
  Bank, 
  TrendUp, 
  TrendDown,
  Spinner,
  CaretUp,
  CaretDown,
  Calendar
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
  const [filtroMensal, setFiltroMensal] = useState(getMesAtual());
  const [filtroDia, setFiltroDia] = useState(getDiaInicial());
  
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

  // Função para formatar percentual
  const formatPercentage = (value) => {
    if (typeof value === 'number') {
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    }
    return '0%';
  };



  // Função para lidar com mudança de filtro mensal
  const handleFiltroMensalChange = (novoFiltro) => {
    setFiltroMensal(novoFiltro);
    
    // Se mudou para um mês diferente, ajustar o dia
    if (novoFiltro !== filtroMensal) {
      const diasNoNovoMes = obterDiasDoMes(novoFiltro);
      
      // Se o dia atual é maior que os dias no novo mês, usar o último dia
      if (filtroDia > diasNoNovoMes) {
        setFiltroDia(diasNoNovoMes);
      } else if (filtroDia === null) {
        // Se não havia dia selecionado, usar o dia atual (se válido) ou 1
        const diaAtual = new Date().getDate();
        setFiltroDia(Math.min(diaAtual, diasNoNovoMes));
      }
    }
  };

  // Função para aplicar filtro mensal e por dia
  const aplicarFiltroMensal = (dados, filtro, diaFiltro = null) => {
    return dados.filter((item) => {
      // Usar data_geracao como base para o filtro mensal
      const dataGeracao = item.data_geracao;
      if (!dataGeracao) return false;
      
      const data = new Date(dataGeracao);
      const ano = data.getFullYear();
      const mes = data.getMonth() + 1; // getMonth() retorna 0-11, então +1
      const dia = data.getDate();
      
      if (filtro === 'ANO') {
        // Mostrar dados do ano atual
        const anoAtual = new Date().getFullYear();
        return ano === anoAtual;
      }
      
      // Filtros por mês específico
      const mesesMap = {
        'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4,
        'MAI': 5, 'JUN': 6, 'JUL': 7, 'AGO': 8,
        'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12
      };
      
      const mesDoFiltro = mesesMap[filtro];
      if (mesDoFiltro) {
        // Se há filtro por dia, verificar também o dia
        if (diaFiltro !== null) {
          return mes === mesDoFiltro && dia === diaFiltro;
        }
        return mes === mesDoFiltro;
      }
      
      return true;
    });
  };

  // Função para buscar todos os dados da tabela retorno_bancario
  const buscarTodosDados = async () => {
    setLoading(true);
    setErro('');
    
    try {
      const result = await buscarSaldosPorConta({});
      
      if (result.success) {
        // Processar os dados para incluir data_geracao
        const dadosProcessados = result.data.map(conta => {
          // Pegar o registro mais recente para obter a data_geracao
          const registroMaisRecente = conta.registros.sort((a, b) => 
            new Date(b.data_geracao) - new Date(a.data_geracao)
          )[0];
          
          return {
            numero: conta.numero,
            nome: conta.nome,
            saldo: conta.saldo,
            banco: conta.banco,
            agencia: conta.agencia,
            ultimaAtualizacao: conta.ultimaAtualizacao,
            registros: conta.registros,
            totalRegistros: conta.registros.length,
            data_geracao: registroMaisRecente?.data_geracao || null
          };
        });
        
        setDadosOriginais(dadosProcessados);
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

  // Aplicar filtros quando dados ou filtros mudarem
  useEffect(() => {
    if (dadosOriginais.length > 0) {
      const dadosFiltrados = aplicarFiltroMensal(dadosOriginais, filtroMensal, filtroDia);
      setSaldosContas(dadosFiltrados);
    }
  }, [dadosOriginais, filtroMensal, filtroDia]);



  const getVariacaoColor = (saldo) => {
    if (saldo > 0) return 'text-green-600';
    if (saldo < 0) return 'text-red-600';
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

          {/* Filtros Mensais */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={18} className="text-[#000638]" />
              <h3 className="font-bold text-sm text-[#000638]">Filtro por Período (Data Geração)</h3>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Botão ANO */}
              <button
                onClick={() => handleFiltroMensalChange('ANO')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filtroMensal === 'ANO'
                    ? 'bg-[#000638] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                ANO
              </button>

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
              <span className="font-medium">Filtro ativo:</span> {filtroMensal} 
              {filtroDia && <span className="ml-1">- Dia {filtroDia}</span>}
              <span className="ml-2">({saldosContas.length} registro{saldosContas.length !== 1 ? 's' : ''})</span>
            </div>

            {/* Filtro por Dia - aparece apenas quando um mês está selecionado */}
            {filtroMensal !== 'ANO' && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-[#000638]" />
                  <h4 className="font-bold text-sm text-[#000638]">Filtro por Dia - {filtroMensal}</h4>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {/* Botão "Todos os Dias" */}
                  <button
                    onClick={() => setFiltroDia(null)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filtroDia === null
                        ? 'bg-[#000638] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    TODOS
                  </button>

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
          </div>

          {erro && (
            <div className="mb-8 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center font-barlow">
              {erro}
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
                           {conta.numero}
                         </td>
                         <td className="py-3 px-4 text-center text-gray-600 font-barlow">
                           {conta.agencia || 'N/A'}
                         </td>
                         <td className="py-3 px-4 text-center text-gray-600 font-barlow">
                           {conta.data_geracao ? new Date(conta.data_geracao).toLocaleDateString('pt-BR') : 'N/A'}
                         </td>
                         <td className="py-3 px-4 text-right">
                           <div className="flex items-center justify-end gap-2">
                             <span className={`font-semibold text-lg ${getVariacaoColor(conta.saldo)} font-barlow`}>
                               {formatCurrency(conta.saldo)}
                             </span>
                             {getVariacaoIcon(conta.saldo)}
                           </div>
                         </td>
                         <td className="py-3 px-4 text-center">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                             conta.saldo > 0 
                               ? 'bg-green-100 text-green-800' 
                               : conta.saldo < 0
                               ? 'bg-red-100 text-red-800'
                               : 'bg-gray-100 text-gray-800'
                           } font-barlow`}>
                             {conta.saldo > 0 ? 'Positivo' : conta.saldo < 0 ? 'Negativo' : 'Zerado'}
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
