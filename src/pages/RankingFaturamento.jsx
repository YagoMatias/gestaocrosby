import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import { 
  Calendar, 
  Funnel, 
  Spinner,
  CurrencyDollar,
  Trophy,
  Users,
  Storefront,
  ChartLineUp,
  Star,
  Buildings,
  User,
  ArrowClockwise,
  CaretDown,
  CaretUp,
  FileText
} from '@phosphor-icons/react';

const RankingFaturamento = () => {
  const [dados, setDados] = useState([]);
  const [dadosVendedores, setDadosVendedores] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingVendedores, setLoadingVendedores] = useState(false);
  const [tipoLoja, setTipoLoja] = useState('Todos');
  const [rankingTipo, setRankingTipo] = useState('lojas');
  const BaseURL = 'https://apigestaocrosby.onrender.com/';

  console.log('RankingFaturamento: Componente renderizado');

  const buscarDados = async (inicio, fim) => {
    if (!inicio || !fim) return;

    setLoading(true);
    try {
      const res = await fetch(`${BaseURL}faturamentolojas?inicio=${inicio}&fim=${fim}&cd_grupoempresa_ini=1&cd_grupoempresa_fim=9999`);
      const data = await res.json();

      // Os dados já vêm como array direto
      const dadosArray = data;
      
      const ordenado = [...dadosArray].sort((a, b) => b.faturamento - a.faturamento);
      const comRank = ordenado.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
      console.log('Dados de lojas recebidos:', comRank);
      console.log('Primeiro item:', comRank[0]);
      setDados(comRank);
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const buscarDadosVendedores = async (inicio, fim) => {
    if (!inicio || !fim) return;

    setLoadingVendedores(true);
    try {
      const res = await fetch(`${BaseURL}rankingvendedor?inicio=${inicio}&fim=${fim}`);
      const data = await res.json();

      // Extrair dados da resposta estruturada
      const dadosArray = data.dados || data;
      
      const ordenado = [...dadosArray].sort((a, b) => b.faturamento - a.faturamento);
      const comRank = ordenado.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
      setDadosVendedores(comRank);
    } catch (err) {
      console.error('Erro ao carregar dados de vendedores:', err);
      alert('Erro ao carregar dados de vendedores. Tente novamente.');
    } finally {
      setLoadingVendedores(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  // Função auxiliar para carregar imagem
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
      
      img.src = src;
    });
  };

  const exportarPDFLojas = async () => {
    try {
      console.log('Iniciando exportação PDF - Lojas');
      console.log('Dados disponíveis:', dadosLojasFiltrados.length);
      
      // Importação dinâmica da biblioteca
      console.log('Importando jsPDF...');
      const jsPDF = (await import('jspdf')).default;
      console.log('jsPDF importado com sucesso');
      
      console.log('Criando documento...');
      const doc = new jsPDF();
      console.log('Documento criado');
      
      // Adicionar logo
      console.log('Adicionando logo...');
      try {
        const img = await loadImage('/cr.png');
        console.log('Logo carregado com sucesso, adicionando ao PDF...');
        doc.addImage(img, 'PNG', 14, 10, 50, 20);
        console.log('Logo adicionado ao PDF');
      } catch (logoError) {
        console.log('Erro ao carregar logo, usando texto:', logoError);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 6, 56);
        doc.text('CROSBY', 14, 20);
      }
      console.log('Logo adicionado');
      
      // Título
      console.log('Adicionando título...');
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Ranking de Faturamento - Lojas', 14, 45);
      console.log('Título adicionado');
      
      // Informações do período
      console.log('Adicionando informações do período...');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${formatDisplayDate(dataInicio)} a ${formatDisplayDate(dataFim)}`, 14, 55);
      doc.text(`Tipo: ${tipoLoja}`, 14, 63);
      console.log('Informações do período adicionadas');
      
      // Cabeçalho da tabela
      console.log('Adicionando cabeçalho da tabela...');
      const headerY = 75;
      const headerHeight = 8;
      
      // Fundo azul do cabeçalho
      doc.setFillColor(0, 6, 56);
      doc.rect(14, headerY - 5, 186, headerHeight, 'F');
      
      // Texto do cabeçalho em branco
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('#', 17, headerY);
      doc.text('Loja', 35, headerY);
      doc.text('Faturamento', 110, headerY);
      doc.text('PA', 150, headerY);
      doc.text('Ticket Médio', 180, headerY);
      console.log('Cabeçalho da tabela adicionado');
      
      // Dados da tabela com listagem zebrada
      console.log('Adicionando dados da tabela...');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      let yPosition = headerY + 10;
      let itemCount = 0;
      
      dadosLojasFiltrados.forEach((item, index) => {
        try {
          console.log(`Processando item ${index + 1}:`, item);
          
          if (yPosition > 270) {
            console.log('Adicionando nova página...');
            doc.addPage();
            yPosition = 20;
          }
          
          // Listagem zebrada (cinza mais forte para linhas pares)
          if (index % 2 === 1) {
            doc.setFillColor(230, 232, 235);
            doc.rect(14, yPosition - 5, 186, 8, 'F');
          }
          
          // Calcular ticket médio
          const ticketMedio = item.trasaida > 0 ? (item.faturamento / item.trasaida) : 0;
          
          doc.setTextColor(0, 0, 0);
          doc.text(String(item.rank || ''), 17, yPosition);
          doc.text(String(item.nome_fantasia || 'N/A'), 35, yPosition);
          doc.text(formatCurrency(item.faturamento || 0), 110, yPosition);
          doc.text(String(item.paentrada || 0), 150, yPosition);
          doc.text(formatCurrency(ticketMedio), 180, yPosition);
          
          yPosition += 10;
          itemCount++;
        } catch (itemError) {
          console.error(`Erro ao processar item ${index}:`, itemError);
        }
      });
      
      console.log(`Total de itens processados: ${itemCount}`);
      
      const fileName = `ranking-lojas-${dataInicio}-${dataFim}.pdf`;
      console.log('Salvando arquivo:', fileName);
      doc.save(fileName);
      console.log('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF - Lojas:', error);
      console.error('Stack trace:', error.stack);
      alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
    }
  };

  const exportarPDFVendedores = async () => {
    try {
      console.log('Iniciando exportação PDF - Vendedores');
      console.log('Dados disponíveis:', dadosVendedoresFiltrados.length);
      
      // Importação dinâmica da biblioteca
      console.log('Importando jsPDF...');
      const jsPDF = (await import('jspdf')).default;
      console.log('jsPDF importado com sucesso');
      
      console.log('Criando documento...');
      const doc = new jsPDF();
      console.log('Documento criado');
      
      // Adicionar logo
      console.log('Adicionando logo...');
      try {
        const img = await loadImage('/cr.png');
        console.log('Logo carregado com sucesso, adicionando ao PDF...');
        doc.addImage(img, 'PNG', 14, 10, 50, 20);
        console.log('Logo adicionado ao PDF');
      } catch (logoError) {
        console.log('Erro ao carregar logo, usando texto:', logoError);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 6, 56);
        doc.text('CROSBY', 14, 20);
      }
      console.log('Logo adicionado');
      
      // Título
      console.log('Adicionando título...');
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Ranking de Faturamento - Vendedores', 14, 45);
      console.log('Título adicionado');
      
      // Informações do período
      console.log('Adicionando informações do período...');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${formatDisplayDate(dataInicio)} a ${formatDisplayDate(dataFim)}`, 14, 55);
      doc.text(`Tipo: ${tipoLoja}`, 14, 63);
      console.log('Informações do período adicionadas');
      
      // Cabeçalho da tabela
      console.log('Adicionando cabeçalho da tabela...');
      const headerY = 75;
      const headerHeight = 8;
      
      // Fundo azul do cabeçalho
      doc.setFillColor(0, 6, 56);
      doc.rect(14, headerY - 5, 186, headerHeight, 'F');
      
      // Texto do cabeçalho em branco
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('#', 17, headerY);
      doc.text('Vendedor', 35, headerY);
      doc.text('Faturamento', 110, headerY);
      doc.text('PA', 150, headerY);
      doc.text('Ticket Médio', 180, headerY);
      console.log('Cabeçalho da tabela adicionado');
      
      // Dados da tabela com listagem zebrada
      console.log('Adicionando dados da tabela...');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      let yPosition = headerY + 10;
      let itemCount = 0;
      
      dadosVendedoresFiltrados.forEach((item, index) => {
        try {
          console.log(`Processando item ${index + 1}:`, item);
          
          if (yPosition > 270) {
            console.log('Adicionando nova página...');
            doc.addPage();
            yPosition = 20;
          }
          
          // Listagem zebrada (cinza mais forte para linhas pares)
          if (index % 2 === 1) {
            doc.setFillColor(230, 232, 235);
            doc.rect(14, yPosition - 5, 186, 8, 'F');
          }
          
          // Calcular ticket médio
          const ticketMedio = item.trasaida > 0 ? (item.faturamento / item.trasaida) : 0;
          
          doc.setTextColor(0, 0, 0);
          doc.text(String(item.rank || ''), 17, yPosition);
          doc.text(String(item.nome_vendedor || 'N/A'), 35, yPosition);
          doc.text(formatCurrency(item.faturamento || 0), 110, yPosition);
          doc.text(String(item.paentrada || 0), 150, yPosition);
          doc.text(formatCurrency(ticketMedio), 180, yPosition);
          
          yPosition += 10;
          itemCount++;
        } catch (itemError) {
          console.error(`Erro ao processar item ${index}:`, itemError);
        }
      });
      
      console.log(`Total de itens processados: ${itemCount}`);
      
      const fileName = `ranking-vendedores-${dataInicio}-${dataFim}.pdf`;
      console.log('Salvando arquivo:', fileName);
      doc.save(fileName);
      console.log('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF - Vendedores:', error);
      console.error('Stack trace:', error.stack);
      alert('Erro ao gerar PDF. Verifique o console para mais detalhes.');
    }
  };

  const getStatusByRank = (rank) => {
    if (rank === 1) return 'destaque';
    if (rank <= 3) return 'ativo';
    return 'regular';
  };

  useEffect(() => {
    const hoje = new Date();
    hoje.setUTCHours(hoje.getUTCHours() - 3);
    const dataBrasilia = hoje.toISOString().split('T')[0];
    setDataInicio(dataBrasilia);
    setDataFim(dataBrasilia);
  }, []);

  useEffect(() => {
    if (dataInicio && dataFim) {
      buscarDados(dataInicio, dataFim);
      buscarDadosVendedores(dataInicio, dataFim);
    }
  }, [dataInicio, dataFim]);

  // Filtros para lojas
  console.log('Total de dados recebidos:', dados.length);
  const dadosLojasFiltrados = dados.filter((item) => {
    const nomeFantasia = item.nome_fantasia?.toUpperCase() || '';
    console.log('Filtrando loja:', nomeFantasia, 'Tipo selecionado:', tipoLoja);
    
    if (tipoLoja === 'Franquias') {
      const isFranquia = nomeFantasia.includes('F0');
      console.log('É franquia?', isFranquia);
      return isFranquia;
    }
    
    if (tipoLoja === 'Proprias') {
      const isFranquia = nomeFantasia.includes('FRANQUIA') || 
                        nomeFantasia.includes('FRANCHISE') || 
                        nomeFantasia.includes('FRANQ') ||
                        nomeFantasia.includes('FRANCH');
      console.log('É própria?', !isFranquia);
      return !isFranquia;
    }
    
    return true;
  }).filter(item => {
    const temFaturamento = item.faturamento > 0;
    if (!temFaturamento) {
      console.log('Item sem faturamento:', item.nome_fantasia, 'Faturamento:', item.faturamento);
    }
    return temFaturamento;
  });

  console.log('Itens após filtros:', dadosLojasFiltrados.length);

  // Filtros para vendedores
  const dadosVendedoresFiltrados = dadosVendedores.filter((item) => {
    if (tipoLoja === 'Franquias')
      return item.nome_vendedor?.includes('VND') || item.nome_vendedor?.includes('ADM');
    if (tipoLoja === 'Proprias')
      return !item.nome_vendedor?.includes('VND') && !item.nome_vendedor?.includes('ADM');
    return true;
  }).filter(item => item.faturamento > 0);

  const totalFaturamentoLojas = dadosLojasFiltrados.reduce((acc, item) => acc + item.faturamento, 0);
  const totalFaturamentoVendedores = dadosVendedoresFiltrados.reduce((acc, item) => acc + item.faturamento, 0);

  // Cálculos para lojas
  const ticketMedioLojas = dadosLojasFiltrados.length > 0 
    ? dadosLojasFiltrados.reduce((acc, item) => acc + (item.faturamento / item.trasaida), 0) / dadosLojasFiltrados.length
    : 0;

  const paLojas = dadosLojasFiltrados.length > 0 
    ? dadosLojasFiltrados.reduce((acc, item) => {
        const pa = item.trasaida > 0 ? (Number(item.pasaida) - Number(item.paentrada)) / Number(item.trasaida) : 0;
        return acc + pa;
      }, 0) / dadosLojasFiltrados.length
    : 0;

  // Cálculos para vendedores
  const ticketMedioVendedores = dadosVendedoresFiltrados.length > 0 
    ? dadosVendedoresFiltrados.reduce((acc, item) => acc + (item.faturamento / item.trasaida), 0) / dadosVendedoresFiltrados.length
    : 0;

  const paVendedores = dadosVendedoresFiltrados.length > 0 
    ? dadosVendedoresFiltrados.reduce((acc, item) => {
        const pa = item.trasaida > 0 ? (Number(item.pasaida) - Number(item.paentrada)) / Number(item.trasaida) : 0;
        return acc + pa;
      }, 0) / dadosVendedoresFiltrados.length
    : 0;

  // Destaques
  const lojaDestaque = dadosLojasFiltrados.length > 0 ? dadosLojasFiltrados[0] : null;
  const vendedorDestaque = dadosVendedoresFiltrados.length > 0 ? dadosVendedoresFiltrados[0] : null;

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Ranking de Faturamento</h1>
        
        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg mb-6 border border-[#000638]/10">
          <div className="p-6 pb-4">
            <div className="flex items-center mb-2">
              <Funnel size={22} weight="bold" className="text-[#000638] mr-2" />
              <h2 className="text-xl font-semibold text-[#000638]">Filtros</h2>
            </div>
            <p className="text-sm text-gray-600">Selecione o período e tipo de loja para análise</p>
          </div>
          <div className="p-6 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1 text-[#000638]">Tipo de Loja</label>
              <select
                value={tipoLoja}
                onChange={(e) => setTipoLoja(e.target.value)}
                className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
              >
                <option value="Todos">Todos</option>
                <option value="Proprias">Próprias</option>
                <option value="Franquias">Franquias</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => {
                  buscarDados(dataInicio, dataFim);
                  buscarDadosVendedores(dataInicio, dataFim);
                }}
                disabled={loading || loadingVendedores}
                className={`flex items-center justify-center px-4 py-3 rounded-lg font-semibold text-white transition-colors ${
                  loading || loadingVendedores
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-[#000638] hover:bg-[#fe0000]'
                }`}
              >
                {loading || loadingVendedores ? (
                  <>
                    <Spinner size={20} className="animate-spin mr-2" />
                    <span>Atualizando...</span>
                  </>
                ) : (
                  <>
                    <ArrowClockwise size={20} className="mr-2" />
                    <span>Atualizar</span>
                  </>
                )}
              </button>

              <button
                onClick={exportarPDFLojas}
                disabled={dadosLojasFiltrados.length === 0}
                className={`flex items-center justify-center px-4 py-3 rounded-lg font-semibold text-white transition-colors ${
                  dadosLojasFiltrados.length === 0
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-[#000638] hover:bg-[#fe0000]'
                }`}
              >
                <FileText size={20} className="mr-2" />
                <span>Baixar Lojas</span>
              </button>

              <button
                onClick={exportarPDFVendedores}
                disabled={dadosVendedoresFiltrados.length === 0}
                className={`flex items-center justify-center px-4 py-3 rounded-lg font-semibold text-white transition-colors ${
                  dadosVendedoresFiltrados.length === 0
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-[#000638] hover:bg-[#fe0000]'
                }`}
              >
                <FileText size={20} className="mr-2" />
                <span>Baixar Vendedores</span>
              </button>
            </div>
          </div>
        </div>

        {/* Seletor de Ranking */}
        <div className="bg-white rounded-2xl shadow-lg mb-6 border border-[#000638]/10">
          <div className="p-6 pb-4">
            <div className="flex items-center mb-2">
              <ChartLineUp size={22} weight="bold" className="text-[#000638] mr-2" />
              <h2 className="text-xl font-semibold text-[#000638]">Tipo de Ranking</h2>
            </div>
            <p className="text-sm text-gray-600">Escolha entre ranking de lojas ou vendedores</p>
          </div>
          <div className="p-6 pt-0">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setRankingTipo('lojas')}
                className={`flex items-center justify-center px-4 py-3 rounded-lg border transition-colors ${
                  rankingTipo === 'lojas'
                    ? 'bg-[#000638] border-[#000638] text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Storefront size={20} className="mr-2" />
                <span className="font-semibold">Lojas</span>
              </button>
              
              <button
                onClick={() => setRankingTipo('vendedores')}
                className={`flex items-center justify-center px-4 py-3 rounded-lg border transition-colors ${
                  rankingTipo === 'vendedores'
                    ? 'bg-[#000638] border-[#000638] text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users size={20} className="mr-2" />
                <span className="font-semibold">Vendedores</span>
            </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {(loading || loadingVendedores) && (
          <div className="flex justify-center items-center py-12">
            <Spinner size={32} className="animate-spin text-[#000638] mr-3" />
            <span className="text-gray-600">Carregando dados...</span>
          </div>
        )}

        {/* Conteúdo quando não está carregando */}
        {!loading && !loadingVendedores && (
          <>
            {/* Cards de Métricas */}
            <div className="flex flex-wrap gap-4 mb-8 justify-center">
              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <CurrencyDollar size={18} className="text-blue-600" />
                    <CardTitle className="text-sm font-bold text-blue-700">Ticket Médio</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-2xl font-extrabold text-blue-600 mb-1">
                    {loading ? <Spinner size={24} className="animate-spin text-blue-600" /> : formatCurrency(rankingTipo === 'lojas' ? ticketMedioLojas : ticketMedioVendedores)}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {rankingTipo === 'lojas' ? 'Média das lojas' : 'Média dos vendedores'}
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <ChartLineUp size={18} className="text-purple-600" />
                    <CardTitle className="text-sm font-bold text-purple-700">Performance (PA)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-2xl font-extrabold text-purple-600 mb-1">
                    {loading ? <Spinner size={24} className="animate-spin text-purple-600" /> : (rankingTipo === 'lojas' ? paLojas : paVendedores).toFixed(2)}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {rankingTipo === 'lojas' ? 'Média das lojas' : 'Média dos vendedores'}
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <Storefront size={18} className="text-green-600" />
                    <CardTitle className="text-sm font-bold text-green-700">Total de {rankingTipo === 'lojas' ? 'Lojas' : 'Vendedores'}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-2xl font-extrabold text-green-600 mb-1">
                    {loading ? <Spinner size={24} className="animate-spin text-green-600" /> : (rankingTipo === 'lojas' ? dadosLojasFiltrados.length : dadosVendedoresFiltrados.length)}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {rankingTipo === 'lojas' ? 'Lojas' : 'Vendedores'} no período
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <CurrencyDollar size={18} className="text-orange-600" />
                    <CardTitle className="text-sm font-bold text-orange-700">Faturamento Total</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="text-2xl font-extrabold text-orange-600 mb-1 break-words">
                    {loading ? <Spinner size={24} className="animate-spin text-orange-600" /> : formatCurrency(rankingTipo === 'lojas' ? totalFaturamentoLojas : totalFaturamentoVendedores)}
                  </div>
                  <CardDescription className="text-xs text-gray-500">
                    {rankingTipo === 'lojas' ? 'Faturamento das lojas' : 'Faturamento dos vendedores'}
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-xl w-64 bg-white">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <Trophy size={18} className="text-yellow-600" />
                    <CardTitle className="text-sm font-bold text-yellow-700">
                      {rankingTipo === 'lojas' ? 'Loja Destaque' : 'Vendedor Destaque'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  {rankingTipo === 'lojas' ? (
                    lojaDestaque ? (
                      <>
                        <div className="text-lg font-bold text-yellow-600 mb-1 truncate">
                          {lojaDestaque.nome_fantasia || lojaDestaque.nome || 'Loja Destaque'}
                        </div>
                        <CardDescription className="text-xs text-gray-500 mb-2">1º Lugar no Ranking</CardDescription>
                        <div className="text-sm font-semibold text-yellow-600">
                          {formatCurrency(Number(lojaDestaque.faturamento))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-lg font-bold text-gray-400 mb-1">Nenhuma loja</div>
                        <CardDescription className="text-xs text-gray-400">Sem dados disponíveis</CardDescription>
                      </>
                    )
                  ) : (
                    vendedorDestaque ? (
                      <>
                        <div className="text-lg font-bold text-yellow-600 mb-1 truncate">
                          {vendedorDestaque.nome_vendedor || 'Vendedor Destaque'}
                        </div>
                        <CardDescription className="text-xs text-gray-500 mb-2">1º Lugar no Ranking</CardDescription>
                        <div className="text-sm font-semibold text-yellow-600">
                          {formatCurrency(Number(vendedorDestaque.faturamento))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-lg font-bold text-gray-400 mb-1">Nenhum vendedor</div>
                        <CardDescription className="text-xs text-gray-400">Sem dados disponíveis</CardDescription>
                      </>
                    )
                  )}
                </CardContent>
              </Card>
            </div>



            {/* Ranking */}
            <div className="bg-white rounded-2xl shadow-lg border border-[#000638]/10">
              <div className="p-6 pb-4">
                <div className="flex items-center mb-2">
                  {rankingTipo === 'lojas' ? (
                    <Storefront size={22} weight="bold" className="text-[#000638] mr-2" />
                  ) : (
                    <Users size={22} weight="bold" className="text-[#000638] mr-2" />
                  )}
                  <h2 className="text-xl font-semibold text-[#000638]">
                    Ranking de {rankingTipo === 'lojas' ? 'Lojas' : 'Vendedores'}
                  </h2>
                </div>
                <p className="text-sm text-gray-600">
                  {rankingTipo === 'lojas' ? 'lojas' : 'vendedores'} por faturamento
                </p>
              </div>
              <div className="p-6 pt-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          {rankingTipo === 'lojas' ? 'Loja' : 'Vendedor'}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-40">Faturamento</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">PA</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-40">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(rankingTipo === 'lojas' ? dadosLojasFiltrados : dadosVendedoresFiltrados).map((item) => (
                        <tr key={item.rank} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-bold text-blue-600">
                            {item.rank}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {rankingTipo === 'lojas' 
                              ? item.nome_fantasia || item.nome || `Loja ${item.rank}`
                              : item.nome_vendedor || `Vendedor ${item.rank}`
                            }
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">
                            {formatCurrency(Number(item.faturamento))}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.trasaida > 0 ? ((Number(item.pasaida) - Number(item.paentrada)) / Number(item.trasaida)).toFixed(2) : '0.00'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.trasaida > 0 ? formatCurrency(item.faturamento / item.trasaida) : 'R$ 0,00'}
                          </td>
                        </tr>
                      ))}

                      {(rankingTipo === 'lojas' ? dadosLojasFiltrados : dadosVendedoresFiltrados).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                            Nenhum {rankingTipo === 'lojas' ? 'loja' : 'vendedor'} encontrado para o período selecionado
                          </td>
                        </tr>
                  )}
                </tbody>
              </table>
            </div>
              </div>
            </div>
          </>
          )}
      </div>
    </Layout>
  );
};

export default RankingFaturamento; 