import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../components/AuthContext';
import { buscarSaldosPorConta, buscarLimiteChequeEspecial, salvarLimiteChequeEspecial, salvarSaldoManual, removerSaldoManual, forcarRemocaoSaldoManual } from '../lib/retornoBancario';
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

// Função para criar Date object sem problemas de fuso horário
const criarDataSemFusoHorario = (dataString) => {
  if (!dataString) return null;
  if (dataString.includes('T')) {
    // Para datas ISO, usar apenas a parte da data
    const dataPart = dataString.split('T')[0];
    const [ano, mes, dia] = dataPart.split('-');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }
  // Para datas já no formato DD/MM/YYYY
  if (dataString.includes('/')) {
    const [dia, mes, ano] = dataString.split('/');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }
  return new Date(dataString);
};

// Função para formatar data
const formatarData = (data) => {
  if (!data) return '';
  if (data.includes('T')) {
    // Para datas ISO, criar a data considerando apenas a parte da data (YYYY-MM-DD)
    const dataPart = data.split('T')[0];
    const [ano, mes, dia] = dataPart.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return data;
};

const SaldoBancario = () => {
  // Hook de autenticação
  const { user } = useAuth();
  
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
  
  // Estado para controlar o tipo de visualização
  const [tipoVisualizacao, setTipoVisualizacao] = useState('atual'); // 'historico' ou 'atual'
  
  // Estados para limite de cheque especial
  const [limitesChequeEspecial, setLimitesChequeEspecial] = useState({});
  const [valorLimiteInput, setValorLimiteInput] = useState('');
  const [bancoEditando, setBancoEditando] = useState(null);
  const [salvandoLimite, setSalvandoLimite] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [acaoConfirmacao, setAcaoConfirmacao] = useState(null); // 'criar' ou 'atualizar'
  
  // Estados para adicionar saldo manualmente
  const [showAddSaldoModal, setShowAddSaldoModal] = useState(false);
  const [novoSaldo, setNovoSaldo] = useState({
    banco: '',
    agencia: '',
    conta: '',
    saldo: '',
    chqEspecial: ''
  });
  const [salvandoSaldo, setSalvandoSaldo] = useState(false);
  
  // Estados para modal de detalhes e exclusão
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [saldoSelecionado, setSaldoSelecionado] = useState(null);
  const [showConfirmExclusaoModal, setShowConfirmExclusaoModal] = useState(false);
  const [excluindoSaldo, setExcluindoSaldo] = useState(false);

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

  // Função para carregar limites de cheque especial
  const carregarLimitesChequeEspecial = async () => {
    try {
      const bancos = obterBancosUnicos;
      const novosLimites = {};
      
      console.log('🔄 Carregando limites para bancos:', bancos);
      
      for (const banco of bancos) {
        console.log(`🔍 Buscando limite para banco: ${banco}`);
        const resultado = await buscarLimiteChequeEspecial(banco);
        console.log(`📊 Resultado para ${banco}:`, resultado);
        
        if (resultado.success && resultado.data) {
          novosLimites[banco] = resultado.data;
          console.log(`✅ Limite carregado para ${banco}: ${resultado.data}`);
        } else {
          console.log(`❌ Nenhum limite encontrado para ${banco}`);
        }
      }
      
      console.log('📋 Limites carregados:', novosLimites);
      setLimitesChequeEspecial(novosLimites);
    } catch (error) {
      console.error('Erro ao carregar limites de cheque especial:', error);
    }
  };

  // Função para iniciar edição de limite
  const iniciarEdicaoLimite = (banco, conta, valorAtual = '') => {
    const chaveUnica = `${banco}_${conta}`;
    setBancoEditando(chaveUnica);
    setValorLimiteInput(valorAtual.toString());
  };

  // Função para cancelar edição de limite
  const cancelarEdicaoLimite = () => {
    setBancoEditando(null);
    setValorLimiteInput('');
  };

  // Função para lidar com tecla Enter
  const handleKeyPress = (e, banco, conta, valorAtual) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const valor = parseFloat(valorLimiteInput);
      if (!valor || isNaN(valor)) {
        alert('Por favor, insira um valor válido.');
        return;
      }
      
      const isUpdate = valorAtual && valorAtual > 0;
      setAcaoConfirmacao(isUpdate ? 'atualizar' : 'criar');
      setShowConfirmModal(true);
    }
  };

  // Função para confirmar ação
  const confirmarAcao = async () => {
    if (!bancoEditando) return;
    
    // Extrair o nome do banco da chave única
    const bancoNome = bancoEditando.split('_')[0];
    
    setSalvandoLimite(true);
    try {
      const valor = parseFloat(valorLimiteInput);
      const resultado = await salvarLimiteChequeEspecial(bancoNome, valor);
      
      if (resultado.success) {
        setLimitesChequeEspecial(prev => ({
          ...prev,
          [bancoNome]: valor
        }));
        cancelarEdicaoLimite();
        setShowConfirmModal(false);
        console.log('✅ Limite salvo com sucesso:', resultado.message);
        
        // Recarregar limites para garantir sincronização
        setTimeout(() => {
          carregarLimitesChequeEspecial();
        }, 500);
      } else {
        alert('Erro ao salvar limite: ' + resultado.message);
      }
    } catch (error) {
      console.error('Erro ao salvar limite:', error);
      alert('Erro ao salvar limite. Tente novamente.');
    } finally {
      setSalvandoLimite(false);
    }
  };

  // Função para cancelar confirmação
  const cancelarConfirmacao = () => {
    setShowConfirmModal(false);
    setAcaoConfirmacao(null);
  };

  // Função para abrir modal de adicionar saldo
  const abrirModalAddSaldo = () => {
    setNovoSaldo({
      banco: '',
      agencia: '',
      conta: '',
      saldo: '',
      chqEspecial: ''
    });
    setShowAddSaldoModal(true);
  };

  // Função para fechar modal de adicionar saldo
  const fecharModalAddSaldo = () => {
    setShowAddSaldoModal(false);
    setNovoSaldo({
      banco: '',
      agencia: '',
      conta: '',
      saldo: '',
      chqEspecial: ''
    });
  };

  // Funções para modal de detalhes e exclusão
  const abrirModalDetalhes = (saldo) => {
    setSaldoSelecionado(saldo);
    setShowDetalhesModal(true);
  };

  const fecharModalDetalhes = () => {
    setShowDetalhesModal(false);
    setSaldoSelecionado(null);
  };

  const confirmarExclusao = () => {
    setShowConfirmExclusaoModal(true);
  };

  const cancelarExclusao = () => {
    setShowConfirmExclusaoModal(false);
    setSaldoSelecionado(null);
  };

  const excluirSaldo = async () => {
    if (!saldoSelecionado) {
      console.error('Nenhum saldo selecionado para exclusão');
      return;
    }

    console.log('Tentando excluir saldo:', saldoSelecionado);
    console.log('ID do saldo:', saldoSelecionado.id);
    console.log('Nome do arquivo:', saldoSelecionado.nome_arquivo);

    setExcluindoSaldo(true);
    try {
      // Primeiro tentar a remoção normal
      let resultado = await removerSaldoManual(saldoSelecionado.id);
      console.log('Resultado da exclusão normal:', resultado);
      
      // Se falhar, tentar a remoção forçada
      if (!resultado.success) {
        console.log('Tentando remoção forçada...');
        resultado = await forcarRemocaoSaldoManual(saldoSelecionado.id);
        console.log('Resultado da exclusão forçada:', resultado);
      }
      
      if (resultado.success) {
        console.log('Saldo excluído com sucesso, recarregando dados...');
        // Recarregar dados
        await buscarTodosDados();
        setShowConfirmExclusaoModal(false);
        setShowDetalhesModal(false);
        setSaldoSelecionado(null);
        alert('Saldo excluído com sucesso!');
      } else {
        console.error('Erro na exclusão:', resultado.message);
        alert('Erro ao excluir saldo: ' + resultado.message);
      }
    } catch (error) {
      console.error('Erro ao excluir saldo:', error);
      alert('Erro ao excluir saldo: ' + error.message);
    } finally {
      setExcluindoSaldo(false);
    }
  };

  // Função para salvar novo saldo
  const salvarNovoSaldo = async () => {
    // Validações
    if (!novoSaldo.banco || !novoSaldo.agencia || !novoSaldo.conta || !novoSaldo.saldo) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const saldo = parseFloat(novoSaldo.saldo);
    if (isNaN(saldo)) {
      alert('Por favor, insira um valor válido para o saldo.');
      return;
    }

    // Verificar se já existe uma conta com os mesmos dados
    const contaExistente = dadosOriginais.find(conta => 
      conta.banco_nome === novoSaldo.banco && 
      conta.agencia === novoSaldo.agencia && 
      conta.conta === novoSaldo.conta
    );

    if (contaExistente) {
      alert('Já existe uma conta com este banco, agência e número. Não é possível adicionar duplicatas.');
      return;
    }

    setSalvandoSaldo(true);
    try {
      // Determinar se o saldo é positivo ou negativo
      const isPositive = saldo >= 0;
      
      // Preparar dados para inserção
      const dadosParaInserir = {
        nome_arquivo: 'saldo_manual',
        data_upload: new Date().toISOString(),
        valor: saldo,
        banco_nome: novoSaldo.banco,
        banco_codigo: '000', // Código padrão para saldos manuais
        banco_layout: 'manual', // Layout padrão para saldos manuais
        agencia: novoSaldo.agencia,
        conta: novoSaldo.conta,
        saldo_formatado: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(saldo),
        data_processamento: new Date().toISOString(),
        data_geracao: new Date().toISOString(),
        operacao_tipo: 'saldo_manual',
        operacao_descricao: `Saldo inserido manualmente por ${user?.name || 'Usuário'}`,
        operacao_sinal: isPositive ? '+' : '-',
        operacao_is_positive: isPositive,
        operacao_valor_absoluto: Math.abs(saldo),
        chq_especial: novoSaldo.chqEspecial ? parseFloat(novoSaldo.chqEspecial) : null,
        usuario_inseriu: user?.name || 'Usuário',
        created_at: new Date().toISOString()
      };

      // Salvar no Supabase
      const resultado = await salvarSaldoManual(dadosParaInserir);
      
      if (resultado.success) {
        alert('Saldo adicionado com sucesso!');
        fecharModalAddSaldo();
        
        // Recarregar dados
        buscarTodosDados();
        
        // Recarregar limites de cheque especial se foi definido
        if (novoSaldo.chqEspecial) {
          setTimeout(() => {
            carregarLimitesChequeEspecial();
          }, 500);
        }
      } else {
        alert('Erro ao salvar saldo: ' + resultado.message);
      }
    } catch (error) {
      console.error('Erro ao salvar novo saldo:', error);
      alert('Erro ao salvar saldo. Tente novamente.');
    } finally {
      setSalvandoSaldo(false);
    }
  };



  // Função para obter bancos únicos dos dados
  const obterBancosUnicos = useMemo(() => {
    if (dadosOriginais.length === 0) return [];
    
    const bancos = [...new Set(dadosOriginais.map(item => item.banco))].filter(Boolean).sort();
    console.log('Bancos únicos encontrados:', bancos);
    return bancos;
  }, [dadosOriginais]);

  // Função para obter saldos mais recentes de cada banco + agência + conta
  const obterSaldosAtuais = useMemo(() => {
    if (dadosOriginais.length === 0) return [];
    
    const saldosPorConta = {};
    
    dadosOriginais.forEach(item => {
      const banco = item.banco;
      const agencia = item.agencia;
      const conta = item.numero;
      
      if (!banco || !agencia || !conta) return;
      
      const dataGeracao = criarDataSemFusoHorario(item.data_geracao);
      if (!dataGeracao) return;
      
      // Criar chave única para banco + agência + conta
      const chaveConta = `${banco}|${agencia}|${conta}`;
      
      // Se não temos dados para esta conta ou se a data é mais recente
      if (!saldosPorConta[chaveConta] || dataGeracao > saldosPorConta[chaveConta].dataGeracao) {
        saldosPorConta[chaveConta] = {
          ...item,
          dataGeracao: dataGeracao,
          chaveConta: chaveConta
        };
      }
    });
    
    let saldosAtuais = Object.values(saldosPorConta);
    
    // Aplicar filtro de banco se especificado
    if (filtroBanco && filtroBanco !== 'TODOS') {
      saldosAtuais = saldosAtuais.filter(item => {
        const bancoItem = (item.banco || '').toUpperCase();
        const bancoFiltroUpper = filtroBanco.toUpperCase();
        
        // Verificar se o banco do item contém o filtro (para casos como "ITAU" vs "BANCO ITAU")
        const match = bancoItem.includes(bancoFiltroUpper) || bancoFiltroUpper.includes(bancoItem);
        return match;
      });
    }
    
    // Ordenar por banco, depois agência, depois conta
    saldosAtuais.sort((a, b) => {
      const comparacaoBanco = (a.banco || '').localeCompare(b.banco || '');
      if (comparacaoBanco !== 0) return comparacaoBanco;
      
      const comparacaoAgencia = (a.agencia || '').localeCompare(b.agencia || '');
      if (comparacaoAgencia !== 0) return comparacaoAgencia;
      
      return (a.numero || '').localeCompare(b.numero || '');
    });
    
    console.log('Saldos atuais por conta (banco + agência + conta):', saldosAtuais.length, 'registros');
    return saldosAtuais;
  }, [dadosOriginais, filtroBanco]);



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
      
      const data = criarDataSemFusoHorario(dataGeracao);
      if (!data) return false;
      
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
        const data = criarDataSemFusoHorario(item.data_geracao);
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
        console.log('📊 Dados brutos recebidos:', result.data);
        
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
              ultimaAtualizacao: criarDataSemFusoHorario(registro.data_geracao),
              operacao: {
                tipo: registro.operacao_tipo,
                descricao: registro.operacao_descricao,
                sinal: registro.operacao_sinal,
                isPositive: registro.operacao_is_positive,
                valorAbsoluto: registro.operacao_valor_absoluto
              },
              registros: [registro], // Manter apenas este registro
              totalRegistros: 1,
              data_geracao: registro.data_geracao, // Usar a data_geracao do registro específico
              // Preservar todos os campos do registro original
              id: registro.id,
              nome_arquivo: registro.nome_arquivo,
              usuario_inseriu: registro.usuario_inseriu
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
        dadosProcessados.sort((a, b) => {
          const dataA = criarDataSemFusoHorario(a.data_geracao);
          const dataB = criarDataSemFusoHorario(b.data_geracao);
          return dataA - dataB;
        });
        
        dadosProcessados.forEach(item => {
          // Normalizar os campos para evitar diferenças sutis
          const bancoNormalizado = (item.banco || '').trim().toUpperCase();
          const agenciaNormalizada = (item.agencia || '').toString().trim();
          const contaNormalizada = (item.numero || '').toString().trim();
          const dataNormalizada = item.data_geracao ? criarDataSemFusoHorario(item.data_geracao).toISOString().split('T')[0] : '';
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
          const data = criarDataSemFusoHorario(item.data_geracao);
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

  // Carregar limites de cheque especial quando a página é carregada
  useEffect(() => {
    const carregarLimitesInicial = async () => {
      if (obterBancosUnicos.length > 0) {
        console.log('🔄 Carregamento inicial de limites...');
        await carregarLimitesChequeEspecial();
      }
    };
    
    carregarLimitesInicial();
  }, [obterBancosUnicos]);

  // Carregar limites de cheque especial quando os dados são carregados
  useEffect(() => {
    if (dadosOriginais.length > 0 && obterBancosUnicos.length > 0) {
      console.log('🚀 Carregando limites de cheque especial...');
      carregarLimitesChequeEspecial();
    }
  }, [dadosOriginais, obterBancosUnicos]);

  // Calcular estatísticas baseado no tipo de visualização
  const estatisticasDia = useMemo(() => {
    if (dadosOriginais.length === 0) {
      return {
        saldoTotal: 0,
        contasPositivas: 0,
        contasNegativas: 0
      };
    }

    let dadosParaCalcular = [];
    
    if (tipoVisualizacao === 'atual') {
      // Para saldo atual, usar os dados mais recentes de cada banco
      dadosParaCalcular = obterSaldosAtuais;
    } else {
      // Para histórico, filtrar apenas os dados do dia específico E banco selecionado
      dadosParaCalcular = aplicarFiltroMensal(dadosOriginais, filtroMensal, filtroDia, filtroAno, filtroBanco);
    }
    
    console.log('Dados para cálculo de estatísticas:', dadosParaCalcular.length, 'registros'); // Debug
    
    const saldoTotal = dadosParaCalcular.reduce((acc, conta) => acc + conta.saldo, 0);
    
    const contasPositivas = dadosParaCalcular.filter(conta => {
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
    
    const contasNegativas = dadosParaCalcular.filter(conta => {
      // Se tem informação de operação, usar ela
      if (conta.operacao?.isPositive !== undefined && conta.operacao?.isPositive !== null) {
        return conta.operacao.isPositive === false;
      }
      // Senão, usar o valor do saldo
      return conta.saldo < 0;
    }).length;

    console.log('Estatísticas calculadas:', { 
      saldoTotal, 
      contasPositivas, 
      contasNegativas, 
      tipoVisualizacao,
      bancoFiltro: filtroBanco 
    });

    return {
      saldoTotal,
      contasPositivas,
      contasNegativas
    };
  }, [dadosOriginais, filtroMensal, filtroDia, filtroAno, filtroBanco, tipoVisualizacao, obterSaldosAtuais]);

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

  // Dados ordenados baseado no tipo de visualização
  const dadosOrdenados = useMemo(() => {
    const dadosParaOrdenar = tipoVisualizacao === 'atual' ? obterSaldosAtuais : saldosContas;
    
    if (!ordenacao.campo) return dadosParaOrdenar;
    
    return [...dadosParaOrdenar].sort((a, b) => {
      let valorA = a[ordenacao.campo];
      let valorB = b[ordenacao.campo];
      
      // Tratamento para valores monetários
      if (ordenacao.campo === 'saldo') {
        valorA = parseFloat(valorA) || 0;
        valorB = parseFloat(valorB) || 0;
      }
      
      // Tratamento para datas
      if (ordenacao.campo === 'data_geracao') {
        valorA = criarDataSemFusoHorario(valorA);
        valorB = criarDataSemFusoHorario(valorB);
      }
      
      // Tratamento para strings
      if (typeof valorA === 'string' && ordenacao.campo !== 'data_geracao') {
        valorA = valorA.toLowerCase();
        valorB = valorB.toLowerCase();
      }
      
      if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
      if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
      return 0;
    });
  }, [saldosContas, obterSaldosAtuais, tipoVisualizacao, ordenacao]);

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

          {/* Botão de Alternância de Visualização */}
          <div className="mb-6 flex justify-center items-center gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
              <div className="flex">
                <button
                  onClick={() => setTipoVisualizacao('atual')}
                  className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                    tipoVisualizacao === 'atual'
                      ? 'bg-[#000638] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Saldo Atual
                </button>
                <button
                  onClick={() => setTipoVisualizacao('historico')}
                  className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                    tipoVisualizacao === 'historico'
                      ? 'bg-[#000638] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Histórico de Saldo
                </button>
              </div>
            </div>
            
            {/* Botão Adicionar Saldo */}
            <button
              onClick={abrirModalAddSaldo}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
              title="Adicionar novo saldo manualmente"
            >
              <span>➕</span>
              Adicionar Saldo
            </button>
          </div>

          {/* Filtros por Ano e Mês - apenas no modo Histórico */}
          {tipoVisualizacao === 'historico' && (
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
              <span className="font-medium">
                {tipoVisualizacao === 'atual' ? 'Visualização:' : 'Filtro ativo:'}
              </span> 
              {tipoVisualizacao === 'atual' ? (
                <>
                  Saldo Atual por Conta
                  {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                  <span className="ml-2">({dadosOrdenados.length} conta{dadosOrdenados.length !== 1 ? 's' : ''})</span>
                </>
              ) : (
                <>
                  {filtroAno} - {filtroMensal} - Dia {filtroDia}
                  {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                  <span className="ml-2">({saldosContas.length} registro{saldosContas.length !== 1 ? 's' : ''})</span>
                </>
              )}
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

            </div>
          )}

          {/* Filtro por Banco - disponível em ambos os modos */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Bank size={18} className="text-[#000638]" />
              <h3 className="font-bold text-sm text-[#000638]">Filtro por Banco</h3>
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
                    <CardTitle className="text-sm font-bold text-blue-700">
                      {tipoVisualizacao === 'atual' ? 'Saldo Total Atual' : 'Saldo Total do Dia'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className={`text-lg font-extrabold mb-1 break-words ${getVariacaoColor(estatisticasDia.saldoTotal)}`}>
                    {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : 
                      formatCurrency(estatisticasDia.saldoTotal)
                    }
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {tipoVisualizacao === 'atual' ? (
                      <>
                        Saldo Atual por Conta
                        {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                      </>
                    ) : (
                      <>
                        {filtroAno} - {filtroMensal} - Dia {filtroDia}
                        {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                      </>
                    )}
                  </CardDescription>
                </CardContent>
              </Card>

              {/* Contas Positivas */}
              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Plus size={18} className="text-green-600" />
                    <CardTitle className="text-sm font-bold text-green-700">
                      {tipoVisualizacao === 'atual' ? 'Contas Positivas' : 'Contas Positivas'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-2xl font-extrabold text-green-600 mb-1">
                    {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : 
                      estatisticasDia.contasPositivas
                    }
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {tipoVisualizacao === 'atual' ? (
                      <>
                        Saldo Atual por Conta
                        {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                      </>
                    ) : (
                      <>
                        {filtroAno} - {filtroMensal} - Dia {filtroDia}
                        {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                      </>
                    )}
                  </CardDescription>
                </CardContent>
              </Card>

              {/* Contas Negativas */}
              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Minus size={18} className="text-red-600" />
                    <CardTitle className="text-sm font-bold text-red-700">
                      {tipoVisualizacao === 'atual' ? 'Contas Negativas' : 'Contas Negativas'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-2xl font-extrabold text-red-600 mb-1">
                    {loading ? <Spinner size={24} className="animate-spin text-red-600" /> : 
                      estatisticasDia.contasNegativas
                    }
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {tipoVisualizacao === 'atual' ? (
                      <>
                        Saldo Atual por Conta
                        {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                      </>
                    ) : (
                      <>
                        {filtroAno} - {filtroMensal} - Dia {filtroDia}
                        {filtroBanco !== 'TODOS' && ` - ${filtroBanco}`}
                      </>
                    )}
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabela de Saldos */}
          {dadosCarregados && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 font-barlow">
                {tipoVisualizacao === 'atual' ? 'Saldos Atuais por Conta' : 'Saldos por Conta'}
              </h2>
              
              <div className="overflow-x-auto">
                                 <table className="w-full">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th 
                         className="text-left py-2 px-2 text-xs font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('banco')}
                       >
                         <div className="flex items-center">
                           Banco
                           {getIconeOrdenacao('banco')}
                         </div>
                       </th>
                       <th 
                         className="text-left py-2 px-2 text-xs font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('numero')}
                       >
                         <div className="flex items-center">
                           Conta
                           {getIconeOrdenacao('numero')}
                         </div>
                       </th>
                       <th 
                         className="text-center py-2 px-2 text-xs font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('agencia')}
                       >
                         <div className="flex items-center justify-center">
                           Agência
                           {getIconeOrdenacao('agencia')}
                         </div>
                       </th>
                       <th 
                         className="text-center py-2 px-2 text-xs font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('data_geracao')}
                       >
                         <div className="flex items-center justify-center">
                           Data
                           {getIconeOrdenacao('data_geracao')}
                         </div>
                       </th>
                       <th 
                         className="text-right py-2 px-2 text-xs font-semibold text-gray-900 font-barlow cursor-pointer hover:bg-gray-50 transition-colors"
                         onClick={() => handleOrdenar('saldo')}
                       >
                         <div className="flex items-center justify-end">
                           Saldo
                           {getIconeOrdenacao('saldo')}
                         </div>
                       </th>
                       <th className="text-center py-2 px-2 text-xs font-semibold text-gray-900 font-barlow">
                         Limite CHQ
                       </th>
                       <th className="text-center py-2 px-2 text-xs font-semibold text-gray-900 font-barlow">
                         Status
                       </th>
                       <th className="text-center py-2 px-2 text-xs font-semibold text-gray-900 font-barlow">
                         Tipo
                       </th>
                       <th className="text-center py-2 px-2 text-xs font-semibold text-gray-900 font-barlow">
                         Ações
                       </th>
                     </tr>
                   </thead>
                                     <tbody>
                     {dadosOrdenados.map((conta) => {
                       // Verificar se é um saldo manual
                       const isSaldoManual = conta.registros && conta.registros.some(reg => reg.nome_arquivo === 'saldo_manual');
                       const registroManual = conta.registros?.find(reg => reg.nome_arquivo === 'saldo_manual');
                       
                       // Debug: verificar se o campo nome_arquivo existe
                       if (conta.registros && conta.registros.length > 0) {
                         const primeiroRegistro = conta.registros[0];
                         if (!primeiroRegistro.hasOwnProperty('nome_arquivo')) {
                           console.error('❌ Campo nome_arquivo não encontrado no registro:', primeiroRegistro);
                         }
                       }
                       
                       // Debug: log para verificar se está encontrando saldos manuais
                       if (isSaldoManual && registroManual) {
                         console.log('💰 Saldo manual encontrado:', {
                           conta: conta.numero,
                           banco: conta.banco,
                           id: registroManual.id,
                           nome_arquivo: registroManual.nome_arquivo
                         });
                       }
                       
                       // Debug: verificar estrutura dos registros
                       if (conta.registros && conta.registros.length > 0) {
                         console.log('📋 Registros da conta:', conta.numero, conta.registros.map(reg => ({
                           id: reg.id,
                           nome_arquivo: reg.nome_arquivo,
                           valor: reg.valor
                         })));
                       }
                       
                       return (
                         <tr 
                           key={conta.numero} 
                           className={`border-b border-gray-100 hover:bg-gray-50 ${isSaldoManual ? 'cursor-pointer bg-blue-50 hover:bg-blue-100' : ''}`}
                           onClick={isSaldoManual ? () => abrirModalDetalhes(registroManual) : undefined}
                         >
                         <td className="py-2 px-2 text-xs font-medium text-gray-900 font-barlow">
                           {conta.banco || 'N/A'}
                         </td>
                         <td className="py-2 px-2 text-xs text-gray-600 font-barlow">
                           {formatConta(conta.numero)}
                         </td>
                         <td className="py-2 px-2 text-xs text-center text-gray-600 font-barlow">
                           {conta.agencia || 'N/A'}
                         </td>
                         <td className="py-2 px-2 text-xs text-center text-gray-600 font-barlow">
                           {formatarData(conta.data_geracao) || 'N/A'}
                         </td>
                         <td className="py-2 px-2 text-right">
                           <div className="flex items-center justify-end gap-1">
                             <span className={`font-semibold text-sm ${getSaldoColor(conta)} font-barlow`}>
                               {formatCurrency(conta.saldo)}
                             </span>
                             {getVariacaoIcon(conta.saldo)}
                           </div>
                         </td>
                                                   <td className="py-2 px-2 text-center">
                            {bancoEditando === `${conta.banco}_${conta.numero}` ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={valorLimiteInput}
                                    onChange={(e) => setValorLimiteInput(e.target.value)}
                                    onKeyPress={(e) => handleKeyPress(e, conta.banco, conta.numero, limitesChequeEspecial[conta.banco])}
                                    className="w-24 px-2 py-1 text-xs border-2 border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-600 bg-white shadow-sm"
                                    placeholder="0,00"
                                    step="0.01"
                                    min="0"
                                    autoFocus
                                  />
                                  <div className="absolute -top-4 left-0 text-xs text-blue-600 font-medium">
                                    Valor
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={cancelarEdicaoLimite}
                                    className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <button
                                  onClick={() => iniciarEdicaoLimite(conta.banco, conta.numero, limitesChequeEspecial[conta.banco])}
                                  className="text-sm font-bold text-yellow-600 hover:text-yellow-700 hover:underline transition-all duration-200 cursor-pointer"
                                  title="Clique para editar o limite de cheque especial"
                                >
                                  {limitesChequeEspecial[conta.banco] ? formatCurrency(limitesChequeEspecial[conta.banco]) : 'R$ 0,00'}
                                </button>
                              </div>
                            )}
                          </td>
                         <td className="py-2 px-2 text-center">
                           <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
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
                         <td className="py-2 px-2 text-center">
                           <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                             isSaldoManual
                               ? 'bg-blue-100 text-blue-800'
                               : 'bg-green-100 text-green-800'
                           } font-barlow`}>
                             {isSaldoManual ? 'Manual' : '.RET'}
                           </span>
                         </td>
                         <td className="py-2 px-2 text-center">
                           {isSaldoManual && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setSaldoSelecionado(registroManual);
                                 confirmarExclusao();
                               }}
                               className="text-red-600 hover:text-red-800 text-base font-bold"
                               title="Excluir saldo manual"
                             >
                               ✕
                             </button>
                           )}
                         </td>
                       </tr>
                       );
                     })}
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
                Os dados são carregados automaticamente da tabela retorno_bancario. 
                {tipoVisualizacao === 'atual' 
                  ? ' Use o modo "Saldo Atual" para ver os saldos mais recentes de cada conta.' 
                  : ' Use os filtros acima para filtrar por período.'
                }
              </p>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-blue-700 font-barlow">
                  <strong>Dica:</strong> Os dados são extraídos dos arquivos .RET processados e armazenados no Supabase.
                </p>
              </div>
            </div>
          )}

          {/* Modal de Confirmação para Limite de Cheque Especial */}
          {showConfirmModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                    <span className="text-2xl">💰</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {acaoConfirmacao === 'criar' ? 'Definir Limite' : 'Atualizar Limite'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    {acaoConfirmacao === 'criar' 
                      ? `Deseja definir o limite de cheque especial para ${bancoEditando} como ${formatCurrency(parseFloat(valorLimiteInput))}?`
                      : `Deseja atualizar o limite de cheque especial para ${bancoEditando} para ${formatCurrency(parseFloat(valorLimiteInput))}?`
                    }
                  </p>
                  
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={cancelarConfirmacao}
                      disabled={salvandoLimite}
                      className="px-4 py-2 text-sm bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarAcao}
                      disabled={salvandoLimite}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {salvandoLimite ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <span>✓</span>
                          {acaoConfirmacao === 'criar' ? 'Definir' : 'Atualizar'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Detalhes do Saldo Manual */}
          {showDetalhesModal && saldoSelecionado && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Detalhes do Saldo Manual
                  </h3>
                  
                  <div className="text-left space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Banco:</span>
                      <span className="text-gray-900">{saldoSelecionado.banco_nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Agência:</span>
                      <span className="text-gray-900">{saldoSelecionado.agencia}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Conta:</span>
                      <span className="text-gray-900">{saldoSelecionado.conta}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Saldo:</span>
                      <span className="text-gray-900 font-bold">{formatCurrency(saldoSelecionado.valor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Inserido por:</span>
                      <span className="text-gray-900 font-medium">{saldoSelecionado.usuario_inseriu || saldoSelecionado.operacao_descricao?.replace('Saldo inserido manualmente por ', '') || 'Usuário'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Data de Inclusão:</span>
                      <span className="text-gray-900">{new Date(saldoSelecionado.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Hora de Inclusão:</span>
                      <span className="text-gray-900">{new Date(saldoSelecionado.created_at).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={fecharModalDetalhes}
                      className="px-4 py-2 text-sm bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      Fechar
                    </button>
                    <button
                      onClick={() => {
                        fecharModalDetalhes();
                        confirmarExclusao();
                      }}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Excluir Saldo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Confirmação de Exclusão */}
          {showConfirmExclusaoModal && saldoSelecionado && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform transition-all">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Confirmar Exclusão
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Tem certeza que deseja excluir o saldo manual de <strong>{saldoSelecionado.banco_nome}</strong> - 
                    Agência <strong>{saldoSelecionado.agencia}</strong> - Conta <strong>{saldoSelecionado.conta}</strong>?
                  </p>
                  
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={cancelarExclusao}
                      disabled={excluindoSaldo}
                      className="px-4 py-2 text-sm bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={excluirSaldo}
                      disabled={excluindoSaldo}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {excluindoSaldo ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Excluindo...
                        </>
                      ) : (
                        <>
                          <span>🗑️</span>
                          Excluir
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal para Adicionar Saldo */}
          {showAddSaldoModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
              <div className="bg-white rounded-xl shadow-2xl p-4 max-w-md w-full transform transition-all max-h-[90vh] overflow-y-auto">
                <div className="text-center mb-4">
                  <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 mb-3">
                    <span className="text-xl">🏦</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900">
                    Adicionar Novo Saldo
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Preencha os dados da conta bancária
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Banco */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Banco *
                    </label>
                    <select
                      value={novoSaldo.banco}
                      onChange={(e) => setNovoSaldo(prev => ({ ...prev, banco: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                      required
                    >
                      <option value="">Selecione um banco</option>
                      {obterBancosUnicos.map((banco) => (
                        <option key={banco} value={banco}>
                          {banco}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Agência */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Agência *
                    </label>
                    <input
                      type="text"
                      value={novoSaldo.agencia}
                      onChange={(e) => setNovoSaldo(prev => ({ ...prev, agencia: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                      placeholder="0000"
                      required
                    />
                  </div>

                  {/* Conta */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Número da Conta *
                    </label>
                    <input
                      type="text"
                      value={novoSaldo.conta}
                      onChange={(e) => setNovoSaldo(prev => ({ ...prev, conta: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                      placeholder="00000000"
                      required
                    />
                  </div>

                  {/* Saldo */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Saldo *
                    </label>
                    <input
                      type="number"
                      value={novoSaldo.saldo}
                      onChange={(e) => setNovoSaldo(prev => ({ ...prev, saldo: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                      placeholder="0,00"
                      step="0.01"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use valores negativos para saldos negativos
                    </p>
                  </div>

                  {/* Limite de Cheque Especial */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Limite de Cheque Especial
                    </label>
                    <input
                      type="number"
                      value={novoSaldo.chqEspecial}
                      onChange={(e) => setNovoSaldo(prev => ({ ...prev, chqEspecial: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                      placeholder="0,00 (opcional)"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-center mt-4">
                  <button
                    onClick={fecharModalAddSaldo}
                    disabled={salvandoSaldo}
                    className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarNovoSaldo}
                    disabled={salvandoSaldo}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {salvandoSaldo ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <span>✓</span>
                        Salvar Saldo
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SaldoBancario;
