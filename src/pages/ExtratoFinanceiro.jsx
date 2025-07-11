import React, { useState, useRef } from 'react';
import Layout from '../components/Layout';

const PAGE_SIZE = 5000;

const ExtratoFinanceiro = () => {
  const [dados, setDados] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    cd_empresa: '',
    nr_ctapes: [], // agora é array
    dt_movim_ini: '',
    dt_movim_fim: '',
  });
  const [page, setPage] = useState(1);
  const dropdownRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fecha o dropdown ao clicar fora
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lista de contas para o dropdown
  const contas = [
    { numero: '10001', nome: 'Itau Crosby' },
    { numero: '10002', nome: 'Sant Matriz Crosby' },
    { numero: '10003', nome: 'Sant Vinculada Crosby' },
    { numero: '10004', nome: 'Caixa Matriz Crosby' },
    { numero: '10005', nome: 'Bb Matriz Crosby' },
    { numero: '10006', nome: 'Sicred Matriz Crosby' },
    { numero: '10007', nome: 'Bnb 1 Crosby' },
    { numero: '10008', nome: 'Bnb 2 Crosby' },
    { numero: '10009', nome: 'Unicred Matriz Crosby' },
    { numero: '10010', nome: 'Bradesco Matriz Crosby' },
    { numero: '10011', nome: 'Sant Pb Crosby' },
    { numero: '10012', nome: 'Itau Pb Crosby' },
    { numero: '10013', nome: 'Itau Pe Crosby' },
    { numero: '20001', nome: 'Itaú Matriz Fabio' },
    { numero: '20002', nome: 'Itaú Vinculada Fabio' },
    { numero: '20003', nome: 'Itaú Midway Fabio' },
    { numero: '20007', nome: 'Sant Matriz Fabio' },
    { numero: '20008', nome: 'Caixa Matriz Fabio' },
    { numero: '20009', nome: 'Bb Matriz Fabio' },
    { numero: '20010', nome: 'Sicredi Matriz Fabio' },
    { numero: '20011', nome: 'Bnb 1 Fabio' },
    { numero: '20012', nome: 'Bnb 2 Fabio' },
    { numero: '20013', nome: 'Unicred Matriz Fabio' },
    { numero: '20014', nome: 'Bradesco Matriz Fabio' },
    { numero: '20015', nome: 'Itaú Canguaretama Fabio' },
    { numero: '20016', nome: 'Itaú Brejinho Fabio' },
    { numero: '20017', nome: 'Itaú Lv Fabio' },
    { numero: '20018', nome: 'Itaú Ce Fabio' },
    { numero: '20019', nome: 'Itaú Ba Fabio' },
    { numero: '20020', nome: 'Itaú Irmãos Cr' },
    { numero: '30001', nome: 'Sicredi Irmãos Cr' },
    { numero: '30002', nome: 'Bnb 1 Irmãos Cr' },
    { numero: '30003', nome: 'Bnb 2 Irmãos Cr' },
    { numero: '30005', nome: 'Bb Irmãos Cr' },
    { numero: '30006', nome: 'Santander Irmãos Cr' },
    { numero: '30007', nome: 'Caixa Irmãos Cr' },
    { numero: '30008', nome: 'Bradesco Irmãos Cr' },
    { numero: '40001', nome: 'Itaú Flavio' },
  ];

  // Função para buscar dados
  const fetchDados = async (filtrosParam = filtros, pageParam = page) => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();
      if (filtrosParam.cd_empresa) params.append('cd_empresa', filtrosParam.cd_empresa);
      if (filtrosParam.nr_ctapes && filtrosParam.nr_ctapes.length > 0) {
        filtrosParam.nr_ctapes.forEach((nr) => params.append('nr_ctapes', nr));
      }
      if (filtrosParam.dt_movim_ini) params.append('dt_movim_ini', filtrosParam.dt_movim_ini);
      if (filtrosParam.dt_movim_fim) params.append('dt_movim_fim', filtrosParam.dt_movim_fim);
      params.append('limit', PAGE_SIZE);
      params.append('offset', (pageParam - 1) * PAGE_SIZE);
      const res = await fetch(`http://localhost:4000/extrato?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao buscar dados do servidor');
      const json = await res.json();
      setDados(json.rows || []);
      setTotal(json.total || 0);
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

  const handleContaCheckbox = (numero) => {
    setFiltros((prev) => {
      const jaSelecionado = prev.nr_ctapes.includes(numero);
      return {
        ...prev,
        nr_ctapes: jaSelecionado
          ? prev.nr_ctapes.filter((n) => n !== numero)
          : [...prev.nr_ctapes, numero],
      };
    });
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

  return (
    <Layout>
      <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-8">
        <h1 className="text-3xl font-bold mb-6 text-center">Extrato Financeiro</h1>
        <div className="mb-8">
          <form onSubmit={handleFiltrar} className="flex flex-wrap gap-4 items-end justify-center bg-white p-4 rounded-lg shadow">
            <div className="flex flex-col">
              <label className="block text-sm font-medium mb-1">Empresa</label>
              <input name="cd_empresa" value={filtros.cd_empresa} onChange={handleChange} className="border rounded px-3 py-2 w-40" placeholder="Empresa" />
            </div>
            <div className="flex flex-col min-w-[320px] max-w-[400px]">
              <label className="block text-sm font-medium mb-1">Conta</label>
              <div className="relative">
                <button
                  type="button"
                  className="border rounded px-3 py-2 w-full text-left bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => setDropdownOpen((open) => !open)}
                >
                  {filtros.nr_ctapes.length === 0
                    ? 'Selecione as contas'
                    : `${filtros.nr_ctapes.length} conta(s) selecionada(s)`}
                </button>
                {dropdownOpen && (
                  <div className="absolute z-10 bg-white border rounded shadow w-full max-w-[400px] min-w-[320px] max-h-64 overflow-y-auto mt-1">
                    {contas.map((conta) => (
                      <label key={conta.numero} className="flex flex-row items-center justify-between gap-2 w-full px-3 py-2 cursor-pointer hover:bg-gray-100 whitespace-nowrap overflow-hidden">
                        <span className="truncate">{conta.numero} - {conta.nome}</span>
                        <input
                          type="checkbox"
                          checked={filtros.nr_ctapes.includes(conta.numero)}
                          onChange={() => handleContaCheckbox(conta.numero)}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium mb-1">Data Inicial</label>
              <input type="date" name="dt_movim_ini" value={filtros.dt_movim_ini} onChange={handleChange} className="border rounded px-3 py-2 w-40" />
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium mb-1">Data Final</label>
              <input type="date" name="dt_movim_fim" value={filtros.dt_movim_fim} onChange={handleChange} className="border rounded px-3 py-2 w-40" />
            </div>
            <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 transition h-10 mt-5">Filtrar</button>
          </form>
          {erro && <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{erro}</div>}
        </div>
        {/* Cards de resumo de Débito e Crédito */}
        <div className="flex flex-wrap gap-6 justify-center mb-8">
          {/* Card Débito */}
          <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-red-500">
            <span className="text-lg font-semibold text-red-700 mb-2">Débitos (D)</span>
            <span className="text-2xl font-bold text-red-600 mb-1">
              {dados.filter(row => row.tp_operbco === 'D').length}
            </span>
            <span className="text-sm text-gray-500">Quantidade</span>
            <span className="text-xl font-bold text-red-700 mt-2">
              {dados.filter(row => row.tp_operbco === 'D').reduce((acc, row) => acc + (row.vl_lancto || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-sm text-gray-500">Soma dos valores</span>
          </div>
          {/* Card Crédito */}
          <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center w-64 border-l-4 border-green-500">
            <span className="text-lg font-semibold text-green-700 mb-2">Créditos (C)</span>
            <span className="text-2xl font-bold text-green-600 mb-1">
              {dados.filter(row => row.tp_operbco === 'C').length}
            </span>
            <span className="text-sm text-gray-500">Quantidade</span>
            <span className="text-xl font-bold text-green-700 mt-2">
              {dados.filter(row => row.tp_operbco === 'C').reduce((acc, row) => acc + (row.vl_lancto || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-sm text-gray-500">Soma dos valores</span>
          </div>
        </div>
        <div className=" rounded-lg shadow bg-white">
          <div className="overflow-y-auto max-h-[500px]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="px-4 py-2">Conta</th>
                  <th className="px-4 py-2">Data Lançamento</th>
                  <th className="px-4 py-2">Histórico</th>
                  <th className="px-4 py-2">Operação</th>
                  <th className="px-4 py-2">Valor</th>
                  <th className="px-4 py-2">Data Conciliação</th>
                </tr>
              </thead>
              <tbody className="overflow-y-auto">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8">Carregando...</td></tr>
                ) : dados.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8">Nenhum dado encontrado.</td></tr>
                ) : (
                  dados.map((row, i) => (
                    <tr key={i} className=" border-b hover:bg-gray-50">
                      <td className="px-4 py-2 text-center">{row.nr_ctapes}</td>
                      <td className="px-4 py-2 text-center">{formatarDataBR(row.dt_lancto)}</td>
                      <td className="px-4 py-2">{row.ds_histbco}</td>
                      <td className="px-4 py-2 text-center">{row.tp_operbco}</td>
                      <td className={`px-4 py-2 text-right ${row.tp_operbco === 'D' ? 'text-red-600 font-bold' : row.tp_operbco === 'C' ? 'text-green-600 font-bold' : ''}`}>{row.vl_lancto?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-4 py-2 text-center">{formatarDataBR(row.dt_conciliacao)}</td>
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

export default ExtratoFinanceiro; 