import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/cards';
import { FileText, Funnel, Calendar, Spinner, CaretUp, CaretDown, CaretUpDown, FileArrowDown } from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import useApiClient from '../hooks/useApiClient';
import custoProdutos from '../custoprodutos.json';

const AuditoriaCMV = () => {
  const apiClient = useApiClient();

  const [filtros, setFiltros] = useState({ dt_inicio: '', dt_fim: '' });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // KPIs separados por canal
  const [semCusto, setSemCusto] = useState(0);
  const [cmvMenor10Revenda, setCmvMenor10Revenda] = useState(0);
  const [cmvMaior70Revenda, setCmvMaior70Revenda] = useState(0);
  const [cmvMenor10Varejo, setCmvMenor10Varejo] = useState(0);
  const [cmvMaior70Varejo, setCmvMaior70Varejo] = useState(0);
  const [cmvMenor10Multimarcas, setCmvMenor10Multimarcas] = useState(0);
  const [cmvMaior70Multimarcas, setCmvMaior70Multimarcas] = useState(0);
  const [cmvMenor10Franquias, setCmvMenor10Franquias] = useState(0);
  const [cmvMaior70Franquias, setCmvMaior70Franquias] = useState(0);
  
  const [tabelaProdutos, setTabelaProdutos] = useState([]);
  const [filtroTipoLinha, setFiltroTipoLinha] = useState('TODOS'); // TODOS | SEM_CUSTO | CMV_BAIXO | CMV_ALTO
  const [filtroBuscaCodigo, setFiltroBuscaCodigo] = useState('');
  const [ordenacao, setOrdenacao] = useState({ campo: 'codigo', direcao: 'asc' });

  const handleExportExcel = () => {
    try {
      const filtered = tabelaProdutos
        .filter(row => {
          if (filtroTipoLinha === 'TODOS') return true;
          return row.tipo === filtroTipoLinha;
        })
        .filter(row => {
          const busca = filtroBuscaCodigo.toLowerCase();
          return String(row.codigo).toLowerCase().includes(busca) || String(row.nome || '').toLowerCase().includes(busca);
        })
        .sort((a,b) => {
          const dir = ordenacao.direcao === 'asc' ? 1 : -1;
          let ca = a[ordenacao.campo] ?? (ordenacao.campo==='codigo' || ordenacao.campo==='nome' ? '' : 0);
          let cb = b[ordenacao.campo] ?? (ordenacao.campo==='codigo' || ordenacao.campo==='nome' ? '' : 0);
          if (ordenacao.campo === 'codigo' || ordenacao.campo === 'nome') {
            ca = String(ca).toLowerCase();
            cb = String(cb).toLowerCase();
          } else {
            ca = Number(ca) || 0;
            cb = Number(cb) || 0;
          }
          if (ca < cb) return -1*dir;
          if (ca > cb) return 1*dir;
          return 0;
        });

      if (filtered.length === 0) {
        alert('Não há dados para exportar.');
        return;
      }

      const dadosParaExportar = filtered.map(row => ({
        'Código': row.codigo,
        'Produto': row.nome || '',
        'Quantidade': Number(row.quantidade) || 0,
        'Custo': Number(row.custo) || 0,
        'CMV %': row.cmvPct != null ? Number(row.cmvPct.toFixed(2)) : null,
        'Canais': row.canais ? row.canais.join(', ') : '',
        'Tipo': row.tipo === 'SEM_CUSTO' ? 'SEM CUSTO' : row.tipo === 'CMV_BAIXO' ? 'CMV BAIXO' : row.tipo === 'CMV_ALTO' ? 'CMV ALTO' : row.tipo
      }));

      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Auditoria CMV');
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const hoje = new Date().toISOString().slice(0,10);
      saveAs(blob, `auditoria-cmv-${hoje}.xlsx`);
    } catch (e) {
      console.error('Erro ao exportar Excel Auditoria CMV:', e);
      alert('Erro ao exportar Excel.');
    }
  };

  // Map de custos (Código -> Custo unitário)
  const custoMap = (() => {
    const map = {};
    try {
      custoProdutos.forEach(item => {
        if (item.Codigo && item.Custo !== undefined) {
          map[String(item.Codigo).trim()] = Number(item.Custo);
        }
      });
    } catch {}
    return map;
  })();

  // Mesma lógica de fontes do Consolidado
  const empresasFixas = ['2', '200', '75', '31', '6', '85', '11'];
  const empresasVarejoFixas = ['2', '5', '500', '55', '550', '65', '650', '93', '930', '94', '940', '95', '950', '96', '960', '97', '970'];

  const handleFiltrar = async (e) => {
    e?.preventDefault?.();
    if (!filtros.dt_inicio || !filtros.dt_fim) return;
    setLoading(true);
    setErro('');
    try {
      // Revenda
      const resultRevenda = await apiClient.sales.faturamentoRevenda({
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasFixas
      });
      const dadosRevenda = resultRevenda?.success ? resultRevenda.data : [];

      // Varejo
      const resultVarejo = await apiClient.sales.faturamento({
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasVarejoFixas
      });
      const dadosVarejo = resultVarejo?.success ? resultVarejo.data : [];

      // Franquia
      const resultFranquia = await apiClient.sales.faturamentoFranquia({
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasFixas
      });
      const dadosFranquia = resultFranquia?.success ? resultFranquia.data : [];

      // Multimarcas
      const resultMtm = await apiClient.sales.faturamentoMtm({
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasFixas
      });
      const dadosMtm = resultMtm?.success ? resultMtm.data : [];

      // Processa cada canal separadamente
      const processarCanal = (dados, canal) => {
        const porProduto = new Map();
        for (const row of dados) {
          if (row?.tp_operacao !== 'S') continue; // só saídas
          const codigo = String(row.cd_nivel || '').trim();
          if (!codigo) continue;
          const qt = Number(row.qt_faturado) || 0;
          const vlUnit = Number(row.vl_unitliquido) || 0;
          const custoUnit = custoMap[codigo];
          const nomeLinha = (row.ds_produto || row.nm_produto || row.ds_item || row.nm_item || row.ds_nivel || row.nm_nivel || row.descricao || '').toString();

          if (!porProduto.has(codigo)) {
            porProduto.set(codigo, { receita: 0, custo: 0, temCusto: custoUnit !== undefined, quantidade: 0, nome: '' });
          }
          const acc = porProduto.get(codigo);
          acc.receita += vlUnit * qt;
          acc.quantidade += qt;
          if (!acc.nome && nomeLinha) acc.nome = nomeLinha;
          if (custoUnit !== undefined) {
            acc.custo += custoUnit * qt;
          } else {
            acc.temCusto = false;
          }
        }

        let countMenor10 = 0;
        let countMaior70 = 0;

        for (const [codigo, stats] of porProduto.entries()) {
          if (stats.receita > 0 && stats.custo >= 0) {
            const pct = (stats.custo / stats.receita) * 100;
            if (pct < 10) countMenor10++;
            if (pct > 70) countMaior70++;
          }
        }

        return { countMenor10, countMaior70, porProduto };
      };

      const revendaStats = processarCanal(dadosRevenda, 'revenda');
      const varejoStats = processarCanal(dadosVarejo, 'varejo');
      const franquiaStats = processarCanal(dadosFranquia, 'franquia');
      const multimarcasStats = processarCanal(dadosMtm, 'multimarcas');

      // Combina todos os dados para a tabela
      const todosProdutos = new Map();
      
      const adicionarProdutos = (porProduto, canal) => {
        for (const [codigo, stats] of porProduto.entries()) {
          if (!todosProdutos.has(codigo)) {
            todosProdutos.set(codigo, { ...stats, canais: [] });
          }
          const acc = todosProdutos.get(codigo);
          acc.receita += stats.receita;
          acc.custo += stats.custo;
          acc.quantidade += stats.quantidade;
          if (!acc.temCusto) acc.temCusto = stats.temCusto;
          if (!acc.nome && stats.nome) acc.nome = stats.nome;
          acc.canais.push(canal);
        }
      };

      adicionarProdutos(revendaStats.porProduto, 'revenda');
      adicionarProdutos(varejoStats.porProduto, 'varejo');
      adicionarProdutos(franquiaStats.porProduto, 'franquia');
      adicionarProdutos(multimarcasStats.porProduto, 'multimarcas');

      // Calcula KPIs totais
      let countSemCusto = 0;
      const tabela = [];

      for (const [codigo, stats] of todosProdutos.entries()) {
        if (!stats.temCusto) countSemCusto++;

        // Monta linha de tabela
        let tipo = 'NORMAL';
        let pctLinha = null;
        if (!stats.temCusto) tipo = 'SEM_CUSTO';
        if (stats.receita > 0 && stats.custo >= 0) {
          pctLinha = (stats.custo / stats.receita) * 100;
          if (pctLinha < 10) tipo = 'CMV_BAIXO';
          if (pctLinha > 70) tipo = 'CMV_ALTO';
        }
        if (tipo !== 'NORMAL') {
          tabela.push({
            codigo,
            nome: stats.nome || '',
            quantidade: stats.quantidade || 0,
            receita: stats.receita,
            custo: stats.custo,
            cmvPct: pctLinha,
            tipo,
            canais: stats.canais
          });
        }
      }

      setSemCusto(countSemCusto);
      setCmvMenor10Revenda(revendaStats.countMenor10);
      setCmvMaior70Revenda(revendaStats.countMaior70);
      setCmvMenor10Varejo(varejoStats.countMenor10);
      setCmvMaior70Varejo(varejoStats.countMaior70);
      setCmvMenor10Multimarcas(multimarcasStats.countMenor10);
      setCmvMaior70Multimarcas(multimarcasStats.countMaior70);
      setCmvMenor10Franquias(franquiaStats.countMenor10);
      setCmvMaior70Franquias(franquiaStats.countMaior70);
      setTabelaProdutos(tabela);
    } catch (err) {
      console.error('Erro ao buscar Auditoria CMV:', err);
      setErro('Erro ao buscar dados. Tente novamente.');
      setSemCusto(0);
      setCmvMenor10Revenda(0);
      setCmvMaior70Revenda(0);
      setCmvMenor10Varejo(0);
      setCmvMaior70Varejo(0);
      setCmvMenor10Multimarcas(0);
      setCmvMaior70Multimarcas(0);
      setCmvMenor10Franquias(0);
      setCmvMaior70Franquias(0);
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8 px-4">
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
            <div className="flex items-end">
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

        {/* Tabela de Quantidades por Canal */}
        <Card className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#000638]">Quantidades por Canal</CardTitle>
            <CardDescription>Resumo de produtos por tipo e canal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#000638] text-white text-xs uppercase">
                    <th className="px-4 py-3 cursor-pointer text-left" onClick={() => setOrdenacao(o => ({ campo: 'canal', direcao: o.campo==='canal' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">Canal {ordenacao.campo==='canal' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer text-center" onClick={() => setOrdenacao(o => ({ campo: 'semCusto', direcao: o.campo==='semCusto' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">Sem Custo {ordenacao.campo==='semCusto' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer text-center" onClick={() => setOrdenacao(o => ({ campo: 'cmvMenor10', direcao: o.campo==='cmvMenor10' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">CMV &lt; 10% {ordenacao.campo==='cmvMenor10' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer text-center" onClick={() => setOrdenacao(o => ({ campo: 'cmvMaior70', direcao: o.campo==='cmvMaior70' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">CMV &gt; 70% {ordenacao.campo==='cmvMaior70' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer text-center" onClick={() => setOrdenacao(o => ({ campo: 'total', direcao: o.campo==='total' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">Total {ordenacao.campo==='total' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                   {(() => {
                     const dadosTabela = [
                       {
                         canal: 'Revenda',
                         semCusto: cmvMenor10Revenda + cmvMaior70Revenda,
                         cmvMenor10: cmvMenor10Revenda,
                         cmvMaior70: cmvMaior70Revenda,
                         total: cmvMenor10Revenda + cmvMaior70Revenda,
                         bgClass: ''
                       },
                       {
                         canal: 'Varejo',
                         semCusto: cmvMenor10Varejo + cmvMaior70Varejo,
                         cmvMenor10: cmvMenor10Varejo,
                         cmvMaior70: cmvMaior70Varejo,
                         total: cmvMenor10Varejo + cmvMaior70Varejo,
                         bgClass: 'bg-gray-50'
                       },
                       {
                         canal: 'Multimarcas',
                         semCusto: cmvMenor10Multimarcas + cmvMaior70Multimarcas,
                         cmvMenor10: cmvMenor10Multimarcas,
                         cmvMaior70: cmvMaior70Multimarcas,
                         total: cmvMenor10Multimarcas + cmvMaior70Multimarcas,
                         bgClass: ''
                       },
                       {
                         canal: 'Franquias',
                         semCusto: cmvMenor10Franquias + cmvMaior70Franquias,
                         cmvMenor10: cmvMenor10Franquias,
                         cmvMaior70: cmvMaior70Franquias,
                         total: cmvMenor10Franquias + cmvMaior70Franquias,
                         bgClass: 'bg-gray-50'
                       },
                       {
                         canal: 'TOTAL GERAL',
                         semCusto: semCusto,
                         cmvMenor10: cmvMenor10Revenda + cmvMenor10Varejo + cmvMenor10Multimarcas + cmvMenor10Franquias,
                         cmvMaior70: cmvMaior70Revenda + cmvMaior70Varejo + cmvMaior70Multimarcas + cmvMaior70Franquias,
                         total: semCusto + (cmvMenor10Revenda + cmvMenor10Varejo + cmvMenor10Multimarcas + cmvMenor10Franquias) + (cmvMaior70Revenda + cmvMaior70Varejo + cmvMaior70Multimarcas + cmvMaior70Franquias),
                         bgClass: 'bg-[#000638] text-white font-bold'
                       }
                     ];

                     // Aplicar ordenação
                     const dadosOrdenados = dadosTabela.sort((a, b) => {
                       const dir = ordenacao.direcao === 'asc' ? 1 : -1;
                       let ca = a[ordenacao.campo] ?? '';
                       let cb = b[ordenacao.campo] ?? '';
                       
                       if (ordenacao.campo === 'canal') {
                         ca = String(ca).toLowerCase();
                         cb = String(cb).toLowerCase();
                       } else {
                         ca = Number(ca) || 0;
                         cb = Number(cb) || 0;
                       }
                       
                       if (ca < cb) return -1 * dir;
                       if (ca > cb) return 1 * dir;
                       return 0;
                     });

                     return dadosOrdenados.map((row, idx) => (
                       <tr key={idx} className={`border-b text-gray-800 ${row.bgClass}`}>
                         <td className="px-4 py-3 font-semibold text-left">{row.canal}</td>
                         <td className="px-4 py-3 text-center">{loading ? <Spinner size={16} className="animate-spin" /> : row.semCusto}</td>
                         <td className="px-4 py-3 text-center">{loading ? <Spinner size={16} className="animate-spin" /> : row.cmvMenor10}</td>
                         <td className="px-4 py-3 text-center">{loading ? <Spinner size={16} className="animate-spin" /> : row.cmvMaior70}</td>
                         <td className="px-4 py-3 text-center font-bold">{loading ? <Spinner size={16} className="animate-spin" /> : row.total}</td>
                       </tr>
                     ));
                   })()}
                 </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Filtros da Tabela */}
        <Card className="bg-white rounded-2xl shadow-lg border border-[#000638]/10 mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-[#000638]">Produtos sinalizados</CardTitle>
                <CardDescription>Itens sem custo, com CMV alto ou baixo</CardDescription>
              </div>
              <div className="flex gap-2">
                <select
                  value={filtroTipoLinha}
                  onChange={(e) => setFiltroTipoLinha(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 bg-[#f8f9fb] text-[#000638] text-sm"
                >
                  <option value="TODOS">TODOS</option>
                  <option value="SEM_CUSTO">SEM CUSTO</option>
                  <option value="CMV_BAIXO">CMV BAIXO (&lt; 10%)</option>
                  <option value="CMV_ALTO">CMV ALTO (&gt; 70%)</option>
                </select>
                <input
                  type="text"
                  placeholder="Buscar por código..."
                  value={filtroBuscaCodigo}
                  onChange={(e) => setFiltroBuscaCodigo(e.target.value)}
                  className="border border-[#000638]/30 rounded-lg px-3 py-2 bg-[#f8f9fb] text-[#000638] text-sm"
                />
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                  type="button"
                >
                  <FileArrowDown size={16} />
                  Baixar Excel
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#000638] text-white text-xs uppercase">
                    <th className="px-3 py-2 cursor-pointer text-left" onClick={() => setOrdenacao(o => ({ campo: 'codigo', direcao: o.campo==='codigo' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">Código {ordenacao.campo==='codigo' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                    <th className="px-3 py-2 cursor-pointer text-left" onClick={() => setOrdenacao(o => ({ campo: 'nome', direcao: o.campo==='nome' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">Produto {ordenacao.campo==='nome' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                    <th className="px-3 py-2 cursor-pointer text-right" onClick={() => setOrdenacao(o => ({ campo: 'quantidade', direcao: o.campo==='quantidade' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">Qtd {ordenacao.campo==='quantidade' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                    <th className="px-3 py-2 cursor-pointer text-right" onClick={() => setOrdenacao(o => ({ campo: 'custo', direcao: o.campo==='custo' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">Custo {ordenacao.campo==='custo' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                    <th className="px-3 py-2 cursor-pointer text-right" onClick={() => setOrdenacao(o => ({ campo: 'cmvPct', direcao: o.campo==='cmvPct' && o.direcao==='asc' ? 'desc' : 'asc' }))}>
                      <div className="flex items-center gap-1">CMV % {ordenacao.campo==='cmvPct' ? (ordenacao.direcao==='asc' ? <CaretUp size={12}/> : <CaretDown size={12}/>) : <CaretUpDown size={12} className="opacity-50"/>}</div>
                    </th>
                    <th className="px-3 py-2 text-center">Canais</th>
                    <th className="px-3 py-2 text-center">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelaProdutos
                    .filter(row => {
                      if (filtroTipoLinha === 'TODOS') return true;
                      return row.tipo === filtroTipoLinha;
                    })
                    .filter(row => {
                      const busca = filtroBuscaCodigo.toLowerCase();
                      return String(row.codigo).toLowerCase().includes(busca) || String(row.nome || '').toLowerCase().includes(busca);
                    })
                    .sort((a,b) => {
                      const dir = ordenacao.direcao === 'asc' ? 1 : -1;
                      let ca = a[ordenacao.campo] ?? (ordenacao.campo==='codigo' || ordenacao.campo==='nome' ? '' : 0);
                      let cb = b[ordenacao.campo] ?? (ordenacao.campo==='codigo' || ordenacao.campo==='nome' ? '' : 0);
                      if (ordenacao.campo === 'codigo' || ordenacao.campo === 'nome') {
                        ca = String(ca).toLowerCase();
                        cb = String(cb).toLowerCase();
                      } else {
                        ca = Number(ca) || 0;
                        cb = Number(cb) || 0;
                      }
                      if (ca < cb) return -1*dir;
                      if (ca > cb) return 1*dir;
                      return 0;
                    })
                    .map((row, idx) => (
                      <tr key={idx} className="border-b text-gray-800">
                        <td className="px-3 py-2 font-mono text-xs text-left">{row.codigo}</td>
                        <td className="px-3 py-2 text-left">{row.nome || '--'}</td>
                        <td className="px-3 py-2 text-right">{(Number(row.quantidade) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right">{row.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-3 py-2 text-right">{row.cmvPct != null ? row.cmvPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '--'}</td>
                        <td className="px-3 py-2 text-center">
                          {row.canais.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.canais.map((canal, index) => (
                                <span key={index} className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 border border-blue-300">
                                  {canal}
                                </span>
                              ))}
                            </div>
                          ) : '--'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.tipo === 'SEM_CUSTO' && <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-200 text-gray-800">SEM CUSTO</span>}
                          {row.tipo === 'CMV_BAIXO' && <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-yellow-100 text-yellow-700 border border-yellow-300">CMV BAIXO</span>}
                          {row.tipo === 'CMV_ALTO' && <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 border border-red-300">CMV ALTO</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
  );
};

export default AuditoriaCMV;


