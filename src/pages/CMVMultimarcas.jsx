import React, { useEffect, useMemo, useState } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import { ChartLineUp } from '@phosphor-icons/react';

const CMVMultimarcas = () => {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const registrosPorPagina = 20;

  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: '',
    empresas: [],
    // classificacoes é fixo e oculto: sempre [2]
    nr_transacao: '',
    cd_pessoa: '',
    cd_empresa: '',
  });

  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
    setFiltros((f) => ({ ...f, dt_inicio: primeiroDia, dt_fim: ultimoDia }));
  }, []);

  const buscar = async () => {
    try {
      setLoading(true);
      setErro('');
      const params = {
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        // classificação fixa 2
        cd_classificacao: [2],
      };
      if (Array.isArray(filtros.empresas) && filtros.empresas.length > 0) {
        params.cd_empresa = filtros.empresas;
      }
      if (filtros.nr_transacao && String(filtros.nr_transacao).trim() !== '') {
        params.nr_transacao = String(filtros.nr_transacao).trim();
      }
      if (filtros.cd_pessoa && String(filtros.cd_pessoa).trim() !== '') {
        params.cd_pessoa = String(filtros.cd_pessoa).trim();
      }

      const resp = await api.sales.cmv(params);
      if (!resp.success) {
        setErro(resp.message || 'Falha ao carregar dados');
        setDados([]);
        return;
      }
      const lista = Array.isArray(resp?.data?.data)
        ? resp.data.data
        : Array.isArray(resp?.data)
        ? resp.data
        : [];
      setDados(lista);
      setPaginaAtual(1);
    } catch (e) {
      setErro('Erro ao buscar dados');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // helpers de formatação
  const toNumber = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const n = Number(String(val).trim());
    return Number.isNaN(n) ? 0 : n;
  };

  const formatCurrency = (v) =>
    toNumber(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (d) => {
    if (!d) return '';
    const iso = typeof d === 'string' ? d : new Date(d).toISOString();
    const base = iso.includes('T') ? iso.split('T')[0] : iso;
    const [yyyy, mm, dd] = base.split('-');
    if (!yyyy || !mm || !dd) return String(d);
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatQuantity = (q) =>
    toNumber(q).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });

  const colunas = useMemo(
    () => [
      { key: 'nm_grupoempresa', header: 'Empresa' },
      { key: 'dt_transacao', header: 'Referência', format: formatDate },
      { key: 'nr_transacao', header: 'Nr Transação' },
      { key: 'cd_pessoa', header: 'Cd Pessoa' },
      { key: 'nm_pessoa', header: 'Nm Pessoa' },
      { key: 'ds_nivel', header: 'Descrição' },
      { key: 'qt_faturado', header: 'Qt Faturado', format: formatQuantity },
      { key: 'vl_unitliquido', header: 'Líquido', format: formatCurrency },
      { key: 'vl_unitbruto', header: 'Bruto', format: formatCurrency },
      { key: 'vl_produto', header: 'CMV', format: formatCurrency },
      { key: 'vl_freterat', header: 'Frete Rateado', format: formatCurrency },
    ],
    [],
  );

  // Filtragem em memória
  const dadosFiltrados = useMemo(() => {
    const termoNr = String(filtros.nr_transacao || '').trim();
    const termoPessoa = String(filtros.cd_pessoa || '').trim();
    const termoEmpresa = String(filtros.cd_empresa || '').trim();

    if (!termoNr && !termoPessoa && !termoEmpresa) return dados;

    return dados.filter((row) => {
      let ok = true;
      if (termoNr) {
        ok = ok && String(row?.nr_transacao || '').includes(termoNr);
      }
      if (termoPessoa) {
        ok = ok && String(row?.cd_pessoa || '').includes(termoPessoa);
      }
      if (termoEmpresa) {
        ok =
          ok &&
          String(row?.cd_grupoempresa || row?.cd_empresa || '').includes(
            termoEmpresa,
          );
      }
      return ok;
    });
  }, [dados, filtros.nr_transacao, filtros.cd_pessoa, filtros.cd_empresa]);

  const totalPaginas = useMemo(() => {
    const total = Math.ceil((dadosFiltrados.length || 0) / registrosPorPagina);
    return Math.max(1, total || 1);
  }, [dadosFiltrados.length]);

  const dadosPaginados = useMemo(() => {
    const start = (paginaAtual - 1) * registrosPorPagina;
    const end = start + registrosPorPagina;
    return dadosFiltrados.slice(start, end);
  }, [dadosFiltrados, paginaAtual]);

  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    } else if (paginaAtual < 1) {
      setPaginaAtual(1);
    }
  }, [paginaAtual, totalPaginas]);

  // Totais ajustados (subtraindo devoluções)
  const totais = useMemo(() => {
    let totalLiquido = 0;
    let totalBruto = 0;
    let totalDevolucoes = 0;
    let totalCMV = 0;
    let totalFrete = 0;

    for (const row of dadosFiltrados) {
      const qtd = toNumber(row?.qt_faturado) || 1;
      const frete = toNumber(row?.vl_freterat) || 0;
      const liq = toNumber(row?.vl_unitliquido) * qtd + frete;
      const bru = toNumber(row?.vl_unitbruto) * qtd + frete;
      const cmv = toNumber(row?.vl_produto) * qtd;
      const isDev = String(row?.tp_operacao).trim() === 'E';

      if (isDev) {
        totalLiquido -= Math.abs(liq);
        totalBruto -= Math.abs(bru);
        totalDevolucoes += Math.abs(liq);
        totalCMV -= Math.abs(cmv);
      } else {
        totalLiquido += liq;
        totalBruto += bru;
        totalCMV += cmv;
      }
      totalFrete += frete;
    }

    return { totalLiquido, totalBruto, totalDevolucoes, totalCMV, totalFrete };
  }, [dadosFiltrados]);

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <PageTitle
        title="CMV MULTIMARCAS"
        subtitle="Consulta da rota /cmv (view materializada mv_nfitemprod)"
        icon={ChartLineUp}
        iconColor="text-indigo-600"
      />

      <div className="bg-white rounded-lg shadow p-3 mb-4 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={filtros.dt_inicio}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, dt_inicio: e.target.value }))
              }
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Data Fim</label>
            <input
              type="date"
              value={filtros.dt_fim}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, dt_fim: e.target.value }))
              }
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Cd Empresa
            </label>
            <input
              type="text"
              value={filtros.cd_empresa}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, cd_empresa: e.target.value }))
              }
              placeholder="Ex.: 11"
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Nr Transação
            </label>
            <input
              type="text"
              value={filtros.nr_transacao}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, nr_transacao: e.target.value }))
              }
              placeholder="Ex.: 685924"
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Cd Pessoa
            </label>
            <input
              type="text"
              value={filtros.cd_pessoa}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, cd_pessoa: e.target.value }))
              }
              placeholder="Ex.: 19295"
              className="border rounded px-2 py-1.5 w-full text-xs"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={buscar}
              disabled={loading || !filtros.dt_inicio || !filtros.dt_fim}
              className="bg-indigo-600 text-white text-xs px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
        {erro && <div className="mt-2 text-xs text-red-600">{erro}</div>}
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-1 sm:grid-cols-8 gap-3 mb-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Receita Liq + Imp</div>
          <div className="text-lg font-semibold text-green-600">
            {formatCurrency(totais.totalLiquido)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Receita Bruta</div>
          <div className="text-lg font-semibold text-blue-600">
            {formatCurrency(totais.totalBruto)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Total de Devoluções</div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(totais.totalDevolucoes)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Total CMV</div>
          <div className="text-lg font-semibold">
            {formatCurrency(totais.totalCMV)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
          <div className="text-xs text-gray-500">CMV %</div>
          <div className="text-lg font-semibold">
            {(() => {
              const denom = Math.abs(totais.totalLiquido) || 0;
              if (!denom) return '0,00%';
              const perc = (totais.totalCMV / denom) * 100;
              return `${perc.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}%`;
            })()}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Margem %</div>
          <div className="text-lg font-semibold">
            {(() => {
              const denom = Math.abs(totais.totalLiquido) || 0;
              if (!denom) return '0,00%';
              const perc =
                ((totais.totalLiquido - totais.totalCMV) / denom) * 100;
              return `${perc.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}%`;
            })()}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Markup</div>
          <div className="text-lg font-semibold">
            {(() => {
              const denom = Math.abs(totais.totalCMV) || 0;
              if (!denom) return '—';
              const factor = totais.totalLiquido / denom;
              return `${factor.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}x`;
            })()}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Total Frete</div>
          <div className="text-lg font-semibold">
            {formatCurrency(totais.totalFrete)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
        <div className="text-xs text-gray-600 mb-2">
          Registros: {dadosFiltrados.length}
          {dadosFiltrados.length > 0 && (
            <span className="ml-2 text-blue-600 font-medium">
              Mostrando {(paginaAtual - 1) * registrosPorPagina + 1}-
              {Math.min(
                paginaAtual * registrosPorPagina,
                dadosFiltrados.length,
              )}{' '}
              de {dadosFiltrados.length}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-100">
              <tr>
                {colunas.map((c) => (
                  <th
                    key={c.key}
                    className="px-2 py-1 text-left font-semibold text-gray-700"
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dadosPaginados.map((row, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  {colunas.map((c) => {
                    let value = c.key === '__perc' ? undefined : row[c.key];
                    const isValorCol =
                      c.key === 'vl_unitliquido' ||
                      c.key === 'vl_unitbruto' ||
                      c.key === 'vl_produto';
                    const isDevolucao = String(row?.tp_operacao).trim() === 'E';
                    const qtd = toNumber(row?.qt_faturado) || 1;
                    const frete = toNumber(row?.vl_freterat) || 0;

                    if (isValorCol) {
                      let num;
                      if (c.key === 'vl_produto') {
                        num = toNumber(value) * qtd;
                      } else {
                        num = toNumber(value) * qtd + frete;
                      }
                      value = isDevolucao ? -Math.abs(num) : num;
                    }

                    const rendered = c.format
                      ? c.format(value, row)
                      : value ?? '';
                    const extraClass =
                      isValorCol && isDevolucao ? ' text-red-600' : '';

                    return (
                      <td key={c.key} className={`px-2 py-1${extraClass}`}>
                        {rendered}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {dadosFiltrados.length === 0 && (
                <tr>
                  <td
                    className="px-2 py-4 text-center text-gray-500"
                    colSpan={colunas.length}
                  >
                    Nenhum registro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {dadosFiltrados.length > registrosPorPagina && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <div>
              {' '}
              Página {paginaAtual} de {totalPaginas}{' '}
            </div>
            <div className="flex gap-1">
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                onClick={() => setPaginaAtual(1)}
                disabled={paginaAtual === 1}
              >
                « Primeira
              </button>
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
              >
                ‹ Anterior
              </button>
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                onClick={() =>
                  setPaginaAtual((p) => Math.min(totalPaginas, p + 1))
                }
                disabled={paginaAtual === totalPaginas}
              >
                Próxima ›
              </button>
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                onClick={() => setPaginaAtual(totalPaginas)}
                disabled={paginaAtual === totalPaginas}
              >
                Última »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CMVMultimarcas;
