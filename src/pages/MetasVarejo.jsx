import React, { useState, useEffect } from 'react';
import PageTitle from '../components/ui/PageTitle';
import FiltroLoja from '../components/FiltroLoja';
import FiltroVendedor from '../components/FiltroVendedor';
import { Target, TrendUp, Calendar } from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import useMetas from '../hooks/useMetas';
import { useAuth } from '../components/AuthContext';

const MetasVarejo = () => {
  const apiClient = useApiClient();
  const { salvarMetas, buscarMetas, buscarLogAlteracoes } = useMetas();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [dadosLojas, setDadosLojas] = useState([]);
  const [dadosVendedores, setDadosVendedores] = useState([]);
  const [vendedoresSelecionados, setVendedoresSelecionados] = useState([]);
  const [dadosVendedor, setDadosVendedor] = useState([]);
  const [lojasSelecionadas, setLojasSelecionadas] = useState([]);
  const [dadosLoja, setDadosLoja] = useState([]);
  const [tipoLoja, setTipoLoja] = useState('Todos');
  const [rankingTipo, setRankingTipo] = useState('lojas');
  const [ordenacao, setOrdenacao] = useState('faturamento'); // 'faturamento' ou 'nome'
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState('desc'); // 'desc' ou 'asc'
  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: ''
  });
  const [metaValores, setMetaValores] = useState({});
  const [editingMeta, setEditingMeta] = useState({ chave: null, campo: null });
  const [tempValue, setTempValue] = useState('');
  const [showAddMetasModal, setShowAddMetasModal] = useState(false);
  const [lojasSelecionadasMetas, setLojasSelecionadasMetas] = useState([]);
  const [vendedoresSelecionadosMetas, setVendedoresSelecionadosMetas] = useState([]);
  const [metasBulk, setMetasBulk] = useState({ bronze: '', prata: '', ouro: '', diamante: '' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logAlteracoesReal, setLogAlteracoesReal] = useState([]);
  const [salvandoMeta, setSalvandoMeta] = useState(null); // Para controlar qual meta está sendo salva
  const [viewMode, setViewMode] = useState('tabela'); // 'tabela' ou 'dashboard'
  const [dashboardStats, setDashboardStats] = useState({
    bronze: { lojas: 0, vendedores: 0 },
    prata: { lojas: 0, vendedores: 0 },
    ouro: { lojas: 0, vendedores: 0 },
    diamante: { lojas: 0, vendedores: 0 },
    lojaDetalhes: [],
    vendedorDetalhes: []
  });
  const [tabelaAtiva, setTabelaAtiva] = useState('lojas'); // 'lojas' ou 'vendedores'

  const formatBRL = (num) => {
    const n = Number(num);
    if (isNaN(n)) return 'R$ 0,00';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Limpa caracteres inválidos, permite números e separadores "," e "."
  const sanitizeInput = (value) => {
    return String(value ?? '').replace(/[^0-9,\.]/g, '');
  };

  // Converte string para número em reais ("R$ 1.234,56" -> 1234.56)
  const toNumber = (value) => {
    if (value === '' || value === null || value === undefined) return 0;
    
    // Remover R$ e espaços
    const withoutCurrency = String(value).replace(/R\$\s*/g, '');
    
    // Remover pontos de milhar e substituir vírgula por ponto
    const normalized = withoutCurrency.replace(/\./g, '').replace(',', '.');
    
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  };

  const iniciarEdicaoMeta = (chave) => {
    const atual = metaValores[chave] || '';
    // Converter "R$ 1.234,56" para "1234.56" no input
    const current = String(atual).replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(',', '.');
    setEditingMeta({ chave, campo: chave.split('-').pop() });
    setTempValue(current);
  };

  const cancelarEdicaoMeta = () => {
    setEditingMeta({ chave: null, campo: null });
    setTempValue('');
  };

  const confirmarEdicaoMeta = async () => {
    if (!editingMeta.chave) return;
    const numero = toNumber(tempValue); // já em reais
    const valorFormatado = formatBRL(numero);
    
    // Indicar que está salvando
    setSalvandoMeta(editingMeta.chave);
    
    // Atualizar estado local
    setMetaValores((prev) => ({ ...prev, [editingMeta.chave]: valorFormatado }));
    
    // Salvar no banco de dados
    await salvarMetaIndividual(editingMeta.chave, valorFormatado);
    
    // Finalizar salvamento
    setSalvandoMeta(null);
    cancelarEdicaoMeta();
  };

  const salvarMetaIndividual = async (chave, valor) => {
    try {
      // Parse da chave: "lojas-NOME-bronze" ou "vendedores-NOME-bronze"
      // Como o nome pode ter hífens, precisamos fazer o split de forma inteligente
      const partes = chave.split('-');
      const tipo = partes[0]; // 'lojas' ou 'vendedores'
      const campo = partes[partes.length - 1]; // 'bronze', 'prata', 'ouro', 'diamante' (sempre o último)
      const nome = partes.slice(1, -1).join('-'); // tudo entre o tipo e o campo
      
      const mesAtual = filtros.dt_inicio ? filtros.dt_inicio.substring(0, 7) : new Date().toISOString().substring(0, 7);
      
      // Preparar dados para salvar
      const metaData = [{
        tipo: tipo,
        nome: nome,
        metas: { [campo]: valor },
        mes: mesAtual,
        usuario: user?.name || 'Usuário Anônimo'
      }];
      
      // Salvar no banco
      const resultado = await salvarMetas(metaData);
      
      if (resultado.success) {
        // Recarregar log de alterações
        await carregarLogAlteracoes();
      } else {
        console.error('Erro ao salvar meta individual:', resultado.error);
        // Reverter mudança local em caso de erro
        setMetaValores((prev) => ({ ...prev, [chave]: metaValores[chave] }));
        alert('Erro ao salvar meta. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao salvar meta individual:', error);
      // Reverter mudança local em caso de erro
      setMetaValores((prev) => ({ ...prev, [chave]: metaValores[chave] }));
      
      // Mostrar mensagem mais amigável para o usuário
      if (error.message.includes('duplicate key value violates unique constraint')) {
        alert('Esta meta já existe para este período. A meta foi atualizada com sucesso!');
      } else {
        alert('Erro ao salvar meta. Tente novamente.');
      }
    } finally {
      // Sempre finalizar o estado de salvamento
      setSalvandoMeta(null);
    }
  };

  const abrirModalMetas = () => {
    setShowAddMetasModal(true);
  };

  const fecharModalMetas = () => {
    setShowAddMetasModal(false);
    setLojasSelecionadasMetas([]);
    setVendedoresSelecionadosMetas([]);
    setMetasBulk({ bronze: '', prata: '', ouro: '', diamante: '' });
    setShowConfirmModal(false);
  };

  const confirmarAplicarMetas = () => {
    setShowConfirmModal(true);
  };

  const aplicarMetasEmLote = async () => {
    // Converter valores informados
    const valoresFormatados = {};
    ['bronze','prata','ouro','diamante'].forEach((campo) => {
      if (metasBulk[campo] !== '') {
        const n = toNumber(metasBulk[campo]);
        valoresFormatados[campo] = formatBRL(n);
      }
    });

    if (Object.keys(valoresFormatados).length === 0) {
      setShowConfirmModal(false);
      fecharModalMetas();
      return;
    }

    // Preparar dados para salvar no banco
    const metasParaSalvar = [];
    const mesAtual = filtros.dt_inicio ? filtros.dt_inicio.substring(0, 7) : new Date().toISOString().substring(0, 7);

    if (rankingTipo === 'lojas') {
      if (lojasSelecionadasMetas.length === 0) {
        setShowConfirmModal(false);
        fecharModalMetas();
        return;
      }

      lojasSelecionadasMetas.forEach((loja) => {
        const nomeSel = (loja.nome_fantasia || loja.nm_loja || loja.nome || loja.loja || '').toUpperCase();
        metasParaSalvar.push({
          tipo: 'lojas',
          nome: nomeSel,
          metas: valoresFormatados,
          mes: mesAtual,
            usuario: user?.name || 'Usuário Anônimo'
        });
      });
    } else if (rankingTipo === 'vendedores') {
      if (vendedoresSelecionadosMetas.length === 0) {
        setShowConfirmModal(false);
        fecharModalMetas();
        return;
      }

      vendedoresSelecionadosMetas.forEach((vendedor) => {
        const nomeSel = (vendedor.nome_vendedor || vendedor.vendedor || vendedor.nm_vendedor || vendedor.nome || '').toUpperCase();
        metasParaSalvar.push({
          tipo: 'vendedores',
          nome: nomeSel,
          metas: valoresFormatados,
          mes: mesAtual,
            usuario: user?.name || 'Usuário Anônimo'
        });
      });
    }

    // Salvar no banco de dados
    if (metasParaSalvar.length > 0) {
      const resultado = await salvarMetas(metasParaSalvar);
      
      if (resultado.success) {
        // Atualizar estado local também
        setMetaValores((prev) => {
          const atualizados = { ...prev };
          metasParaSalvar.forEach(({ tipo, nome, metas }) => {
            Object.entries(metas).forEach(([k, v]) => {
              // Usar nome como identificador único
              const chave = `${tipo}-${nome}-${k}`;
              atualizados[chave] = v;
            });
          });
          return atualizados;
        });
        
        // Recarregar log de alterações
        await carregarLogAlteracoes();
      } else {
        console.error('Erro ao salvar metas:', resultado.error);
        alert('Erro ao salvar metas. Tente novamente.');
      }
    }

    setShowConfirmModal(false);
    fecharModalMetas();
  };

  const cancelarAplicarMetas = () => {
    setShowConfirmModal(false);
  };

  const carregarLogAlteracoes = async () => {
    const resultado = await buscarLogAlteracoes();
    if (resultado.success) {
      setLogAlteracoesReal(resultado.data);
    }
  };

  const abrirLogModal = async () => {
    await carregarLogAlteracoes();
    setShowLogModal(true);
  };

  const fecharLogModal = () => {
    setShowLogModal(false);
  };

  // Dados mocados para o log de alterações
  const logAlteracoes = [
    {
      id: 1,
      tipo: 'lojas',
      nome: 'CROSBY SHOPPING MIDWAY',
      campo: 'bronze',
      valorAnterior: 'R$ 0,00',
      valorNovo: 'R$ 50.000,00',
      usuario: 'João Silva',
      data: '2024-01-15 14:30:25'
    },
    {
      id: 2,
      tipo: 'vendedores',
      nome: 'MARIA SANTOS',
      campo: 'prata',
      valorAnterior: 'R$ 25.000,00',
      valorNovo: 'R$ 75.000,00',
      usuario: 'Ana Costa',
      data: '2024-01-14 09:15:42'
    },
    {
      id: 3,
      tipo: 'lojas',
      nome: 'CROSBY VILLA LOBOS',
      campo: 'ouro',
      valorAnterior: 'R$ 0,00',
      valorNovo: 'R$ 100.000,00',
      usuario: 'Pedro Oliveira',
      data: '2024-01-13 16:45:18'
    },
    {
      id: 4,
      tipo: 'vendedores',
      nome: 'CARLOS FERREIRA',
      campo: 'diamante',
      valorAnterior: 'R$ 150.000,00',
      valorNovo: 'R$ 200.000,00',
      usuario: 'João Silva',
      data: '2024-01-12 11:20:35'
    },
    {
      id: 5,
      tipo: 'lojas',
      nome: 'CROSBY IBIRAPUERA',
      campo: 'bronze',
      valorAnterior: 'R$ 30.000,00',
      valorNovo: 'R$ 60.000,00',
      usuario: 'Maria Santos',
      data: '2024-01-11 13:10:50'
    }
  ];

  const renderCellEditor = (cellKey, colorClass = 'text-amber-700') => {
    const isEditing = editingMeta.chave === cellKey;
    const isSaving = salvandoMeta === cellKey;
    
    if (isEditing) {
      return (
        <div className="flex flex-col items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            className="w-20 px-2 py-0.5 border border-blue-400 rounded text-[9px] text-center focus:outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50"
            value={tempValue}
            placeholder="0,00"
            onChange={(e) => setTempValue(sanitizeInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmarEdicaoMeta();
              }
            }}
            autoFocus
          />
          <button
            type="button"
            className="text-[8px] bg-gray-500 text-white px-2 py-0.5 rounded"
            onClick={cancelarEdicaoMeta}
          >
            Cancelar
          </button>
        </div>
      );
    }

    const exibicao = metaValores[cellKey] || 'R$ 0,00';
    return (
      <span
        className={`${colorClass} font-bold cursor-pointer select-none ${isSaving ? 'opacity-50' : ''}`}
        onClick={() => !isSaving && iniciarEdicaoMeta(cellKey)}
      >
        {isSaving ? 'Salvando...' : exibicao}
      </span>
    );
  };

  const handleMetaChange = (chave, _campo, valor) => {
    setMetaValores(prev => ({
      ...prev,
      [chave]: valor
    }));
  };

  useEffect(() => {
    // Componente inicializado
  }, []);
  
  // Recalcular estatísticas quando metas, dados ou filtros mudarem
  useEffect(() => {
    if (viewMode === 'dashboard' && (dadosLojas.length > 0 || dadosVendedores.length > 0)) {
      calcularStatsDashboard();
    }
  }, [metaValores, dadosLojas, dadosVendedores, viewMode, tipoLoja, lojasSelecionadas, vendedoresSelecionados]);
  

  const handleBuscar = async () => {
    setLoading(true);
    setLoadingRanking(true);
    
    try {
      // Buscar dados de ranking de lojas e vendedores
      await Promise.all([
        buscarDadosLojas(filtros.dt_inicio, filtros.dt_fim),
        buscarDadosVendedores(filtros.dt_inicio, filtros.dt_fim)
      ]);
      
      // Buscar metas existentes para o período
      await carregarMetasExistentes();
      
      // Calcular estatísticas do dashboard
      setTimeout(() => {
        calcularStatsDashboard();
        setLoading(false);
        setLoadingRanking(false);
      }, 1000);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setLoading(false);
      setLoadingRanking(false);
    }
  };

  const carregarMetasExistentes = async () => {
    if (!filtros.dt_inicio || !filtros.dt_fim) return;
    
    const mesInicio = filtros.dt_inicio.substring(0, 7);
    const mesFim = filtros.dt_fim.substring(0, 7);
    
    const resultado = await buscarMetas(mesInicio, mesFim);
    
    if (resultado.success) {
      const metasExistentes = {};
      
      resultado.data.forEach(meta => {
        const chave = `${meta.tipo}-${meta.nome}-${meta.campo}`;
        metasExistentes[chave] = meta.valor;
      });
      
      setMetaValores(metasExistentes);
    }
  };
  

  const calcularStatsDashboard = () => {
    if (!filtros.dt_inicio || !filtros.dt_fim) return;
    
    // Inicializar estatísticas
    
    const stats = {
      bronze: { lojas: 0, vendedores: 0 },
      prata: { lojas: 0, vendedores: 0 },
      ouro: { lojas: 0, vendedores: 0 },
      diamante: { lojas: 0, vendedores: 0 },
      // Dados detalhados para as tabelas de progresso
      lojaDetalhes: [],
      vendedorDetalhes: []
    };
    
    // Calcular para lojas
    dadosLojas.forEach((loja, index) => {
      const nomeLoja = loja.nome_fantasia || loja.nome_loja || loja.loja || loja.nm_loja || loja.nome || '';
      const faturamento = Number(loja.faturamento) || 0;
      
      // Procurar metas para esta loja
      let metaBronze = 0;
      let metaPrata = 0;
      let metaOuro = 0;
      let metaDiamante = 0;
      
      // Procurar em todas as chaves de metaValores
      Object.keys(metaValores).forEach(chave => {
        if (chave.startsWith('lojas-') && chave.includes(nomeLoja)) {
          if (chave.endsWith('-bronze')) {
            metaBronze = toNumber(metaValores[chave]);
          } else if (chave.endsWith('-prata')) {
            metaPrata = toNumber(metaValores[chave]);
          } else if (chave.endsWith('-ouro')) {
            metaOuro = toNumber(metaValores[chave]);
          } else if (chave.endsWith('-diamante')) {
            metaDiamante = toNumber(metaValores[chave]);
          }
        }
      });
      
      // Verificar cada tipo de meta
      ['bronze', 'prata', 'ouro', 'diamante'].forEach(tipoMeta => {
        // Procurar a meta para esta loja em todas as chaves que contêm o nome da loja
        let metaEncontrada = null;
        let chaveEncontrada = null;
        
        // Procurar em todas as chaves de metaValores
        Object.keys(metaValores).forEach(chave => {
          if (chave.startsWith('lojas-') && 
              chave.endsWith(`-${tipoMeta}`) && 
              chave.includes(nomeLoja)) {
            metaEncontrada = metaValores[chave];
            chaveEncontrada = chave;
          }
        });
        
        if (metaEncontrada && metaEncontrada !== 'R$ 0,00') {
          // Converter meta para número (remover formatação R$)
          const metaNumero = toNumber(metaEncontrada);
          
          // Se faturamento >= meta, atingiu a meta
          if (faturamento >= metaNumero && metaNumero > 0) {
            stats[tipoMeta].lojas++;
          }
        }
      });
      
      // Determinar meta atual e próxima meta
      let metaAtual = 'Sem meta';
      let proximaMeta = 'Bronze';
      let valorProximaMeta = metaBronze;
      let percentualAtingido = 0;
      let valorFaltante = 0;
      
      // Calcular a meta atual e a próxima meta
      if (metaDiamante > 0 && faturamento >= metaDiamante) {
        metaAtual = 'Diamante';
        proximaMeta = 'Meta máxima atingida';
        valorProximaMeta = 0;
        percentualAtingido = 100;
        valorFaltante = 0;
      } else if (metaOuro > 0 && faturamento >= metaOuro) {
        metaAtual = 'Ouro';
        proximaMeta = 'Diamante';
        valorProximaMeta = metaDiamante;
        percentualAtingido = metaDiamante > 0 ? Math.min(100, Math.round((faturamento / metaDiamante) * 100)) : 0;
        valorFaltante = metaDiamante > 0 ? Math.max(0, metaDiamante - faturamento) : 0;
      } else if (metaPrata > 0 && faturamento >= metaPrata) {
        metaAtual = 'Prata';
        proximaMeta = 'Ouro';
        valorProximaMeta = metaOuro;
        percentualAtingido = metaOuro > 0 ? Math.min(100, Math.round((faturamento / metaOuro) * 100)) : 0;
        valorFaltante = metaOuro > 0 ? Math.max(0, metaOuro - faturamento) : 0;
      } else if (metaBronze > 0 && faturamento >= metaBronze) {
        metaAtual = 'Bronze';
        proximaMeta = 'Prata';
        valorProximaMeta = metaPrata;
        percentualAtingido = metaPrata > 0 ? Math.min(100, Math.round((faturamento / metaPrata) * 100)) : 0;
        valorFaltante = metaPrata > 0 ? Math.max(0, metaPrata - faturamento) : 0;
      } else {
        metaAtual = 'Abaixo de Bronze';
        proximaMeta = 'Bronze';
        valorProximaMeta = metaBronze;
        percentualAtingido = metaBronze > 0 ? Math.min(100, Math.round((faturamento / metaBronze) * 100)) : 0;
        valorFaltante = metaBronze > 0 ? Math.max(0, metaBronze - faturamento) : 0;
      }
      
      // Adicionar aos detalhes para a tabela
      stats.lojaDetalhes.push({
        nome: nomeLoja,
        faturamento,
        metaAtual,
        proximaMeta,
        valorProximaMeta,
        percentualAtingido,
        valorFaltante,
        // Valores de todas as metas para referência
        metas: {
          bronze: metaBronze,
          prata: metaPrata,
          ouro: metaOuro,
          diamante: metaDiamante
        }
      });
    });
    
    // Calcular para vendedores
    dadosVendedores.forEach((vendedor, index) => {
      const nomeVendedor = vendedor.nome_vendedor || vendedor.vendedor || vendedor.nm_vendedor || vendedor.nome || '';
      const faturamento = Number(vendedor.faturamento) || 0;
      
      // Procurar metas para este vendedor
      let metaBronze = 0;
      let metaPrata = 0;
      let metaOuro = 0;
      let metaDiamante = 0;
      
      // Procurar em todas as chaves de metaValores
      Object.keys(metaValores).forEach(chave => {
        if (chave.startsWith('vendedores-') && chave.includes(nomeVendedor)) {
          if (chave.endsWith('-bronze')) {
            metaBronze = toNumber(metaValores[chave]);
          } else if (chave.endsWith('-prata')) {
            metaPrata = toNumber(metaValores[chave]);
          } else if (chave.endsWith('-ouro')) {
            metaOuro = toNumber(metaValores[chave]);
          } else if (chave.endsWith('-diamante')) {
            metaDiamante = toNumber(metaValores[chave]);
          }
        }
      });
      
      // Verificar cada tipo de meta
      ['bronze', 'prata', 'ouro', 'diamante'].forEach(tipoMeta => {
        // Procurar a meta para este vendedor em todas as chaves que contêm o nome do vendedor
        let metaEncontrada = null;
        let chaveEncontrada = null;
        
        // Procurar em todas as chaves de metaValores
        Object.keys(metaValores).forEach(chave => {
          if (chave.startsWith('vendedores-') && 
              chave.endsWith(`-${tipoMeta}`) && 
              chave.includes(nomeVendedor)) {
            metaEncontrada = metaValores[chave];
            chaveEncontrada = chave;
          }
        });
        
        if (metaEncontrada && metaEncontrada !== 'R$ 0,00') {
          // Converter meta para número (remover formatação R$)
          const metaNumero = toNumber(metaEncontrada);
          
          // Se faturamento >= meta, atingiu a meta
          if (faturamento >= metaNumero && metaNumero > 0) {
            stats[tipoMeta].vendedores++;
          }
        }
      });
      
      // Determinar meta atual e próxima meta
      let metaAtual = 'Sem meta';
      let proximaMeta = 'Bronze';
      let valorProximaMeta = metaBronze;
      let percentualAtingido = 0;
      let valorFaltante = 0;
      
      // Calcular a meta atual e a próxima meta
      if (metaDiamante > 0 && faturamento >= metaDiamante) {
        metaAtual = 'Diamante';
        proximaMeta = 'Meta máxima atingida';
        valorProximaMeta = 0;
        percentualAtingido = 100;
        valorFaltante = 0;
      } else if (metaOuro > 0 && faturamento >= metaOuro) {
        metaAtual = 'Ouro';
        proximaMeta = 'Diamante';
        valorProximaMeta = metaDiamante;
        percentualAtingido = metaDiamante > 0 ? Math.min(100, Math.round((faturamento / metaDiamante) * 100)) : 0;
        valorFaltante = metaDiamante > 0 ? Math.max(0, metaDiamante - faturamento) : 0;
      } else if (metaPrata > 0 && faturamento >= metaPrata) {
        metaAtual = 'Prata';
        proximaMeta = 'Ouro';
        valorProximaMeta = metaOuro;
        percentualAtingido = metaOuro > 0 ? Math.min(100, Math.round((faturamento / metaOuro) * 100)) : 0;
        valorFaltante = metaOuro > 0 ? Math.max(0, metaOuro - faturamento) : 0;
      } else if (metaBronze > 0 && faturamento >= metaBronze) {
        metaAtual = 'Bronze';
        proximaMeta = 'Prata';
        valorProximaMeta = metaPrata;
        percentualAtingido = metaPrata > 0 ? Math.min(100, Math.round((faturamento / metaPrata) * 100)) : 0;
        valorFaltante = metaPrata > 0 ? Math.max(0, metaPrata - faturamento) : 0;
      } else {
        metaAtual = 'Abaixo de Bronze';
        proximaMeta = 'Bronze';
        valorProximaMeta = metaBronze;
        percentualAtingido = metaBronze > 0 ? Math.min(100, Math.round((faturamento / metaBronze) * 100)) : 0;
        valorFaltante = metaBronze > 0 ? Math.max(0, metaBronze - faturamento) : 0;
      }
      
      // Adicionar aos detalhes para a tabela
      stats.vendedorDetalhes = stats.vendedorDetalhes || [];
      stats.vendedorDetalhes.push({
        nome: nomeVendedor,
        faturamento,
        metaAtual,
        proximaMeta,
        valorProximaMeta,
        percentualAtingido,
        valorFaltante,
        // Valores de todas as metas para referência
        metas: {
          bronze: metaBronze,
          prata: metaPrata,
          ouro: metaOuro,
          diamante: metaDiamante
        }
      });
    });
    
    setDashboardStats(stats);
  };

  const buscarDadosLojas = async (inicio, fim) => {
    if (!inicio || !fim) return;

    try {
      const params = {
        dt_inicio: inicio,
        dt_fim: fim,
        cd_grupoempresa_ini: 1,
        cd_grupoempresa_fim: 9999
      };

      const result = await apiClient.company.faturamentoLojas(params);
      
      if (result.success) {
        // Verifica se há estrutura aninhada (data.data)
        const dadosArray = result.data?.data || result.data || [];
        console.log('🔍 Dados de lojas recebidos:', dadosArray.slice(0, 2));
        console.log('🔍 Exemplo de item completo:', dadosArray[0]);
        const ordenado = [...dadosArray].sort((a, b) => parseFloat(b.faturamento || 0) - parseFloat(a.faturamento || 0));
        const comRank = ordenado.map((item, index) => ({
          ...item,
          rank: index + 1,
          faturamento: parseFloat(item.faturamento || 0)
        }));
        
        setDadosLojas(comRank);
        
        // Extrair lojas únicas para o filtro
        const lojasUnicas = dadosArray.reduce((acc, item) => {
          const nomeFantasia = item.nome_fantasia;
          if (nomeFantasia && !acc.find(loja => loja.nome_fantasia === nomeFantasia)) {
            acc.push({
              cd_loja: item.cd_grupoempresa || item.pessoa_empresa,
              nome_fantasia: nomeFantasia,
              nm_loja: nomeFantasia
            });
          }
          return acc;
        }, []);
        
        setDadosLoja(lojasUnicas);
      } else {
        throw new Error(result.message || 'Erro ao buscar dados de lojas');
      }
    } catch (error) {
      console.error('Erro ao buscar dados de lojas:', error);
    }
  };

  const buscarDadosVendedores = async (inicio, fim) => {
    if (!inicio || !fim) return;

    try {
      const params = {
        inicio: inicio,
        fim: fim
      };

      const result = await apiClient.sales.rankingVendedores(params);
      
      if (result.success) {
        // Verifica se há estrutura aninhada (data.data)
        const dadosArray = result.data?.data || result.data || [];
        console.log('🔍 Dados de vendedores recebidos:', dadosArray.slice(0, 2));
        const ordenado = [...dadosArray].sort((a, b) => parseFloat(b.faturamento || 0) - parseFloat(a.faturamento || 0));
        const comRank = ordenado.map((item, index) => ({
          ...item,
          rank: index + 1,
          faturamento: parseFloat(item.faturamento || 0)
        }));
        
        setDadosVendedores(comRank);
        // montar lista de vendedores para o filtro
        const listaVendedores = (dadosArray || []).reduce((acc, item) => {
          const nome = item.nome_vendedor || item.vendedor || item.nm_vendedor || item.nome;
          if (nome && !acc.find((v) => v.nome_vendedor === nome)) {
            acc.push({ id: item.cd_vendedor || item.id, nome_vendedor: nome });
          }
          return acc;
        }, []);
        setDadosVendedor(listaVendedores);
      } else {
        throw new Error(result.message || 'Erro ao buscar dados de vendedores');
      }
    } catch (error) {
      console.error('Erro ao buscar dados de vendedores:', error);
    }
  };

  const handleOrdenacao = (campo) => {
    if (campo === ordenacao) {
      setDirecaoOrdenacao(direcaoOrdenacao === 'asc' ? 'desc' : 'asc');
    } else {
      setOrdenacao(campo);
      setDirecaoOrdenacao('asc');
    }
  };

  const dadosOrdenados = () => {
    let dados = rankingTipo === 'lojas' ? dadosLojas : dadosVendedores;
    
    // Filtrar por tipo de loja
    if (rankingTipo === 'lojas') {
      dados = dados.filter((item) => {
        const nomeFantasia = item.nome_fantasia?.toUpperCase() || '';
        
        if (tipoLoja === 'Franquias') {
           const isFranquia = nomeFantasia.includes('F0');
            return isFranquia;
        }
        
        if (tipoLoja === 'Proprias') {
          const isFranquia = nomeFantasia.includes('-') || nomeFantasia.includes('- CROSBY');
          return !isFranquia;
        }
        
        return true; // 'Todos'
      });
    }
    
    // Filtrar vendedores por tipo de loja
    if (rankingTipo === 'vendedores') {
      dados = dados.filter((item) => {
        if (tipoLoja === 'Franquias') {
          return !item.nome_vendedor?.includes('- INT');
        }
        if (tipoLoja === 'Proprias') {
          return item.nome_vendedor?.includes('- INT');
        }
        return true; // 'Todos'
      }).filter(item => item.faturamento > 0);

      if (vendedoresSelecionados.length > 0) {
        const nomesSel = vendedoresSelecionados.map(v => v.nome_vendedor || v.vendedor || v.nm_vendedor || v.nome);
        dados = dados.filter(item => nomesSel.includes(item.nome_vendedor || item.vendedor || item.nm_vendedor || item.nome));
      }
    }
    
    // Filtrar por lojas selecionadas se houver
    if (rankingTipo === 'lojas' && lojasSelecionadas.length > 0) {
      const lojasSelecionadasNomes = lojasSelecionadas.map(loja => loja.nome_fantasia);
      console.log('🔍 Lojas selecionadas:', lojasSelecionadasNomes);
      console.log('🔍 Dados antes do filtro:', dados.length);
      
      dados = dados.filter(item => {
        const nomeItem = item.nome_fantasia;
        const incluido = lojasSelecionadasNomes.includes(nomeItem);
        console.log(`🔍 Item: ${nomeItem} - Incluído: ${incluido}`);
        return incluido;
      });
      
      console.log('🔍 Dados após filtro:', dados.length);
    }
    
    return [...dados].sort((a, b) => {
      let valorA, valorB;
      
      if (ordenacao === 'faturamento') {
        valorA = parseFloat(a.faturamento || 0);
        valorB = parseFloat(b.faturamento || 0);
      } else if (ordenacao === 'nome') {
        valorA = (rankingTipo === 'lojas' 
          ? (a.nome_fantasia || a.nome_loja || a.loja || a.nm_loja || a.nome || '')
          : (a.nome_vendedor || a.vendedor || a.nm_vendedor || a.nome || '')
        ).toLowerCase();
        valorB = (rankingTipo === 'lojas' 
          ? (b.nome_fantasia || b.nome_loja || b.loja || b.nm_loja || b.nome || '')
          : (b.nome_vendedor || b.vendedor || b.nm_vendedor || b.nome || '')
        ).toLowerCase();
      }
      
      if (direcaoOrdenacao === 'asc') {
        return valorA > valorB ? 1 : -1;
      } else {
        return valorA < valorB ? 1 : -1;
      }
    });
  };

  


  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle 
        title="Metas Varejo" 
        subtitle="Acompanhamento de metas e objetivos do canal varejo"
        icon={Target}
        iconColor="text-orange-600"
      />

      {/* Filtros */}
      <div className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); handleBuscar(); }} className="bg-white p-3 rounded-lg shadow-md border border-[#000638]/10">
          <div className="mb-2">
            <span className="text-xs font-bold text-[#000638] flex items-center gap-1">
              <Calendar size={10} weight="bold" /> Filtros
            </span>
            <span className="text-xs text-gray-500 mt-1">Selecione as empresas e período para análise das metas</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
            {/* Filtro de Loja */}
            <div className="lg:col-span-1">
            <FiltroLoja
              lojasSelecionadas={lojasSelecionadas}
              onSelectLojas={(novasLojas) => {
                console.log('🔍 Lojas selecionadas alteradas:', novasLojas);
                setLojasSelecionadas(novasLojas);
              }}
              dadosLoja={dadosLoja}
            />
            </div>
            
            {/* Filtro de Vendedores */}
            <div className="lg:col-span-1">
              <FiltroVendedor
                vendedoresSelecionados={vendedoresSelecionados}
                onSelectVendedores={setVendedoresSelecionados}
                dadosVendedor={dadosVendedor}
              />
            </div>
            
            {/* Filtro de Tipo de Loja */}
            <div className="flex flex-col">
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Tipo de Loja</label>
              <select
                value={tipoLoja}
                onChange={(e) => setTipoLoja(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
              >
                <option value="Todos">Todos</option>
                <option value="Proprias">Próprias</option>
                <option value="Franquias">Franquias</option>
              </select>
            </div>
            
            {/* Data Inicial */}
            <div className="flex flex-col">
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Data Inicial</label>
              <input
                type="date"
                name="dt_inicio"
                value={filtros.dt_inicio}
                onChange={e => setFiltros({ ...filtros, dt_inicio: e.target.value })}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
              />
            </div>
            
            {/* Data Final */}
            <div className="flex flex-col">
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">Data Final</label>
              <input
                type="date"
                name="dt_fim"
                value={filtros.dt_fim}
                onChange={e => setFiltros({ ...filtros, dt_fim: e.target.value })}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400 text-xs"
              />
            </div>
            
            {/* Botão de Busca */}
            <div className="flex items-center">
              <button
                type="submit"
                disabled={loading || !filtros.dt_inicio || !filtros.dt_fim}
                className="flex items-center gap-1 bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors h-7 text-xs font-bold shadow-md tracking-wide uppercase w-full justify-center"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Botões de Alternância Tabela/Dashboard */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('tabela')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
              viewMode === 'tabela'
                ? 'bg-[#000638] border-[#000638] text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <TrendUp size={16} />
            Tabela
          </button>
          
          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
              viewMode === 'dashboard'
                ? 'bg-[#000638] border-[#000638] text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Target size={16} />
            Dashboard
          </button>
        </div>
      </div>

      {/* Conteúdo baseado no modo selecionado */}
      {viewMode === 'tabela' && (
        <>
          {/* Ranking de Faturamento */}
      {(dadosLojas.length > 0 || dadosVendedores.length > 0) && (
        <div className="bg-white p-3 rounded-lg shadow-md border border-[#000638]/10">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#000638] flex items-center gap-1">
                <TrendUp size={10} weight="bold" /> Ranking de Faturamento
              </span>
              <span className="block text-xs text-gray-500 mt-1">Ranking de {rankingTipo === 'lojas' ? 'lojas' : 'vendedores'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={abrirModalMetas}
                className="text-xs bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] transition-colors"
              >
                {rankingTipo === 'lojas' ? '+ Metas Lojas' : '+ Metas Vendedores'}
              </button>
              <button
                type="button"
                onClick={abrirLogModal}
                className="text-xs bg-gray-400 text-white px-2 py-1 rounded-lg hover:bg-gray-500 transition-colors opacity-70"
                title="Log de Alterações"
              >
                Log
              </button>
            </div>
          </div>
          
          {/* Seletor de Tipo */}
          <div className="mb-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setRankingTipo('lojas')}
                className={`flex items-center justify-center px-3 py-1 rounded-lg border transition-colors text-xs ${
                  rankingTipo === 'lojas'
                    ? 'bg-[#000638] border-[#000638] text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <TrendUp size={12} className="mr-1" />
                Lojas
              </button>
              
              <button
                onClick={() => setRankingTipo('vendedores')}
                className={`flex items-center justify-center px-3 py-1 rounded-lg border transition-colors text-xs ${
                  rankingTipo === 'vendedores'
                    ? 'bg-[#000638] border-[#000638] text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <TrendUp size={12} className="mr-1" />
                Vendedores
              </button>
            </div>
          </div>


          {/* Tabela de Ranking */}
          <div className="overflow-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-1 py-0.5 text-center text-[9px]">#</th>
                  <th 
                    className="px-1 py-0.5 text-center text-[9px] cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleOrdenacao('nome')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {rankingTipo === 'lojas' ? 'Loja' : 'Vendedor'}
                      {ordenacao === 'nome' && (
                        <span className="text-xs">
                          {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-1 py-0.5 text-center text-[9px] cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleOrdenacao('faturamento')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Faturamento
                      {ordenacao === 'faturamento' && (
                        <span className="text-xs">
                          {direcaoOrdenacao === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-1 py-0.5 text-center text-[9px]">Ticket Médio</th>
                  <th className="px-1 py-0.5 text-center text-[9px]">PA</th>
                  <th className="px-1 py-0.5 text-center text-[9px]">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      Bronze
                    </span>
                  </th>
                  <th className="px-1 py-0.5 text-center text-[9px]">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Prata
                    </span>
                  </th>
                  <th className="px-1 py-0.5 text-center text-[9px]">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Ouro
                    </span>
                  </th>
                  <th className="px-1 py-0.5 text-center text-[9px]">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Diamante
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingRanking ? (
                  <tr>
                    <td colSpan={9} className="px-1 py-2 text-center text-[9px] text-gray-500">
                      Carregando dados...
                    </td>
                  </tr>
                ) : (
                  dadosOrdenados().map((item) => (
                    <tr key={item.rank} className="hover:bg-gray-50">
                      <td className="px-1 py-1 text-center text-[9px] font-medium">{item.rank}</td>
                      <td className="px-1 py-1 text-center text-[9px]">
                        {rankingTipo === 'lojas' 
                          ? (item.nome_fantasia || item.nome_loja || item.loja || item.nm_loja || item.nome || 'N/A')
                          : (item.nome_vendedor || item.vendedor || item.nm_vendedor || item.nome || 'N/A')
                        }
                      </td>
                      <td className="px-1 py-1 text-center text-[9px] font-semibold text-green-600">
                        R$ {item.faturamento.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-1 py-1 text-center text-[9px]">
                        {(() => {
                          const transacoesSaida = Number(rankingTipo === 'lojas' ? item.transacoes_saida : item.transacoes_saida);
                          if (transacoesSaida > 0) {
                            const ticket = item.faturamento / transacoesSaida;
                            return `R$ ${ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                          }
                          return '-';
                        })()}
                      </td>
                      <td className="px-1 py-1 text-center text-[9px]">
                        {(() => {
                          const transacoesSaida = Number(item.transacoes_saida) || 0;
                          if (transacoesSaida === 0) return '-';
                          const paSaida = Number(item.pa_saida) || 0;
                          const paEntrada = Number(item.pa_entrada) || 0;
                          const paCalc = ((paSaida - paEntrada) / transacoesSaida).toFixed(2);
                          return paCalc;
                        })()}
                      </td>
                      <td className="px-1 py-1 text-center text-[9px]">
                        {renderCellEditor(`${rankingTipo}-${item.nome_fantasia || item.nome_vendedor || item.nome}-bronze`, 'text-amber-700')}
                      </td>
                      <td className="px-1 py-1 text-center text-[9px]">
                        {renderCellEditor(`${rankingTipo}-${item.nome_fantasia || item.nome_vendedor || item.nome}-prata`, 'text-gray-700')}
                      </td>
                      <td className="px-1 py-1 text-center text-[9px]">
                        {renderCellEditor(`${rankingTipo}-${item.nome_fantasia || item.nome_vendedor || item.nome}-ouro`, 'text-yellow-700')}
                      </td>
                      <td className="px-1 py-1 text-center text-[9px]">
                        {renderCellEditor(`${rankingTipo}-${item.nome_fantasia || item.nome_vendedor || item.nome}-diamante`, 'text-blue-700')}
                      </td>
                    </tr>
                  ))
                )}
                
                {dadosOrdenados().length === 0 && !loadingRanking && (
                  <tr>
                    <td colSpan={9} className="px-1 py-2 text-center text-[9px] text-gray-500">
                      Nenhum {rankingTipo === 'lojas' ? 'loja' : 'vendedor'} encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Adicionar Metas em Lote */}
      {showAddMetasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={fecharModalMetas}></div>
          <div className="relative bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-md p-4">
            <h3 className="text-sm font-bold text-[#000638] mb-3">
              Adicionar Metas {rankingTipo === 'lojas' ? 'Lojas' : 'Vendedores'} (em lote)
            </h3>
            <div className="space-y-3">
              {rankingTipo === 'lojas' ? (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#000638]">Selecionar Lojas</label>
                  <FiltroLoja
                    lojasSelecionadas={lojasSelecionadasMetas}
                    onSelectLojas={setLojasSelecionadasMetas}
                    dadosLoja={dadosLoja}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#000638]">Selecionar Vendedores</label>
                  <FiltroVendedor
                    vendedoresSelecionados={vendedoresSelecionadosMetas}
                    onSelectVendedores={setVendedoresSelecionadosMetas}
                    dadosVendedor={dadosVendedor}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-amber-700 mb-1">Bronze</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full px-2 py-1 border border-blue-200 rounded text-[12px] bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="0,00"
                    value={metasBulk.bronze}
                    onChange={(e) => setMetasBulk({ ...metasBulk, bronze: sanitizeInput(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-700 mb-1">Prata</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full px-2 py-1 border border-blue-200 rounded text-[12px] bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="0,00"
                    value={metasBulk.prata}
                    onChange={(e) => setMetasBulk({ ...metasBulk, prata: sanitizeInput(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-yellow-700 mb-1">Ouro</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full px-2 py-1 border border-blue-200 rounded text-[12px] bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="0,00"
                    value={metasBulk.ouro}
                    onChange={(e) => setMetasBulk({ ...metasBulk, ouro: sanitizeInput(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-blue-700 mb-1">Diamante</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full px-2 py-1 border border-blue-200 rounded text-[12px] bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="0,00"
                    value={metasBulk.diamante}
                    onChange={(e) => setMetasBulk({ ...metasBulk, diamante: sanitizeInput(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button type="button" onClick={fecharModalMetas} className="text-xs bg-gray-500 text-white px-3 py-1 rounded-lg">Cancelar</button>
                <button type="button" onClick={confirmarAplicarMetas} className="text-xs bg-[#000638] text-white px-3 py-1 rounded-lg">Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={cancelarAplicarMetas}></div>
          <div className="relative bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-sm p-4">
            <h3 className="text-sm font-bold text-[#000638] mb-3 text-center">Confirmação</h3>
            <p className="text-xs text-gray-600 text-center mb-4">
              Deseja realmente adicionar as metas?
            </p>
            <div className="flex items-center justify-center gap-2">
              <button 
                type="button" 
                onClick={cancelarAplicarMetas}
                className="text-xs bg-gray-500 text-white px-4 py-1 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Não
              </button>
              <button 
                type="button" 
                onClick={aplicarMetasEmLote}
                className="text-xs bg-[#000638] text-white px-4 py-1 rounded-lg hover:bg-[#fe0000] transition-colors"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Log de Alterações */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={fecharLogModal}></div>
          <div className="relative bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-4xl p-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#000638]">Log de Alterações de Metas</h3>
              <button
                type="button"
                onClick={fecharLogModal}
                className="text-gray-500 hover:text-gray-700 text-lg font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Tipo</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Nome</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Campo</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Valor</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Mês</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Usuário</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {logAlteracoesReal.length > 0 ? (
                    logAlteracoesReal.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-2">
                          <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                            log.tipo === 'lojas' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {log.tipo === 'lojas' ? 'Loja' : 'Vendedor'}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-medium text-gray-900">{log.nome}</td>
                        <td className="px-2 py-2">
                          <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                            log.campo === 'bronze' ? 'bg-amber-100 text-amber-700' :
                            log.campo === 'prata' ? 'bg-gray-100 text-gray-700' :
                            log.campo === 'ouro' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {log.campo.charAt(0).toUpperCase() + log.campo.slice(1)}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-medium text-green-600">{log.valor}</td>
                        <td className="px-2 py-2 text-gray-700">{log.mes}</td>
                        <td className="px-2 py-2 text-gray-700">{log.usuario}</td>
                        <td className="px-2 py-2 text-gray-500">
                          {new Date(log.data_alteracao).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-2 py-4 text-center text-gray-500">
                        Nenhuma alteração registrada ainda
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Total de {logAlteracoesReal.length} alterações registradas
              </p>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {viewMode === 'dashboard' && (
        <div className="bg-white p-4 rounded-lg shadow-md border border-[#000638]/10">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-[#000638] mb-2">Dashboard de Metas</h3>
              <p className="text-sm text-gray-600">Acompanhamento de metas atingidas por lojas e vendedores</p>
            </div>
            <button
              type="button"
              onClick={calcularStatsDashboard}
              className="text-xs bg-[#000638] text-white px-3 py-1 rounded-lg hover:bg-[#fe0000] transition-colors"
            >
              Recalcular Estatísticas
            </button>
          </div>
          
          {/* Cards de Metas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card Bronze */}
            <div className="bg-white p-4 rounded-lg shadow border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-amber-700">Meta Bronze</p>
                  <p className="text-xs text-amber-600">Faturamento atingido</p>
                </div>
                <div className="text-2xl">🥉</div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Lojas:</span>
                  <span className="font-bold text-amber-700">{dashboardStats.bronze.lojas}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Vendedores:</span>
                  <span className="font-bold text-amber-700">{dashboardStats.bronze.vendedores}</span>
                </div>
              </div>
            </div>
            
            {/* Card Prata */}
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-700">Meta Prata</p>
                  <p className="text-xs text-gray-600">Faturamento atingido</p>
                </div>
                <div className="text-2xl">🥈</div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Lojas:</span>
                  <span className="font-bold text-gray-700">{dashboardStats.prata.lojas}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Vendedores:</span>
                  <span className="font-bold text-gray-700">{dashboardStats.prata.vendedores}</span>
                </div>
              </div>
            </div>
            
            {/* Card Ouro */}
            <div className="bg-white p-4 rounded-lg shadow border border-yellow-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-yellow-700">Meta Ouro</p>
                  <p className="text-xs text-yellow-600">Faturamento atingido</p>
                </div>
                <div className="text-2xl">🥇</div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Lojas:</span>
                  <span className="font-bold text-yellow-700">{dashboardStats.ouro.lojas}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Vendedores:</span>
                  <span className="font-bold text-yellow-700">{dashboardStats.ouro.vendedores}</span>
                </div>
              </div>
            </div>
            
            {/* Card Diamante */}
            <div className="bg-white p-4 rounded-lg shadow border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-blue-700">Meta Diamante</p>
                  <p className="text-xs text-blue-600">Faturamento atingido</p>
                </div>
                <div className="text-2xl">💎</div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Lojas:</span>
                  <span className="font-bold text-blue-700">{dashboardStats.diamante.lojas}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Vendedores:</span>
                  <span className="font-bold text-blue-700">{dashboardStats.diamante.vendedores}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Botões para alternar entre tabelas */}
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTabelaAtiva('lojas')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
                  tabelaAtiva === 'lojas'
                    ? 'bg-[#000638] border-[#000638] text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Lojas
              </button>
              
              <button
                type="button"
                onClick={() => setTabelaAtiva('vendedores')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
                  tabelaAtiva === 'vendedores'
                    ? 'bg-[#000638] border-[#000638] text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Vendedores
              </button>
            </div>
          </div>
          
          {/* Tabela de Progresso de Metas - LOJAS */}
          {tabelaAtiva === 'lojas' && (
            <div className="mb-6">
              <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-[#000638]">Progresso de Metas por Loja</p>
                    <p className="text-xs text-gray-600">Acompanhamento detalhado do progresso para a próxima meta</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loja</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faturamento</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meta Atual</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Próxima Meta</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progresso</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Falta</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dashboardStats.lojaDetalhes && dashboardStats.lojaDetalhes.length > 0 ? (
                        dashboardStats.lojaDetalhes
                          .filter(loja => {
                            // Filtrar por lojas selecionadas se houver
                            if (lojasSelecionadas.length > 0) {
                              return lojasSelecionadas.some(l => 
                                (l.nome_fantasia || l.nome_loja || l.loja || l.nm_loja || l.nome || '').includes(loja.nome)
                              );
                            }
                            return true;
                          })
                          // Filtrar por tipo de loja
                          .filter(loja => {
                            const nomeLoja = loja.nome;
                            
                            if (tipoLoja === 'Franquias') {
                              // Considerar franquia se o nome contém "F0" (padrão de código de franquia)
                              return nomeLoja.includes('F0');
                            }
                            
                            if (tipoLoja === 'Proprias') {
                              // Considerar própria se o nome NÃO contém "F0"
                              return !nomeLoja.includes('F0');
                            }
                            
                            return true; // 'Todos'
                          })
                          .sort((a, b) => b.faturamento - a.faturamento) // Ordenar por faturamento
                          .map((loja, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-xs">{loja.nome}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-green-600">{formatBRL(loja.faturamento)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                  ${loja.metaAtual === 'Diamante' ? 'bg-blue-100 text-blue-800' : 
                                    loja.metaAtual === 'Ouro' ? 'bg-yellow-100 text-yellow-800' :
                                    loja.metaAtual === 'Prata' ? 'bg-gray-100 text-gray-800' :
                                    loja.metaAtual === 'Bronze' ? 'bg-amber-100 text-amber-800' :
                                    'bg-gray-100 text-gray-800'}`}>
                                  {loja.metaAtual}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">
                                    {loja.proximaMeta}
                                  </span>
                                  {loja.valorProximaMeta > 0 && (
                                    <span className="text-xs text-gray-500">
                                      {formatBRL(loja.valorProximaMeta)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                    <div 
                                      className={`h-2.5 rounded-full ${
                                        loja.metaAtual === 'Diamante' ? 'bg-blue-600' : 
                                        loja.metaAtual === 'Ouro' ? 'bg-yellow-500' :
                                        loja.metaAtual === 'Prata' ? 'bg-gray-500' :
                                        loja.metaAtual === 'Bronze' ? 'bg-amber-500' :
                                        'bg-blue-600'
                                      }`} 
                                      style={{ width: `${loja.percentualAtingido}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-medium">{loja.percentualAtingido}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs">
                                {loja.valorFaltante > 0 ? formatBRL(loja.valorFaltante) : 'Meta atingida'}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">
                            Nenhum dado disponível. Verifique se existem metas cadastradas e faturamento no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* Tabela de Progresso de Metas - VENDEDORES */}
          {tabelaAtiva === 'vendedores' && (
            <div className="mb-6">
              <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-[#000638]">Progresso de Metas por Vendedor</p>
                    <p className="text-xs text-gray-600">Acompanhamento detalhado do progresso para a próxima meta</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendedor</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faturamento</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meta Atual</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Próxima Meta</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progresso</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Falta</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dashboardStats.vendedorDetalhes && dashboardStats.vendedorDetalhes.length > 0 ? (
                        dashboardStats.vendedorDetalhes
                          .filter(vendedor => {
                            // Filtrar por vendedores selecionados se houver
                            if (vendedoresSelecionados.length > 0) {
                              return vendedoresSelecionados.some(v => 
                                (v.nome_vendedor || v.vendedor || v.nm_vendedor || v.nome || '').includes(vendedor.nome)
                              );
                            }
                            return true;
                          })
                          // Filtrar por tipo de loja (para vendedores)
                          .filter(vendedor => {
                            const nomeVendedor = vendedor.nome;
                            
                            if (tipoLoja === 'Franquias') {
                              // Vendedores de franquias não têm "- INT" no nome
                              return !nomeVendedor.includes('- INT');
                            }
                            
                            if (tipoLoja === 'Proprias') {
                              // Vendedores de lojas próprias têm "- INT" no nome
                              return nomeVendedor.includes('- INT');
                            }
                            
                            return true; // 'Todos'
                          })
                          .sort((a, b) => b.faturamento - a.faturamento) // Ordenar por faturamento
                          .map((vendedor, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-xs">{vendedor.nome}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-green-600">{formatBRL(vendedor.faturamento)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                  ${vendedor.metaAtual === 'Diamante' ? 'bg-blue-100 text-blue-800' : 
                                    vendedor.metaAtual === 'Ouro' ? 'bg-yellow-100 text-yellow-800' :
                                    vendedor.metaAtual === 'Prata' ? 'bg-gray-100 text-gray-800' :
                                    vendedor.metaAtual === 'Bronze' ? 'bg-amber-100 text-amber-800' :
                                    'bg-gray-100 text-gray-800'}`}>
                                  {vendedor.metaAtual}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">
                                    {vendedor.proximaMeta}
                                  </span>
                                  {vendedor.valorProximaMeta > 0 && (
                                    <span className="text-xs text-gray-500">
                                      {formatBRL(vendedor.valorProximaMeta)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                    <div 
                                      className={`h-2.5 rounded-full ${
                                        vendedor.metaAtual === 'Diamante' ? 'bg-blue-600' : 
                                        vendedor.metaAtual === 'Ouro' ? 'bg-yellow-500' :
                                        vendedor.metaAtual === 'Prata' ? 'bg-gray-500' :
                                        vendedor.metaAtual === 'Bronze' ? 'bg-amber-500' :
                                        'bg-blue-600'
                                      }`} 
                                      style={{ width: `${vendedor.percentualAtingido}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-medium">{vendedor.percentualAtingido}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs">
                                {vendedor.valorFaltante > 0 ? formatBRL(vendedor.valorFaltante) : 'Meta atingida'}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">
                            Nenhum dado disponível. Verifique se existem metas cadastradas e faturamento no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 text-center">
              * Dados baseados nas metas definidas e faturamento do período selecionado ({filtros.dt_inicio} a {filtros.dt_fim})
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetasVarejo;
