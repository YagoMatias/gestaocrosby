import React, { useState } from 'react';
import { Funnel, Calendar, Spinner, Package, ArrowsClockwise, CaretUp, CaretDown, CaretUpDown, CaretRight, Warning, ArrowDown, ArrowUp } from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import custoProdutos from '../custoprodutos.json';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Modal from '../components/ui/Modal';

const AuditoriaCMV = () => {
  const apiClient = useApiClient();

  const [filtros, setFiltros] = useState({ dt_inicio: '', dt_fim: '' });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'valorTotal', direction: 'desc' });
  const [rankingOpen, setRankingOpen] = useState(true);
  const [semCustoOpen, setSemCustoOpen] = useState(false);
  const [semCustoCount, setSemCustoCount] = useState(0);
  const [semCustoItens, setSemCustoItens] = useState([]);
  const [semCustoModalOpen, setSemCustoModalOpen] = useState(false);
  const [cmvBaixoCount, setCmvBaixoCount] = useState(0);
  const [cmvBaixoItens, setCmvBaixoItens] = useState([]);
  const [cmvBaixoModalOpen, setCmvBaixoModalOpen] = useState(false);
  const [cmvAltoCount, setCmvAltoCount] = useState(0);
  const [cmvAltoItens, setCmvAltoItens] = useState([]);
  const [cmvAltoModalOpen, setCmvAltoModalOpen] = useState(false);

  // Map rápido: Modelo -> Custo (usa primeiro custo encontrado por modelo)
  const modeloParaCustoMap = React.useMemo(() => {
    const map = new Map();
    try {
      if (Array.isArray(custoProdutos)) {
        for (const item of custoProdutos) {
          const modelo = (item?.Modelo || '').toString().trim().toUpperCase();
          if (!modelo) continue;
          const custo = item?.Custo;
          if (!map.has(modelo) && custo !== undefined) {
            map.set(modelo, Number(custo));
          }
        }
      }
    } catch {}
    return map;
  }, []);

  // Map: Código -> Custo (para colunas de custo, cmv, etc.)
  const custoMap = React.useMemo(() => {
    const map = {};
    try {
      if (Array.isArray(custoProdutos)) {
        for (const item of custoProdutos) {
          const codigo = (item?.Codigo || '').toString().trim();
          if (!codigo) continue;
          if (item?.Custo !== undefined) map[codigo] = Number(item.Custo);
        }
      }
    } catch {}
    return map;
  }, []);

  // Mesma lógica de fontes do Consolidado
  const empresasFixas = ['2', '200', '75', '31', '6', '85', '11'];
  const empresasVarejoFixas = ['2', '5', '500', '55', '550', '65', '650', '93', '930', '94', '940', '95', '950', '96', '960', '97', '970'];

  const handleFiltrar = async (e) => {
    e?.preventDefault?.();
    if (!filtros.dt_inicio || !filtros.dt_fim) return;
    setLoading(true);
    setErro('');
    
    try {
      // Buscar dados de todos os canais
      const [resultRevenda, resultVarejo, resultFranquia, resultMtm] = await Promise.all([
        apiClient.sales.faturamentoRevenda({
          dt_inicio: filtros.dt_inicio,
          dt_fim: filtros.dt_fim,
          cd_empresa: empresasFixas
        }),
        apiClient.sales.faturamento({
          dt_inicio: filtros.dt_inicio,
          dt_fim: filtros.dt_fim,
          cd_empresa: empresasVarejoFixas
        }),
        apiClient.sales.faturamentoFranquia({
          dt_inicio: filtros.dt_inicio,
          dt_fim: filtros.dt_fim,
          cd_empresa: empresasFixas
        }),
        apiClient.sales.faturamentoMtm({
          dt_inicio: filtros.dt_inicio,
          dt_fim: filtros.dt_fim,
          cd_empresa: empresasFixas
        })
      ]);

      const dadosRevenda = resultRevenda?.success ? resultRevenda.data : [];
      const dadosVarejo = resultVarejo?.success ? resultVarejo.data : [];
      const dadosFranquia = resultFranquia?.success ? resultFranquia.data : [];
      const dadosMtm = resultMtm?.success ? resultMtm.data : [];

      // Combinar todos os dados
      const todosDados = [...dadosRevenda, ...dadosVarejo, ...dadosFranquia, ...dadosMtm];
      setDados(todosDados);

      // Montar base por produto (cd_nivel) para cálculos, incluindo receita e quantidade
      const porProduto = new Map();
      for (const row of todosDados) {
        const cd = (row?.cd_nivel || '').toString().trim();
        if (!cd) continue;
        const modelo = (row?.ds_nivel || '').toString().trim();
        const qt = Number(row?.qt_faturado) || 0;
        const vlUnit = Number(row?.vl_unitliquido) || 0;
        const valor = vlUnit * qt;
        if (!porProduto.has(cd)) {
          porProduto.set(cd, { cd_nivel: cd, modelo, receita: 0, quantidade: 0 });
        }
        const acc = porProduto.get(cd);
        if (row?.tp_operacao === 'S') {
          acc.receita += valor;
          acc.quantidade += qt;
        } else if (row?.tp_operacao === 'E') {
          acc.receita -= valor;
          acc.quantidade -= qt;
        }
      }

      // Sem custo por MODELO
      const semCustoLista = [];
      for (const { cd_nivel, modelo } of porProduto.values()) {
        const custoModelo = modelo ? modeloParaCustoMap.get(modelo.toUpperCase()) : undefined;
        if (custoModelo === undefined) {
          semCustoLista.push({ cd_nivel, modelo, custo: 0 });
        }
      }
      setSemCustoItens(semCustoLista);
      setSemCustoCount(semCustoLista.length);

             // CMV baixo (< 10%) por código com custo disponível
       const cmvBaixoLista = [];
       for (const item of porProduto.values()) {
         const custoUnit = custoMap[item.cd_nivel];
         if (custoUnit === undefined) continue; // precisa ter custo
         if ((item?.receita || 0) <= 0) continue; // precisa ter receita positiva
         const custoTotal = (item.quantidade || 0) * custoUnit;
         const cmv = custoTotal / item.receita;
         if (cmv < 0.10) {
           cmvBaixoLista.push({ 
             cd_nivel: item.cd_nivel, 
             modelo: item.modelo, 
             quantidade: item.quantidade,
             custo: custoTotal, 
             cmv: cmv * 100 
           });
         }
       }
      setCmvBaixoItens(cmvBaixoLista);
      setCmvBaixoCount(cmvBaixoLista.length);

             // CMV alto (> 70%) por código com custo disponível
       const cmvAltoLista = [];
       for (const item of porProduto.values()) {
         const custoUnit = custoMap[item.cd_nivel];
         if (custoUnit === undefined) continue; // precisa ter custo
         if ((item?.receita || 0) <= 0) continue; // precisa ter receita positiva
         const custoTotal = (item.quantidade || 0) * custoUnit;
         const cmv = custoTotal / item.receita;
         if (cmv > 0.70) {
           cmvAltoLista.push({ 
             cd_nivel: item.cd_nivel, 
             modelo: item.modelo, 
             quantidade: item.quantidade,
             custo: custoTotal, 
             cmv: cmv * 100 
           });
         }
       }
      setCmvAltoItens(cmvAltoLista);
      setCmvAltoCount(cmvAltoLista.length);
      
    } catch (err) {
      console.error('Erro ao buscar Auditoria CMV:', err);
      setErro('Erro ao buscar dados. Tente novamente.');
      setSemCustoItens([]);
      setSemCustoCount(0);
      setCmvBaixoItens([]);
      setCmvBaixoCount(0);
      setCmvAltoItens([]);
      setCmvAltoCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Função para ordenar os dados do ranking
  const sortRankData = (data) => {
    if (!data || data.length === 0) return data;

    return [...data].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'rank':
          aValue = a.valorTotal || 0;
          bValue = b.valorTotal || 0;
          break;
        case 'cd_nivel':
          aValue = a.cd_nivel || '';
          bValue = b.cd_nivel || '';
          break;
        case 'modelo':
          aValue = a.modelo || '';
          bValue = b.modelo || '';
          break;
        case 'quantidade':
          aValue = a.quantidade || 0;
          bValue = b.quantidade || 0;
          break;
        case 'valorTotal':
          aValue = a.valorTotal || 0;
          bValue = b.valorTotal || 0;
          break;
        case 'valorBrutoTotal':
          aValue = a.valorBrutoTotal || 0;
          bValue = b.valorBrutoTotal || 0;
          break;
        case 'desconto':
          aValue = (a.valorBrutoTotal || 0) - (a.valorTotal || 0);
          bValue = (b.valorBrutoTotal || 0) - (b.valorTotal || 0);
          break;
        case 'custo':
          aValue = custoMap[a.cd_nivel?.trim()] !== undefined ? (a.quantidade || 0) * custoMap[a.cd_nivel.trim()] : 0;
          bValue = custoMap[b.cd_nivel?.trim()] !== undefined ? (b.quantidade || 0) * custoMap[b.cd_nivel.trim()] : 0;
          break;
        case 'cmv':
          const aCustoUnit = custoMap[a.cd_nivel?.trim()];
          const bCustoUnit = custoMap[b.cd_nivel?.trim()];
          const aCustoTotal = aCustoUnit !== undefined ? (a.quantidade || 0) * aCustoUnit : 0;
          const bCustoTotal = bCustoUnit !== undefined ? (b.quantidade || 0) * bCustoUnit : 0;
          aValue = (a.valorTotal || 0) > 0 ? aCustoTotal / (a.valorTotal || 0) : 0;
          bValue = (b.valorTotal || 0) > 0 ? bCustoTotal / (b.valorTotal || 0) : 0;
          break;
        case 'markup':
          const aMarkupCustoUnit = custoMap[a.cd_nivel?.trim()];
          const bMarkupCustoUnit = custoMap[b.cd_nivel?.trim()];
          const aMarkupCustoTotal = aMarkupCustoUnit !== undefined ? (a.quantidade || 0) * aMarkupCustoUnit : 0;
          const bMarkupCustoTotal = bMarkupCustoUnit !== undefined ? (b.quantidade || 0) * bMarkupCustoUnit : 0;
          aValue = aMarkupCustoTotal > 0 ? (a.valorTotal || 0) / aMarkupCustoTotal : 0;
          bValue = bMarkupCustoTotal > 0 ? (b.valorTotal || 0) / bMarkupCustoTotal : 0;
          break;
        case 'margem':
          const aMargemCustoUnit = custoMap[a.cd_nivel?.trim()];
          const bMargemCustoUnit = custoMap[b.cd_nivel?.trim()];
          const aMargemCustoTotal = aMargemCustoUnit !== undefined ? (a.quantidade || 0) * aMargemCustoUnit : 0;
          const bMargemCustoTotal = bMargemCustoUnit !== undefined ? (b.quantidade || 0) * bMargemCustoUnit : 0;
          aValue = (a.valorTotal || 0) > 0 ? ((a.valorTotal || 0) - aMargemCustoTotal) / (a.valorTotal || 0) : 0;
          bValue = (b.valorTotal || 0) > 0 ? ((b.valorTotal || 0) - bMargemCustoTotal) / (b.valorTotal || 0) : 0;
          break;
        default:
          aValue = a[sortConfig.key] || 0;
          bValue = b[sortConfig.key] || 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <CaretUpDown size={12} className="opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? <CaretUp size={12} /> : <CaretDown size={12} />;
  };

  const exportarRankParaExcel = () => {
    try {
      // Agrupa por cd_nivel e soma os valores
      const rankProdutos = dados.reduce((acc, row) => {
        const nivel = row.cd_nivel;
        if (!acc[nivel]) {
          acc[nivel] = {
            cd_nivel: nivel,
            modelo: row.ds_nivel,
            valorTotal: 0,
            valorBrutoTotal: 0,
            quantidade: 0
          };
        }
        const qtFaturado = Number(row.qt_faturado) || 1;
        const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
        const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
        if (row.tp_operacao === 'S') {
          acc[nivel].valorTotal += valor;
          acc[nivel].valorBrutoTotal += valorBruto;
          acc[nivel].quantidade += qtFaturado;
        } else if (row.tp_operacao === 'E') {
          acc[nivel].valorTotal -= valor;
          acc[nivel].valorBrutoTotal -= valorBruto;
          acc[nivel].quantidade -= qtFaturado;
        }
        return acc;
      }, {});

      const rankArray = sortRankData(Object.values(rankProdutos));

      const dadosParaExportar = rankArray.map((produto, index) => {
        const descontoTotal = produto.valorBrutoTotal - produto.valorTotal;
        const custoUnit = custoMap[produto.cd_nivel?.trim()];
        const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : 0;
        const cmv = produto.valorTotal > 0 ? (custoTotal / produto.valorTotal) * 100 : 0;
        const markup = custoTotal > 0 ? produto.valorTotal / custoTotal : 0;
        const margem = produto.valorTotal > 0 ? ((produto.valorTotal - custoTotal) / produto.valorTotal) * 100 : 0;

        return {
          'Rank': index + 1,
          'Código': produto.cd_nivel || '',
          'Modelo': produto.modelo || '',
          'Quantidade': produto.quantidade,
          'Valor Total': produto.valorTotal,
          'Valor Bruto': produto.valorBrutoTotal,
          'Desconto': descontoTotal,
          'Custo': custoTotal,
          'CMV %': cmv,
          'Markup': markup,
          'Margem %': margem
        };
      });

      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ranking Produtos');
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const hoje = new Date().toISOString().slice(0,10);
      saveAs(blob, `ranking-produtos-auditoria-cmv-${hoje}.xlsx`);
    } catch (e) {
      console.error('Erro ao exportar Excel:', e);
      alert('Erro ao exportar Excel.');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#000638] font-barlow">Auditoria CMV</h1>
      </div>

      {/* Filtros */}
      <form onSubmit={handleFiltrar} className="flex flex-col bg-white p-6 rounded-2xl shadow-lg w-full border border-[#000638]/10 mb-6">
        <div className="mb-4 flex items-center gap-2 text-[#000638]">
          <Funnel size={20} />
          <span className="text-lg font-bold font-barlow">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Início</label>
            <input
              type="date"
              value={filtros.dt_inicio}
              onChange={(e) => setFiltros({ ...filtros, dt_inicio: e.target.value })}
              className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-[#000638]">Data Fim</label>
            <input
              type="date"
              value={filtros.dt_fim}
              onChange={(e) => setFiltros({ ...filtros, dt_fim: e.target.value })}
              className="border border-[#000638]/30 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638]"
            />
          </div>
          <div className="flex items-center">
            <button
              type="submit"
              className="flex items-center gap-2 bg-[#000638] text-white px-4 py-2 rounded-lg hover:bg-[#fe0000] transition h-10 text-sm font-bold shadow-md tracking-wide uppercase w-full sm:w-auto"
              disabled={loading || !filtros.dt_inicio || !filtros.dt_fim}
            >
              {loading ? <Spinner size={18} className="animate-spin" /> : <Calendar size={18} />}
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
        {erro && (
          <div className="mt-3 text-sm text-red-600">{erro}</div>
        )}
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Produtos sem custo */}
        <button
          type="button"
          onClick={() => setSemCustoModalOpen(true)}
          className="w-full text-left bg-white rounded-2xl shadow-lg border border-[#000638]/10 p-5 hover:shadow-xl transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Produtos sem custo</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '-' : semCustoCount.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-500 mt-1">Com base no Modelo no arquivo de custos</p>
            </div>
            <div className="p-3 rounded-full bg-red-500">
              <Warning size={24} className="text-white" />
            </div>
          </div>
        </button>
        {/* CMV baixo (< 10%) */}
        <button
          type="button"
          onClick={() => setCmvBaixoModalOpen(true)}
          className="w-full text-left bg-white rounded-2xl shadow-lg border border-[#000638]/10 p-5 hover:shadow-xl transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">CMV muito baixo ( &lt; 10% )</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '-' : cmvBaixoCount.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-500 mt-1">Produtos com CMV calculado menor que 10%</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-500">
              <ArrowDown size={24} className="text-white" />
            </div>
          </div>
        </button>
        {/* CMV alto (> 70%) */}
        <button
          type="button"
          onClick={() => setCmvAltoModalOpen(true)}
          className="w-full text-left bg-white rounded-2xl shadow-lg border border-[#000638]/10 p-5 hover:shadow-xl transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">CMV muito alto ( &gt; 70% )</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '-' : cmvAltoCount.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-500 mt-1">Produtos com CMV calculado maior que 70%</p>
            </div>
            <div className="p-3 rounded-full bg-red-500">
              <ArrowUp size={24} className="text-white" />
            </div>
          </div>
        </button>
      </div>

      {/* Modal: Produtos sem custo */}
      <Modal
        isOpen={semCustoModalOpen}
        onClose={() => setSemCustoModalOpen(false)}
        title={`Produtos sem custo (${semCustoItens.length})`}
        size="5xl"
      >
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#000638] text-white">
                <th className="px-2 py-2 text-left text-[11px]">Código</th>
                <th className="px-2 py-2 text-left text-[11px]">Modelo</th>
                <th className="px-2 py-2 text-right text-[11px]">Custo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="text-center py-8"><Spinner size={24} className="animate-spin" /></td></tr>
              ) : semCustoItens.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8">Nenhum produto sem custo encontrado.</td></tr>
              ) : (
                semCustoItens.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-2">{item.cd_nivel || '-'}</td>
                    <td className="px-2 py-2">{item.modelo || '-'}</td>
                    <td className="px-2 py-2 text-right">{(0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>

             {/* Modal: CMV muito baixo (< 10%) */}
       <Modal
         isOpen={cmvBaixoModalOpen}
         onClose={() => setCmvBaixoModalOpen(false)}
         title={`CMV muito baixo (< 10%) - ${cmvBaixoItens.length} produto(s)`}
         size="5xl"
       >
         <div className="overflow-x-auto rounded-lg border border-gray-200">
           <table className="min-w-full text-sm">
             <thead>
               <tr className="bg-[#000638] text-white">
                 <th className="px-2 py-2 text-left text-[11px]">Código</th>
                 <th className="px-2 py-2 text-left text-[11px]">Modelo</th>
                 <th className="px-2 py-2 text-center text-[11px]">Quantidade</th>
                 <th className="px-2 py-2 text-right text-[11px]">Custo</th>
                 <th className="px-2 py-2 text-right text-[11px]">CMV %</th>
               </tr>
             </thead>
             <tbody>
               {loading ? (
                 <tr><td colSpan={5} className="text-center py-8"><Spinner size={24} className="animate-spin" /></td></tr>
               ) : cmvBaixoItens.length === 0 ? (
                 <tr><td colSpan={5} className="text-center py-8">Nenhum produto com CMV baixo encontrado.</td></tr>
               ) : (
                 cmvBaixoItens.map((item, idx) => (
                   <tr key={idx} className="border-b hover:bg-gray-50">
                     <td className="px-2 py-2">{item.cd_nivel || '-'}</td>
                     <td className="px-2 py-2">{item.modelo || '-'}</td>
                     <td className="px-2 py-2 text-center">{item.quantidade?.toLocaleString('pt-BR') || '-'}</td>
                     <td className="px-2 py-2 text-right">{item.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                     <td className="px-2 py-2 text-right">{item.cmv != null ? item.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '-'}</td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
         </div>
       </Modal>

             {/* Modal: CMV muito alto (> 70%) */}
       <Modal
         isOpen={cmvAltoModalOpen}
         onClose={() => setCmvAltoModalOpen(false)}
         title={`CMV muito alto (> 70%) - ${cmvAltoItens.length} produto(s)`}
         size="5xl"
       >
         <div className="overflow-x-auto rounded-lg border border-gray-200">
           <table className="min-w-full text-sm">
             <thead>
               <tr className="bg-[#000638] text-white">
                 <th className="px-2 py-2 text-left text-[11px]">Código</th>
                 <th className="px-2 py-2 text-left text-[11px]">Modelo</th>
                 <th className="px-2 py-2 text-center text-[11px]">Quantidade</th>
                 <th className="px-2 py-2 text-right text-[11px]">Custo</th>
                 <th className="px-2 py-2 text-right text-[11px]">CMV %</th>
               </tr>
             </thead>
             <tbody>
               {loading ? (
                 <tr><td colSpan={5} className="text-center py-8"><Spinner size={24} className="animate-spin" /></td></tr>
               ) : cmvAltoItens.length === 0 ? (
                 <tr><td colSpan={5} className="text-center py-8">Nenhum produto com CMV alto encontrado.</td></tr>
               ) : (
                 cmvAltoItens.map((item, idx) => (
                   <tr key={idx} className="border-b hover:bg-gray-50">
                     <td className="px-2 py-2">{item.cd_nivel || '-'}</td>
                     <td className="px-2 py-2">{item.modelo || '-'}</td>
                     <td className="px-2 py-2 text-center">{item.quantidade?.toLocaleString('pt-BR') || '-'}</td>
                     <td className="px-2 py-2 text-right">{item.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                     <td className="px-2 py-2 text-right">{item.cmv != null ? item.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '-'}</td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
         </div>
       </Modal>

      {/* Tabela Ranking Produtos (Dropdown) */}
      <div className="mt-8 rounded-2xl shadow-lg bg-white border border-[#000638]/10">
        <div className="flex items-center justify-between p-6 border-b border-[#000638]/10">
          <button
            type="button"
            onClick={() => setRankingOpen(!rankingOpen)}
            className="flex items-center gap-3 group"
          >
            {rankingOpen ? (
              <CaretDown size={18} className="text-gray-500 group-hover:text-[#000638] transition-colors" />
            ) : (
              <CaretRight size={18} className="text-gray-500 group-hover:text-[#000638] transition-colors" />
            )}
            <Package size={24} className="text-[#000638]" />
            <h2 className="text-xl font-bold text-[#000638]">Ranking Produtos</h2>
            <span className="text-sm text-gray-500">(Todos os canais)</span>
          </button>
          <button
            className="px-4 py-2 bg-[#000638] text-white rounded-lg text-sm font-semibold hover:bg-[#001060] transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
            onClick={exportarRankParaExcel}
            type="button"
            disabled={dados.length === 0}
          >
            <ArrowsClockwise size={16} />
            Baixar Excel
          </button>
        </div>
        {rankingOpen && (
          <div className="p-6">
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('rank')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Rank {getSortIcon('rank')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('cd_nivel')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Código {getSortIcon('cd_nivel')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-left text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('modelo')}
                    >
                      <div className="flex items-center gap-1">
                        Modelo {getSortIcon('modelo')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-center text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('quantidade')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Qtd {getSortIcon('quantidade')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('valorTotal')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Valor {getSortIcon('valorTotal')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('valorBrutoTotal')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        V. Bruto {getSortIcon('valorBrutoTotal')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('desconto')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Desc. {getSortIcon('desconto')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('custo')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Custo {getSortIcon('custo')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('cmv')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        CMV % {getSortIcon('cmv')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('markup')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Markup {getSortIcon('markup')}
                      </div>
                    </th>
                    <th 
                      className="px-1 py-1 text-right text-[10px] cursor-pointer hover:bg-[#000638]/80 transition-colors"
                      onClick={() => handleSort('margem')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Margem % {getSortIcon('margem')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Agrupa por cd_nivel e soma os valores
                    const rankProdutos = dados.reduce((acc, row) => {
                      const nivel = row.cd_nivel;
                      if (!acc[nivel]) {
                        acc[nivel] = {
                          cd_nivel: nivel,
                          modelo: row.ds_nivel,
                          valorTotal: 0,
                          valorBrutoTotal: 0,
                          quantidade: 0
                        };
                      }
                      const qtFaturado = Number(row.qt_faturado) || 1;
                      const valor = (Number(row.vl_unitliquido) || 0) * qtFaturado;
                      const valorBruto = (Number(row.vl_unitbruto) || 0) * qtFaturado;
                      if (row.tp_operacao === 'S') {
                        acc[nivel].valorTotal += valor;
                        acc[nivel].valorBrutoTotal += valorBruto;
                        acc[nivel].quantidade += qtFaturado;
                      } else if (row.tp_operacao === 'E') {
                        acc[nivel].valorTotal -= valor;
                        acc[nivel].valorBrutoTotal -= valorBruto;
                        acc[nivel].quantidade -= qtFaturado;
                      }
                      return acc;
                    }, {});
                    
                    // Converte para array e aplica ordenação
                    const rankArray = sortRankData(Object.values(rankProdutos));
                    
                    if (loading) {
                      return (
                        <tr>
                          <td colSpan={11} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <Spinner size={32} className="animate-spin text-blue-600" />
                              <span className="text-gray-500 text-sm">Carregando produtos...</span>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    return rankArray.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <Package size={32} className="text-gray-400" />
                            <span className="text-gray-500 text-sm font-medium">Nenhum produto encontrado</span>
                            <span className="text-gray-400 text-xs">Tente ajustar os filtros de busca</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      rankArray.map((produto, index) => {
                        const descontoTotal = produto.valorBrutoTotal - produto.valorTotal;
                        return (
                          <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-0.5 py-0.5 text-center text-blue-600 font-semibold">#{index + 1}</td>
                            <td className="px-0.5 py-0.5 text-center">{produto.cd_nivel || 'N/A'}</td>
                            <td className="px-0.5 py-0.5 text-center">{produto.modelo || 'N/A'}</td>
                            <td className="px-0.5 py-0.5 text-center">{produto.quantidade.toLocaleString('pt-BR')}</td>
                            <td className="px-0.5 py-0.5 text-right font-semibold">{produto.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-0.5 py-0.5 text-right font-semibold">{produto.valorBrutoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-0.5 py-0.5 text-right font-semibold text-orange-600">{descontoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="px-0.5 py-0.5 text-right font-semibold">
                              {custoMap[produto.cd_nivel?.trim()] !== undefined
                                ? (produto.quantidade * custoMap[produto.cd_nivel.trim()]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : '-'}
                            </td>
                            {/* CMV: custo / valor */}
                            <td className="px-0.5 py-0.5 text-right font-semibold">
                              {(() => {
                                const custoUnit = custoMap[produto.cd_nivel?.trim()];
                                const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
                                if (custoTotal !== undefined && produto.valorTotal > 0) {
                                  const cmv = custoTotal / produto.valorTotal;
                                  return (cmv * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                                }
                                return '-';
                              })()}
                            </td>
                            <td className="px-0.5 py-0.5 text-right font-semibold">
                              {(() => {
                                const custoUnit = custoMap[produto.cd_nivel?.trim()];
                                const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
                                if (custoTotal && custoTotal !== 0) {
                                  const markup = produto.valorTotal / custoTotal;
                                  return markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                }
                                return '-';
                              })()}
                            </td>
                            <td className="px-0.5 py-0.5 text-right font-semibold">
                              {(() => {
                                const custoUnit = custoMap[produto.cd_nivel?.trim()];
                                const custoTotal = custoUnit !== undefined ? produto.quantidade * custoUnit : undefined;
                                if (produto.valorTotal && custoTotal !== undefined && produto.valorTotal !== 0) {
                                  const margem = ((produto.valorTotal - custoTotal) / produto.valorTotal) * 100;
                                  return margem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                                }
                                return '-';
                              })()}
                            </td>
                          </tr>
                        );
                      })
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditoriaCMV;


