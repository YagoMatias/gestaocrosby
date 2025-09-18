import React, { useEffect, useMemo, useRef, useState } from 'react';
import useApiClient from '../hooks/useApiClient';
import PageTitle from '../components/ui/PageTitle';
import { FileText, Spinner } from '@phosphor-icons/react';
import custoProdutos from '../custoprodutos.json';
import Modal from '../components/ui/Modal';

// Cache em memória (sobrevive durante a sessão)
const memoryCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const buildCacheKey = (routeName, params) => {
  // Normaliza objeto para chave estável
  const stable = JSON.stringify(params, Object.keys(params).sort());
  return `${routeName}::${stable}`;
};

// Função para buscar custo do produto baseado no código
const buscarCustoProduto = (codigo) => {
  if (!codigo) return null;

  // Busca no array de produtos pelo código
  const produto = custoProdutos.find((p) => p.Codigo === codigo);
  return produto ? produto.Custo : null;
};

const readCache = (key) => {
  // 1) memória
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key);
    if (Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  }
  // 2) localStorage
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.ts && Date.now() - parsed.ts < CACHE_TTL_MS) {
        // re-hidrata memória
        memoryCache.set(key, { data: parsed.data, ts: parsed.ts });
        return parsed.data;
      }
    }
  } catch {}
  return null;
};

const writeCache = (key, data) => {
  const entry = { data, ts: Date.now() };
  memoryCache.set(key, entry);
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
};

