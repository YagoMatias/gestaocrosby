import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import LoadingCircle from '../components/LoadingCircle';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// Importe outros componentes de UI do projeto conforme necessário

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

const RankingFaturamento = () => {
  const [dados, setDados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoje = new Date();
    const dataBrasilia = hoje.toISOString().split('T')[0];
    setDataInicio(dataBrasilia);
    setDataFim(dataBrasilia);
  }, []);

  const buscarDados = async (inicio, fim) => {
    setLoading(true);
    try {
      const res = await fetch(`https://apigestaocrosby.onrender.com/faturamentolojas?cd_grupoempresa_ini=1&cd_grupoempresa_fim=8000&dt_inicio=${inicio}&dt_fim=${fim}`);
      const data = await res.json();
      const ordenado = [...data].sort((a, b) => b.faturamento - a.faturamento);
      const comRank = ordenado.map((item, index) => ({ ...item, rank: index + 1 }));
      setDados(comRank);
    } catch (err) {
      alert('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
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
      doc.text('Ranking de Faturamento', 80, 32);
      const tableColumn = ['#', 'Loja', 'Faturamento', 'PA', 'Ticket Médio'];
      const tableRows = dados.map(item => {
        const pa = item.trasaida > 0 ? (Number(item.pasaida) - Number(item.paentrada)) / Number(item.trasaida) : 0;
        const ticketMedio = item.trasaida > 0 ? Number(item.faturamento) / Number(item.trasaida) : 0;
        return [
          item.rank,
          item.nome_fantasia || item.nome || '-',
          formatCurrency(item.faturamento),
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
      doc.save('ranking_faturamento.pdf');
    });
  };

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4 pb-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#000638]">Ranking Faturamento</h1>
        {/* Filtros */}
        <div className="mb-8">
          <form className="flex flex-col bg-white p-8 rounded-2xl shadow-lg w-full max-w-5xl mx-auto border border-[#000638]/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 w-full mb-6">
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Inicial</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Final</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] placeholder:text-gray-400" />
              </div>
            </div>
            <div className="flex justify-end w-full mt-8">
              <button type="button" onClick={() => buscarDados(dataInicio, dataFim)} className="flex items-center gap-2 bg-[#000638] text-white px-10 py-3 rounded-xl hover:bg-[#fe0000] transition h-12 text-base font-bold shadow-md tracking-wide uppercase">
                PESQUISAR
              </button>
            </div>
          </form>
        </div>
        {/* Tabela Ranking */}
        <div className="rounded-2xl shadow-lg bg-white mt-8 border border-[#000638]/10">
          <div className="p-4 border-b border-[#000638]/10 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#000638]">Ranking de Lojas por Faturamento</h2>
            <button onClick={exportarPDF} className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-xl hover:bg-[#fe0000] transition text-sm font-semibold shadow-md tracking-wide uppercase">
              Baixar PDF
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-12"><LoadingCircle size={32} /> Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-4 py-2 font-semibold">#</th>
                    <th className="px-4 py-2 font-semibold">Loja</th>
                    <th className="px-4 py-2 font-semibold">Faturamento</th>
                    <th className="px-4 py-2 font-semibold">PA</th>
                    <th className="px-4 py-2 font-semibold">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                  ) : (
                    dados.map((item) => {
                      const pa = item.trasaida > 0 ? (Number(item.pasaida) - Number(item.paentrada)) / Number(item.trasaida) : 0;
                      const ticketMedio = item.trasaida > 0 ? Number(item.faturamento) / Number(item.trasaida) : 0;
                      return (
                        <tr key={item.rank} className="border-b hover:bg-[#f8f9fb]">
                          <td className="px-4 py-2 text-blue-600 font-bold">{item.rank}</td>
                          <td className="px-4 py-2">{item.nome_fantasia || item.nome || '-'}</td>
                          <td className="px-4 py-2 text-green-600 font-bold">{formatCurrency(item.faturamento)}</td>
                          <td className="px-4 py-2 text-purple-600 font-bold">{pa.toFixed(2)}</td>
                          <td className="px-4 py-2 text-blue-700 font-bold">{formatCurrency(ticketMedio)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RankingFaturamento; 