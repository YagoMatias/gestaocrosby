import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/cards';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Plus, 
  User, 
  Trophy, 
  Target, 
  Calendar, 
  Download, 
  Funnel, 
  Spinner,
  CurrencyDollar,
  Users,
  Star,
  ChartLine
} from '@phosphor-icons/react';

// Função utilitária para carregar imagem como base64
function getBase64Image(imgUrl, callback) {
  const img = new window.Image();
  img.crossOrigin = 'Anonymous';
  img.onload = function () {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const dataURL = canvas.toDataURL('image/png');
    callback(dataURL);
  };
  img.src = imgUrl;
}

const RankingVendedores = () => {
  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(true);
  const [tipoLoja, setTipoLoja] = useState('Todos');

  const BaseURL = 'https://apigestaocrosby.onrender.com/';

  const buscarDados = async (inicio = dataInicio, fim = dataFim) => {
    if (!inicio || !fim) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${BaseURL}rankingvendedor?inicio=${inicio}&fim=${fim}`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Resposta da API:', data); // Debug
      console.log('Tipo de dados:', typeof data);
      console.log('É array?', Array.isArray(data));
      if (data && typeof data === 'object') {
        console.log('Propriedades do objeto:', Object.keys(data));
        if (data.dados) {
          console.log('Dados encontrados:', data.dados);
          console.log('Quantidade de registros:', data.dados.length);
        }
      }
      
      // Verificar se data é um array
      let dadosArray = [];
      if (Array.isArray(data)) {
        dadosArray = data;
      } else if (data && typeof data === 'object') {
        // Se for um objeto, tentar extrair array de propriedades
        if (data.dados && Array.isArray(data.dados)) {
          dadosArray = data.dados;
        } else if (data.data && Array.isArray(data.data)) {
          dadosArray = data.data;
        } else if (data.result && Array.isArray(data.result)) {
          dadosArray = data.result;
        } else if (data.vendedores && Array.isArray(data.vendedores)) {
          dadosArray = data.vendedores;
        } else {
          // Se não encontrar array, converter objeto em array
          dadosArray = Object.values(data);
        }
      } else {
        console.error('Formato de dados inesperado:', data);
        setDados([]);
        return;
      }
      
      // Filtrar apenas itens com faturamento válido e excluir vendedor "GERAL"
      const dadosValidos = dadosArray.filter(item => 
        item && typeof item === 'object' && 
        (item.faturamento || item.faturamento === 0) &&
        // Excluir vendedor "GERAL"
        !(item.nome_vendedor && item.nome_vendedor.toString().toUpperCase().includes('GERAL')) &&
        !(item.nome && item.nome.toString().toUpperCase().includes('GERAL')) &&
        !(item.vendedor && item.vendedor.toString().toUpperCase().includes('GERAL'))
      );
      
      const ordenado = [...dadosValidos].sort((a, b) => (b.faturamento || 0) - (a.faturamento || 0));
      const comRank = ordenado.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
      
      console.log('Dados finais processados:', comRank);
      setDados(comRank);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setDados([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusByRank = (rank) => {
    if (rank === 1) return 'destaque';
    if (rank <= 3) return 'ativo';
    return 'regular';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const exportarPDF = () => {
    getBase64Image('/crosbyazul.png', (imgData) => {
      const doc = new jsPDF();
      // Adiciona a imagem no topo (ajuste largura/altura conforme necessário)
      doc.addImage(imgData, 'PNG', 14, 8, 40, 16);
      doc.text('Ranking de Vendedores', 80, 32);
      
      const tableColumn = ['#', 'Vendedor', 'Faturamento', 'PA', 'Ticket Médio'];
      const tableRows = dados
        .filter(item => {
          // Excluir vendedor "GERAL" do PDF também
          const nomeVendedor = item.nome_vendedor || item.nome || item.vendedor || '';
          return !nomeVendedor.toString().toUpperCase().includes('GERAL');
        })
        .map(item => {
          // Normalizar campos para diferentes possíveis nomes
          const nomeVendedor = item.nome_vendedor || item.nome || item.vendedor || '-';
          const faturamento = item.faturamento || item.valor || 0;
          const trasaida = item.trasaida || item.transacoes || 0;
          const pasaida = item.pasaida || item.pa_saida || 0;
          const paentrada = item.paentrada || item.pa_entrada || 0;
          
          const pa = trasaida > 0 ? (Number(pasaida) - Number(paentrada)) / Number(trasaida) : 0;
          const ticketMedio = trasaida > 0 ? Number(faturamento) / Number(trasaida) : 0;
          
          return [
            item.rank,
            nomeVendedor,
            formatCurrency(faturamento),
            pa.toFixed(2),
            formatCurrency(ticketMedio)
          ];
        });
      
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 38,
        styles: { fontSize: 10, textColor: [0, 0, 0] },
        headStyles: { fillColor: [0, 6, 56], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        rowStyles: { fillColor: [255, 255, 255] },
      });
      doc.save('ranking_vendedores.pdf');
    });
  };

  useEffect(() => {
    const hoje = new Date();
    hoje.setUTCHours(hoje.getUTCHours() - 3);
    const dataBrasilia = hoje.toISOString().split('T')[0];
    setDataInicio(dataBrasilia);
    setDataFim(dataBrasilia);
    
    // Aguardar um pouco antes de fazer a primeira busca
    setTimeout(() => {
      buscarDados(dataBrasilia, dataBrasilia);
    }, 100);
  }, []);

  const dadosFiltrados = dados.filter((item) => {
    // Normalizar nomes de campos
    const nomeVendedor = item.nome_vendedor || item.nome || item.vendedor || '';
    const faturamento = item.faturamento || item.valor || 0;
    
    // Excluir vendedor "GERAL"
    if (nomeVendedor.toString().toUpperCase().includes('GERAL')) {
      return false;
    }
    
    if (tipoLoja === 'Franquias')
      return nomeVendedor.includes('VND') || nomeVendedor.includes('ADM');
    if (tipoLoja === 'Proprias')
      return !nomeVendedor.includes('VND') && !nomeVendedor.includes('ADM');
    return true;
  }).filter(item => (item.faturamento || item.valor || 0) > 0);

  const totalFaturamento = dadosFiltrados.reduce((acc, item) => acc + (item.faturamento || item.valor || 0), 0);
  const totalVendedores = dadosFiltrados.length;
  const ticketMedio = totalVendedores > 0 
    ? dadosFiltrados.reduce((acc, item) => {
        const faturamento = item.faturamento || item.valor || 0;
        const trasaida = item.trasaida || item.transacoes || 1;
        return acc + (faturamento / trasaida);
      }, 0) / totalVendedores
    : 0;
  const topPerformer = dadosFiltrados.length > 0 ? dadosFiltrados[0] : null;

  return (
    <Layout>
      <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#000638]">Ranking Vendedores</h1>
            <p className="text-gray-600 mt-2">Gestão da equipe de vendas e performance individual</p>
          </div>
          <button 
            onClick={exportarPDF} 
            disabled={dados.length === 0}
            className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-xl hover:bg-[#fe0000] transition text-sm font-semibold shadow-md tracking-wide uppercase disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={20} />
            Baixar PDF
          </button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users size={24} className="text-blue-600" />
                <CardTitle className="text-lg text-gray-800">Total de Vendedores</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{totalVendedores}</div>
              <p className="text-sm text-gray-500 mt-1">Ativos no período</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={24} className="text-green-600" />
                <CardTitle className="text-lg text-gray-800">Faturamento Total</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 break-words">
                {totalFaturamento.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-sm text-gray-500 mt-1">Vendas no período</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Trophy size={24} className="text-purple-600" />
                <CardTitle className="text-lg text-gray-800">Top Performer</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
                                        <div className="text-lg font-bold text-purple-600 truncate">
                            {topPerformer ? (topPerformer.nome_vendedor || topPerformer.nome || topPerformer.vendedor) : 'N/A'}
                          </div>
                          <p className="text-sm text-gray-500 mt-1 break-words">
                            {topPerformer ? (topPerformer.faturamento || topPerformer.valor || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }) : 'Sem dados'}
                          </p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ChartLine size={24} className="text-orange-600" />
                <CardTitle className="text-lg text-gray-800">Ticket Médio</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 break-words">
                {ticketMedio.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-sm text-gray-500 mt-1">Média por vendedor</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Tabela */}
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Funnel size={24} className="text-[#000638]" />
              <CardTitle className="text-xl text-[#000638]">Filtros de Consulta</CardTitle>
            </div>
            <CardDescription>Selecione o período e tipo de loja para análise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <label htmlFor="data-inicio" className="block text-sm font-medium text-gray-700 mb-1">
                  Data Início
                </label>
                <input
                  type="date"
                  id="data-inicio"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="data-fim" className="block text-sm font-medium text-gray-700 mb-1">
                  Data Fim
                </label>
                <input
                  type="date"
                  id="data-fim"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="tipo-loja" className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Loja
                </label>
                <select
                  id="tipo-loja"
                  value={tipoLoja}
                  onChange={(e) => setTipoLoja(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Todos">TODAS</option>
                  <option value="Franquias">FRANQUIAS</option>
                  <option value="Proprias">PRÓPRIAS</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                  onClick={() => buscarDados()}
                  disabled={loading || !dataInicio || !dataFim}
                >
                  {loading ? (
                    <>
                      <Spinner size={20} className="animate-spin" />
                      <span className="hidden sm:inline">Buscando...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Calendar size={20} />
                      <span className="hidden sm:inline">Buscar Dados</span>
                      <span className="sm:hidden">Buscar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="flex items-center gap-3">
                  <Spinner size={32} className="animate-spin text-blue-600" />
                  <span className="text-gray-600">Carregando dados...</span>
                </div>
              </div>
            ) : dados.length === 0 ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">Nenhum dado encontrado</div>
                  <div className="text-gray-400 text-sm">Verifique o período selecionado ou tente novamente</div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <table className="w-full border-collapse rounded-lg overflow-hidden shadow-lg">
                    <thead className="bg-[#000638] text-white text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs">#</th>
                        <th className="px-4 py-3 text-left text-xs">Vendedor</th>
                        <th className="px-4 py-3 text-center text-xs">Status</th>
                        <th className="px-4 py-3 text-center text-xs">
                          Faturamento (R$)
                        </th>
                        <th className="px-4 py-3 text-center text-xs">PA</th>
                        <th className="px-4 py-3 text-center text-xs">
                          Ticket Médio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosFiltrados.map((item) => (
                        <tr
                          key={item.cd_grupoempresa}
                          className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 text-sm border-b transition-colors"
                        >
                          <td className="px-4 py-3 text-center font-bold text-blue-700 text-xs">
                            {item.rank === 1 && <Trophy size={16} className="inline mr-1 text-yellow-500" />}
                            {item.rank}
                          </td>
                          <td
                            className="px-4 py-3 font-medium text-xs"
                            title={item.nome_vendedor || item.nome || item.vendedor}
                          >
                            {item.nome_vendedor || item.nome || item.vendedor}
                          </td>
                          <td className="px-4 py-3 text-center text-xs">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              getStatusByRank(item.rank) === 'destaque' 
                                ? 'bg-green-100 text-green-800' 
                                : getStatusByRank(item.rank) === 'ativo'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {getStatusByRank(item.rank)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-green-600 text-xs">
                            {(item.faturamento || item.valor || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </td>
                          <td className="px-4 py-3 text-center text-xs">
                            {(() => {
                              const pasaida = item.pasaida || item.pa_saida || 0;
                              const paentrada = item.paentrada || item.pa_entrada || 0;
                              const trasaida = item.trasaida || item.transacoes || 1;
                              return Number.parseFloat((+pasaida - +paentrada) / +trasaida).toFixed(2);
                            })()}
                          </td>
                          <td className="px-4 py-3 text-center text-xs">
                            R${' '}
                            {(() => {
                              const faturamento = item.faturamento || item.valor || 0;
                              const trasaida = item.trasaida || item.transacoes || 1;
                              return Math.floor(faturamento / trasaida).toFixed(2).replace('.', ',');
                            })()}
                          </td>
                        </tr>
                      ))}
                      {dadosFiltrados.length === 0 && !loading && (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-gray-500 text-sm">
                            Nenhum vendedor encontrado para o período selecionado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RankingVendedores; 