const AuditoriaCMV = () => {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState([]);
  const [dadosVarejo, setDadosVarejo] = useState([]);

  // Evitar race condition entre buscas
  const lastRequestIdRef = useRef(0);

  const [filtros, setFiltros] = useState({
    dt_inicio: '',
    dt_fim: '',
    empresas: [],
  });

  // Filtro de Mês/Ano (igual Contas a Receber)
  const [filtroMensal, setFiltroMensal] = useState(() => {
    try {
      return localStorage.getItem('auditoriaCMV:filtroMensal') || 'ANO';
    } catch {
      return 'ANO';
    }
  });
  const [filtroDia, setFiltroDia] = useState(() => {
    try {
      const raw = localStorage.getItem('auditoriaCMV:filtroDia');
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Hidrata filtros do localStorage, se existirem
    try {
      const saved = localStorage.getItem('auditoriaCMV:filtros');
      if (saved) {
        const parsed = JSON.parse(saved);
        setFiltros((f) => ({ ...f, ...parsed }));
        return;
      }
    } catch {}
    // Default: mês atual
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
    setFiltros((f) => ({ ...f, dt_inicio: primeiroDia, dt_fim: ultimoDia }));
  }, []);

  // Persiste filtros e período
  useEffect(() => {
    try {
      localStorage.setItem('auditoriaCMV:filtros', JSON.stringify(filtros));
    } catch {}
  }, [filtros]);

  useEffect(() => {
    try {
      localStorage.setItem('auditoriaCMV:filtroMensal', filtroMensal);
    } catch {}
  }, [filtroMensal]);

  useEffect(() => {
    try {
      localStorage.setItem('auditoriaCMV:filtroDia', JSON.stringify(filtroDia));
    } catch {}
  }, [filtroDia]);

  // Função para aplicar filtro mensal (igual Contas a Receber)
  const aplicarFiltroMensal = (dados, filtroMensal, filtroDia) => {
    if (!Array.isArray(dados) || dados.length === 0) return dados;

    return dados.filter((row) => {
      const dataVenda = new Date(
        row.dt_venda || row.dt_faturamento || row.dt_emissao,
      );
      if (isNaN(dataVenda.getTime())) return false;

      const mes = dataVenda.getMonth() + 1;
      const dia = dataVenda.getDate();

      if (filtroMensal === 'ANO') return true;

      const mesesNumericos = {
        JAN: 1,
        FEV: 2,
        MAR: 3,
        ABR: 4,
        MAI: 5,
        JUN: 6,
        JUL: 7,
        AGO: 8,
        SET: 9,
        OUT: 10,
        NOV: 11,
        DEZ: 12,
      };

      if (filtroMensal in mesesNumericos) {
        const mesFiltro = mesesNumericos[filtroMensal];
        if (mes !== mesFiltro) return false;
      }

      if (filtroDia && filtroDia.dia) {
        return dia === filtroDia.dia;
      }

      return true;
    });
  };

  // Filtragem em memória
  const dadosFiltrados = useMemo(() => {
    // Aplicar filtro mensal aos dados
    const dadosFiltrados = aplicarFiltroMensal(dados, filtroMensal, filtroDia);

    return dadosFiltrados;
  }, [dados, filtroMensal, filtroDia]);

  const dadosVarejoFiltrados = useMemo(() => {
    // Aplicar filtro mensal aos dados do varejo
    const dadosFiltrados = aplicarFiltroMensal(
      dadosVarejo,
      filtroMensal,
      filtroDia,
    );

    return dadosFiltrados;
  }, [dadosVarejo, filtroMensal, filtroDia]);

  const handleOrdenacao = (campo) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc',
    }));
    setPaginaAtual(1); // Volta para a primeira página ao ordenar
  };

  const buscar = async () => {
    const currentRequestId = ++lastRequestIdRef.current;
    setLoading(true);
    setErro('');

    const cacheKeyCmvtest = JSON.stringify({
      ...filtros,
      cd_classificacao: [2, 3, 4],
    });
    const cacheKeyFaturamento = JSON.stringify({
      ...filtros,
      cd_empresa: [2, 5, 55, 65, 90, 91, 92, 93, 94, 95, 96, 97, 98],
    });
    const now = Date.now();

    let cachedCmvtest = readCache(cacheKeyCmvtest);
    let cachedFaturamento = readCache(cacheKeyFaturamento);

    // SWR: Serve stale data immediately if available and not expired
    if (cachedCmvtest && now < cachedCmvtest.ts + CACHE_TTL_MS) {
      setDados(cachedCmvtest.data);
    }
    if (cachedFaturamento && now < cachedFaturamento.ts + CACHE_TTL_MS) {
      setDadosVarejo(cachedFaturamento.data);
    }

    try {
      const params = {
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_classificacao: [2, 3, 4],
      };
      if (Array.isArray(filtros.empresas) && filtros.empresas.length > 0) {
        params.cd_empresa = filtros.empresas;
      }

      // Fetch consolidado (classificações 2,3,4) e varejo em paralelo
      const empresasFixasVarejo = [
        '2',
        '5',
        '55',
        '65',
        '90',
        '91',
        '92',
        '93',
        '94',
        '95',
        '96',
        '97',
        '98',
      ];

      const paramsVarejo = {
        dt_inicio: filtros.dt_inicio,
        dt_fim: filtros.dt_fim,
        cd_empresa: empresasFixasVarejo,
      };

      // Chaves de cache
      const keyCmvtest = buildCacheKey('cmvtest', params);
      const keyFaturamento = buildCacheKey('faturamento', paramsVarejo);

      const [respConsolidado, respVarejo] = await Promise.all([
        api.sales.cmvtest(params),
        api.sales.faturamento(paramsVarejo),
      ]);

      if (currentRequestId !== lastRequestIdRef.current) {
        return; // Ignore outdated response
      }

      if (respConsolidado.success) {
        const lista = Array.isArray(respConsolidado?.data?.data)
          ? respConsolidado.data.data
          : Array.isArray(respConsolidado?.data)
          ? respConsolidado.data
          : [];
        console.log('🔍 Debug - Dados consolidado carregados:', {
          success: respConsolidado.success,
          dataLength: lista.length,
          primeiroItem: lista[0],
          camposDisponiveis: lista[0] ? Object.keys(lista[0]) : [],
        });
        setDados(lista);
        writeCache(keyCmvtest, lista);
      } else {
        setErro(respConsolidado.message || 'Falha ao carregar dados');
        setDados([]);
      }

      if (respVarejo.success) {
        const listaVar = Array.isArray(respVarejo?.data?.data)
          ? respVarejo.data.data
          : Array.isArray(respVarejo?.data)
          ? respVarejo.data
          : [];
        console.log('🔍 Debug - Dados varejo carregados:', {
          success: respVarejo.success,
          dataLength: listaVar.length,
          primeiroItem: listaVar[0],
          camposDisponiveis: listaVar[0] ? Object.keys(listaVar[0]) : [],
        });
        setDadosVarejo(listaVar);
        writeCache(keyFaturamento, listaVar);
      } else {
        console.warn('Falha ao carregar varejo:', respVarejo.message);
        setDadosVarejo([]);
      }
    } catch (e) {
      if (currentRequestId === lastRequestIdRef.current) {
        setErro('Erro ao buscar dados');
        console.error(e);
      }
    } finally {
      if (currentRequestId === lastRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Combinar dados de todas as fontes
  const todosDados = useMemo(() => {
    const combinados = [...dados, ...dadosVarejo];
    console.log('🔍 Debug - Dados combinados:', {
      dados: dados.length,
      dadosVarejo: dadosVarejo.length,
      total: combinados.length,
      primeiroItem: combinados[0],
    });
    return combinados;
  }, [dados, dadosVarejo]);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const registrosPorPagina = 20;

  // Ordenação
  const [ordenacao, setOrdenacao] = useState({
    campo: null,
    direcao: 'asc',
  });

  // Modal: Sem Custo na Planilha
  const [modalSemCustoOpen, setModalSemCustoOpen] = useState(false);
  // Modal: Valores Diferentes
  const [modalValoresDiferentesOpen, setModalValoresDiferentesOpen] =
    useState(false);

  // Dados agrupados por Código, Descrição, Valor Sistema e Valor Planilha
  const dadosAgrupados = useMemo(() => {
    const grupos = new Map();

    todosDados.forEach((item) => {
      const codigo =
        item.cd_nivel ||
        item.cd_nivelproduto ||
        item.cd_produto ||
        item.cd_item;
      const descricao =
        item.ds_nivel ||
        item.ds_nivelproduto ||
        item.ds_produto ||
        item.ds_item;
      const valorSistema =
        Number(item.vl_produto) ||
        Number(item.vl_unitliquido) ||
        Number(item.vl_unitbruto) ||
        0;
      const custoPlanilha = buscarCustoProduto(codigo);
      const quantidade =
        Number(item.qt_faturado) ||
        Number(item.qt_item) ||
        Number(item.quantidade) ||
        0;

      // Verificações de segurança
      if (codigo === undefined || descricao === undefined) {
        return; // Pula itens sem código ou descrição
      }

      // Chave única para agrupamento
      const chave = `${codigo}|${descricao}|${valorSistema}|${custoPlanilha}`;

      if (grupos.has(chave)) {
        // Se já existe, soma a quantidade
        const grupo = grupos.get(chave);
        grupo.quantidade += quantidade;
      } else {
        // Se não existe, cria novo grupo
        grupos.set(chave, {
          codigo,
          descricao,
          valorSistema,
          custoPlanilha,
          quantidade,
        });
      }
    });

    const dados = Array.from(grupos.values());

    // Aplicar ordenação se especificada
    if (ordenacao.campo) {
      dados.sort((a, b) => {
        let valorA, valorB;

        switch (ordenacao.campo) {
          case 'valorSistema':
            valorA = a.valorSistema || 0;
            valorB = b.valorSistema || 0;
            break;
          case 'custoPlanilha':
            valorA = a.custoPlanilha || 0;
            valorB = b.custoPlanilha || 0;
            break;
          case 'quantidade':
            valorA = a.quantidade || 0;
            valorB = b.quantidade || 0;
            break;
          default:
            return 0;
        }

        if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
        if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return dados;
  }, [todosDados, ordenacao]);

  const totalPaginas = Math.ceil(dadosAgrupados.length / registrosPorPagina);
  const indiceInicial = (paginaAtual - 1) * registrosPorPagina;
  const indiceFinal = indiceInicial + registrosPorPagina;
  const dadosPaginados = dadosAgrupados.slice(indiceInicial, indiceFinal);

  // Lista derivada: itens sem custo na planilha
  const itensSemCustoPlanilha = useMemo(() => {
    return dadosAgrupados.filter(
      (item) =>
        item.custoPlanilha === null ||
        item.custoPlanilha === undefined ||
        item.custoPlanilha === 0,
    );
  }, [dadosAgrupados]);

  // Estatísticas dos dados
  const estatisticas = useMemo(() => {
    const totalRegistros = dadosAgrupados.length;
    const produtosComValorZero = dadosAgrupados.filter((item) => {
      return (item.valorSistema || 0) === 0;
    }).length;
    const produtosComValor = totalRegistros - produtosComValorZero;
    const percentualZero =
      totalRegistros > 0
        ? ((produtosComValorZero / totalRegistros) * 100).toFixed(1)
        : 0;

    // Estatísticas da planilha
    const produtosComCustoPlanilha = dadosAgrupados.filter((item) => {
      return item.custoPlanilha !== null;
    }).length;
    const produtosSemCustoPlanilha = totalRegistros - produtosComCustoPlanilha;
    const percentualComCusto =
      totalRegistros > 0
        ? ((produtosComCustoPlanilha / totalRegistros) * 100).toFixed(1)
        : 0;

    // Estatísticas comparativas entre Valor Sistema e Valor Planilha
    const produtosComCustoPlanilhaZerado = dadosAgrupados.filter((item) => {
      return (
        item.custoPlanilha === null ||
        item.custoPlanilha === undefined ||
        item.custoPlanilha === 0
      );
    }).length;

    const produtosValoresDiferentes = dadosAgrupados.filter((item) => {
      // Considera diferente se: tem custo na planilha E é diferente do sistema
      return (
        item.custoPlanilha !== null &&
        item.custoPlanilha !== undefined &&
        item.custoPlanilha !== (item.valorSistema || 0)
      );
    }).length;

    const produtosValoresIguais = dadosAgrupados.filter((item) => {
      // Considera igual se: tem custo na planilha E é igual ao sistema
      return (
        item.custoPlanilha !== null &&
        item.custoPlanilha !== undefined &&
        item.custoPlanilha === (item.valorSistema || 0)
      );
    }).length;

    return {
      totalRegistros,
      produtosComValorZero,
      produtosComValor,
      percentualZero,
      produtosComCustoPlanilha,
      produtosSemCustoPlanilha,
      percentualComCusto,
      produtosComCustoPlanilhaZerado,
      produtosValoresDiferentes,
      produtosValoresIguais,
    };
  }, [todosDados]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2">
      <PageTitle
        title="Auditoria CMV"
        subtitle="Análise detalhada dos dados de CMV por produto"
        icon={FileText}
        iconColor="text-indigo-600"
      />

      {/* Filtros */}
      <div className="mb-4">
        <div className="flex flex-col bg-white p-3 rounded-lg shadow-md w-full max-w-4xl mx-auto border border-gray-200">
          <div className="mb-2">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
              <FileText size={10} weight="bold" />
              Filtros
            </span>
            <span className="text-xs text-gray-500 mt-1">
              Selecione o período para análise
            </span>
          </div>
          <div className="flex flex-row gap-x-6 w-full">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Data Inicial
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
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1 text-gray-700">
                Data Final
              </label>
              <input
                type="date"
                value={filtros.dt_fim}
                onChange={(e) =>
                  setFiltros((f) => ({ ...f, dt_fim: e.target.value }))
                }
                className="border rounded px-2 py-1.5 w-full text-xs"
              />
            </div>
            <div className="flex items-center">
              <button
                onClick={buscar}
                disabled={loading || !filtros.dt_inicio || !filtros.dt_fim}
                className="bg-indigo-600 text-white text-xs px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        </div>
        {erro && <div className="mt-2 text-xs text-red-600">{erro}</div>}
      </div>

      {/* Filtro de Período */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-700">Período:</span>
          {[
            'ANO',
            'JAN',
            'FEV',
            'MAR',
            'ABR',
            'MAI',
            'JUN',
            'JUL',
            'AGO',
            'SET',
            'OUT',
            'NOV',
            'DEZ',
          ].map((mes) => (
            <button
              key={mes}
              onClick={() => setFiltroMensal(mes)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filtroMensal === mes
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {mes}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de Estatísticas */}
      {todosDados.length > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Card Total de Registros */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Total de Registros
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {estatisticas.totalRegistros.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>

            {/* Card Produtos com Valor Zero */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-red-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold text-sm">0</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Produtos com Valor Zero
                  </p>
                  <p className="text-2xl font-semibold text-red-600">
                    {estatisticas.produtosComValorZero.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {estatisticas.percentualZero}% do total
                  </p>
                </div>
              </div>
            </div>

            {/* Card Produtos com Valor */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-green-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-bold text-sm">R$</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Produtos com Valor
                  </p>
                  <p className="text-2xl font-semibold text-green-600">
                    {estatisticas.produtosComValor.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(
                      (estatisticas.produtosComValor /
                        estatisticas.totalRegistros) *
                      100
                    ).toFixed(1)}
                    % do total
                  </p>
                </div>
              </div>
            </div>

            {/* Card Produtos com Custo na Planilha */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-purple-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-sm">
                      📊
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Com Custo Planilha
                  </p>
                  <p className="text-2xl font-semibold text-purple-600">
                    {estatisticas.produtosComCustoPlanilha.toLocaleString(
                      'pt-BR',
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {estatisticas.percentualComCusto}% do total
                  </p>
                </div>
              </div>
            </div>

            {/* Card Produtos com Custo Planilha Zerado */}
            <div
              className="bg-white rounded-lg shadow-md p-4 border border-orange-200 cursor-pointer hover:shadow-lg transition"
              onClick={() =>
                itensSemCustoPlanilha.length > 0 && setModalSemCustoOpen(true)
              }
              title={
                itensSemCustoPlanilha.length > 0
                  ? 'Clique para ver os itens'
                  : 'Sem itens para listar'
              }
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 font-bold text-sm">0</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Sem Custo na Planilha
                  </p>
                  <p className="text-2xl font-semibold text-orange-600">
                    {estatisticas.produtosComCustoPlanilhaZerado.toLocaleString(
                      'pt-BR',
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {estatisticas.produtosComCustoPlanilha > 0
                      ? (
                          (estatisticas.produtosComCustoPlanilhaZerado /
                            estatisticas.produtosComCustoPlanilha) *
                          100
                        ).toFixed(1)
                      : 0}
                    % da planilha
                  </p>
                </div>
              </div>
            </div>

            {/* Card Valores Diferentes */}
            <div
              className="bg-white rounded-lg shadow-md p-4 border border-red-200 cursor-pointer hover:shadow-lg transition"
              onClick={() =>
                estatisticas.produtosValoresDiferentes > 0 &&
                setModalValoresDiferentesOpen(true)
              }
              title={
                estatisticas.produtosValoresDiferentes > 0
                  ? 'Clique para ver os itens'
                  : 'Sem itens para listar'
              }
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold text-sm">≠</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Valores Diferentes
                  </p>
                  <p className="text-2xl font-semibold text-red-600">
                    {estatisticas.produtosValoresDiferentes.toLocaleString(
                      'pt-BR',
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {estatisticas.produtosComCustoPlanilha > 0
                      ? (
                          (estatisticas.produtosValoresDiferentes /
                            estatisticas.produtosComCustoPlanilha) *
                          100
                        ).toFixed(1)
                      : 0}
                    % da planilha
                  </p>
                </div>
              </div>
            </div>

            {/* Card Valores Iguais */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-emerald-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-600 font-bold text-sm">
                      =
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Valores Iguais
                  </p>
                  <p className="text-2xl font-semibold text-emerald-600">
                    {estatisticas.produtosValoresIguais.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {estatisticas.produtosComCustoPlanilha > 0
                      ? (
                          (estatisticas.produtosValoresIguais /
                            estatisticas.produtosComCustoPlanilha) *
                          100
                        ).toFixed(1)
                      : 0}
                    % da planilha
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Dados */}
      {todosDados.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="text-lg font-semibold text-gray-800">
              Dados de Auditoria CMV ({todosDados.length} registros)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código Nível
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição Nível
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleOrdenacao('valorSistema')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>Valor Sistema</span>
                      {ordenacao.campo === 'valorSistema' && (
                        <span className="text-indigo-600">
                          {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleOrdenacao('custoPlanilha')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>Valor Planilha</span>
                      {ordenacao.campo === 'custoPlanilha' && (
                        <span className="text-indigo-600">
                          {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleOrdenacao('quantidade')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>Quantidade</span>
                      {ordenacao.campo === 'quantidade' && (
                        <span className="text-indigo-600">
                          {ordenacao.direcao === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dadosPaginados.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {indiceInicial + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.codigo || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.descricao || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(item.valorSistema || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.custoPlanilha !== null &&
                      item.custoPlanilha !== undefined
                        ? item.custoPlanilha.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(item.quantidade || 0).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando {indiceInicial + 1} a{' '}
                  {Math.min(indiceFinal, dadosAgrupados.length)} de{' '}
                  {dadosAgrupados.length} registros agrupados
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                    disabled={paginaAtual === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Anterior
                  </button>

                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    const pagina = i + 1;
                    return (
                      <button
                        key={pagina}
                        onClick={() => setPaginaAtual(pagina)}
                        className={`px-3 py-1 text-sm border rounded ${
                          pagina === paginaAtual
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {pagina}
                      </button>
                    );
                  })}

                  <button
                    onClick={() =>
                      setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))
                    }
                    disabled={paginaAtual === totalPaginas}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Spinner size={24} className="animate-spin text-indigo-600" />
          <span className="ml-2 text-gray-600">Carregando dados...</span>
        </div>
      )}

      {!loading && todosDados.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhum dado encontrado para o período selecionado.
        </div>
      )}

      {/* Modal: Itens Sem Custo na Planilha */}
      <Modal
        isOpen={modalSemCustoOpen}
        onClose={() => setModalSemCustoOpen(false)}
        title={`Itens sem custo na planilha (${itensSemCustoPlanilha.length})`}
        size="4xl"
      >
        {itensSemCustoPlanilha.length === 0 ? (
          <div className="text-sm text-gray-600">Nenhum item encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código Nível
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição Nível
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Sistema
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Planilha
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {itensSemCustoPlanilha.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {item.codigo || 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {item.descricao || 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {(item.valorSistema || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {item.custoPlanilha !== null &&
                      item.custoPlanilha !== undefined
                        ? item.custoPlanilha.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Modal: Itens com Valores Diferentes (Sistema x Planilha) */}
      <Modal
        isOpen={modalValoresDiferentesOpen}
        onClose={() => setModalValoresDiferentesOpen(false)}
        title="Itens com valores diferentes (Sistema x Planilha)"
        size="4xl"
      >
        {dadosAgrupados.filter(
          (item) =>
            item.custoPlanilha !== null &&
            item.custoPlanilha !== undefined &&
            item.custoPlanilha !== (item.valorSistema || 0),
        ).length === 0 ? (
          <div className="text-sm text-gray-600">Nenhum item encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código Nível
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição Nível
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Sistema
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Planilha
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dadosAgrupados
                  .filter(
                    (item) =>
                      item.custoPlanilha !== null &&
                      item.custoPlanilha !== undefined &&
                      item.custoPlanilha !== (item.valorSistema || 0),
                  )
                  .map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {item.codigo || 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {item.descricao || 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {(item.valorSistema || 0).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {item.custoPlanilha !== null &&
                        item.custoPlanilha !== undefined
                          ? item.custoPlanilha.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditoriaCMV;
