import React, { useState } from 'react';
import Layout from '../components/Layout';

const PAGE_SIZE = 5000;

const ExtratoTOTVS = () => {
  const [dados, setDados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    cd_empresa: '',
    nr_ctapes: '',
    dt_movim_ini: '',
    dt_movim_fim: '',
    ds_doc: '',
    dt_liq: '',
  });
  const [page, setPage] = useState(1);

  const fetchDados = async (filtrosParam = filtros, pageParam = page) => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (filtrosParam.cd_empresa) params.append('cd_empresa', filtrosParam.cd_empresa);
      if (filtrosParam.nr_ctapes) params.append('nr_ctapes', filtrosParam.nr_ctapes);
      if (filtrosParam.dt_movim_ini) params.append('dt_movim_ini', filtrosParam.dt_movim_ini);
      if (filtrosParam.dt_movim_fim) params.append('dt_movim_fim', filtrosParam.dt_movim_fim);
      if (filtrosParam.ds_doc) params.append('ds_doc', filtrosParam.ds_doc);
      if (filtrosParam.dt_liq) params.append('dt_liq', filtrosParam.dt_liq);
      params.append('limit', PAGE_SIZE);
      params.append('offset', (pageParam - 1) * PAGE_SIZE);
      const res = await fetch(`http://localhost:4000/extratototvs?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao buscar dados do servidor');
      const json = await res.json();
      setDados(json.rows || json); // Suporta ambos formatos
      setTotal(json.total || (json.length ?? 0));
    } catch (err) {
      setErro('Erro ao buscar dados do servidor.');
      setDados([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDados({ ...filtros, [e.target.name]: e.target.value }, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchDados(filtros, newPage);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Função para formatar datas no padrão brasileiro
  function formatarDataBR(data) {
    if (!data) return '-';
    const d = new Date(data);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  // Colunas a exibir e cabeçalhos amigáveis
  const colunas = [
    { key: 'nr_ctapes', label: 'Conta' },
    { key: 'dt_movim', label: 'Data Lançamento' },
    { key: 'ds_doc', label: 'Documento' },
    { key: 'in_estorno', label: 'Estorno' },
    { key: 'tp_operacao', label: 'Operação' },
    { key: 'ds_aux', label: 'Auxiliar' },
    { key: 'vl_lancto', label: 'Valor' },
    { key: 'dt_liq', label: 'Data Liquidação' },
  ];

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center">Extrato TOTVS</h1>
        <div className="mb-8">
          <form onSubmit={handleFiltrar} className="flex flex-wrap gap-4 items-end justify-center bg-white p-4 rounded-lg shadow">
            <div>
              <label className="block text-sm font-medium mb-1">Empresa</label>
              <input name="cd_empresa" value={filtros.cd_empresa} onChange={handleChange} className="border rounded px-3 py-2 w-32" placeholder="cd_empresa" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Conta</label>
              <input name="nr_ctapes" value={filtros.nr_ctapes} onChange={handleChange} className="border rounded px-3 py-2 w-32" placeholder="nr_ctapes" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Movimento Inicial</label>
              <input type="date" name="dt_movim_ini" value={filtros.dt_movim_ini} onChange={handleChange} className="border rounded px-3 py-2 w-40" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Movimento Final</label>
              <input type="date" name="dt_movim_fim" value={filtros.dt_movim_fim} onChange={handleChange} className="border rounded px-3 py-2 w-40" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Documento</label>
              <input name="ds_doc" value={filtros.ds_doc} onChange={handleChange} className="border rounded px-3 py-2 w-32" placeholder="ds_doc" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Liquidação</label>
              <input type="date" name="dt_liq" value={filtros.dt_liq} onChange={handleChange} className="border rounded px-3 py-2 w-40" />
            </div>
            <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 transition">Filtrar</button>
          </form>
          {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
        </div>
        <div className="rounded-lg shadow bg-white">
          <div className="overflow-y-auto max-h-[500px]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  {colunas.map((col) => (
                    <th key={col.key} className="px-4 py-2">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="overflow-y-auto">
                {loading ? (
                  <tr><td colSpan={colunas.length} className="text-center py-8">Carregando...</td></tr>
                ) : dados.length === 0 ? (
                  <tr><td colSpan={colunas.length} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                ) : (
                  dados.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      {colunas.map((col) => {
                        if (col.key === 'vl_lancto') {
                          // Valor colorido
                          const isDebito = row.tp_operacao === 'D';
                          const isCredito = row.tp_operacao === 'C';
                          return (
                            <td key={col.key} className={`px-4 py-2 text-right ${isDebito ? 'text-red-600 font-bold' : isCredito ? 'text-green-600 font-bold' : ''}`}>
                              {row[col.key] !== null && row[col.key] !== undefined ? Number(row[col.key]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                            </td>
                          );
                        }
                        if (col.key === 'dt_movim' || col.key === 'dt_liq') {
                          // Datas formatadas
                          return (
                            <td key={col.key} className="px-4 py-2 text-center">
                              {formatarDataBR(row[col.key])}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="px-4 py-2 text-center">{row[col.key] !== null && row[col.key] !== undefined && row[col.key] !== '' ? row[col.key] : '-'}</td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
            >
              Anterior
            </button>
            <span className="mx-2">Página {page} de {totalPages}</span>
            <button
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages || loading}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ExtratoTOTVS; 