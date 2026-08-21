import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Spinner,
  ChartBar,
  X,
  CaretLeft,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import useFreshFetch from '../hooks/useFreshFetch';

const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatInt = (v) => Number(v || 0).toLocaleString('pt-BR');

const formatData = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
};

// Agrupa as vendas por cliente (nível intermediário do drill): soma valores
// e guarda as faturas de cada um para o nível seguinte.
const agruparPorCliente = (vendas) => {
  const mapa = new Map();
  for (const v of vendas || []) {
    const code = v.cliente_code;
    const cur = mapa.get(code) || {
      cliente_code: code,
      cliente_nome: v.cliente_nome || `Cliente ${code}`,
      qtd: 0,
      valor: 0,
      vendas: [],
    };
    if (v.cliente_nome) cur.cliente_nome = v.cliente_nome;
    cur.qtd += 1;
    cur.valor += Number(v.valor || 0);
    cur.vendas.push(v);
    mapa.set(code, cur);
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, valor: Math.round(c.valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor);
};

// Grupos fixos (definidos pelo gestor). Vendedores fora deles:
// vendeu na 99 → card individual ATACADO; senão → entra no card VAREJO.
// Pseudo-vendedores montados pelo backend a partir das NFs (régua TRAR008):
//   -50   = EXPEDIÇÃO      (ops 7254, 7276, 7255, 7237, 7299, 7007, 887-889)
//   -512  = RICARDO ELETRO (op 512)
//   -1000 = BLUECRED       (clientes com contrato × faturas de crediário)
const GRUPOS_FIXOS = [
  { nome: 'FRANQUIA', codes: [40] },
  { nome: 'REVENDA', codes: [161, 241, 165] },
  { nome: 'MTM', codes: [259, 21, 26] },
  { nome: 'EXPEDIÇÃO', codes: [-50] },
  { nome: 'RICARDO ELETRO', codes: [-512] },
  { nome: 'BLUECRED', codes: [-1000] },
];

export default function PainelVendas() {
  const apiClient = useApiClient();
  const { run, isStale } = useFreshFetch();

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [linhas, setLinhas] = useState(null);
  // VAREJO oficial (mesma fonte do Ranking de Faturamento), por filial:
  // [{ branch_code, qtd, valor, sellers: [{seller_code, seller_name, qtd, valor}] }]
  const [varejoPainel, setVarejoPainel] = useState([]);
  // Pilha de views do modal de drill: cada item é
  // { tipo: 'filiais'|'vendedores'|'vendas', titulo, ... }
  const [drillStack, setDrillStack] = useState([]);
  // Cache das vendas por vendedor (evita refetch ao navegar)
  const [vendasCache, setVendasCache] = useState({});

  // pré-preencher datas (mês atual)
  useEffect(() => {
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    setDataInicio(primeiro.toISOString().split('T')[0]);
    setDataFim(hoje.toISOString().split('T')[0]);
  }, []);

  const handleBuscar = async () => {
    if (!dataInicio || !dataFim) {
      setErro('Informe as datas de início e fim.');
      return;
    }
    const tok = run();
    setLoading(true);
    setErro('');
    setLinhas(null);
    setVarejoPainel([]);
    setDrillStack([]);
    setVendasCache({});
    try {
      const result = await apiClient.totvs.salePanelFaturamentoVendedor({
        filtroempresa: [],
        datemin: dataInicio,
        datemax: dataFim,
      });

      if (isStale(tok)) return;

      if (!result || result.success === false) {
        setErro(result?.message || 'Erro ao buscar dados.');
        return;
      }
      const payload = result.data ?? result;
      setLinhas(
        (payload.dataRow || []).map((s) => ({
          code: s.seller_code,
          nome: s.seller_name,
          qtd: s.qtd,
          valor: s.valor,
          branches: s.branch_codes || [],
          porFilial: s.por_filial || {},
        })),
      );
      setVarejoPainel(payload.varejo || []);
    } catch (err) {
      if (isStale(tok)) return;
      setErro(err.message || 'Erro ao conectar com a API.');
    } finally {
      if (!isStale(tok)) setLoading(false);
    }
  };

  // ─── navegação do drill ────────────────────────────────────────────────────
  const pushView = (v) => setDrillStack((s) => [...s, v]);
  const popView = () => setDrillStack((s) => s.slice(0, -1));
  const closeDrill = () => setDrillStack([]);

  const abrirVendas = (vendedor, filtroFilial = null) => {
    pushView({
      tipo: 'vendas',
      titulo: vendedor.nome || `Vend. ${vendedor.code}`,
      sellerCode: vendedor.code,
      filtroFilial,
    });
    if (!vendasCache[vendedor.code]) {
      apiClient.totvs
        .salePanelFaturamentoVendedorDetalhe({
          seller_code: vendedor.code,
          filtroempresa: [],
          datemin: dataInicio,
          datemax: dataFim,
        })
        .then((r) => {
          const p = r?.data ?? r;
          setVendasCache((c) => ({
            ...c,
            [vendedor.code]: { vendas: p.vendas || [] },
          }));
        })
        .catch((e) => {
          setVendasCache((c) => ({
            ...c,
            [vendedor.code]: {
              vendas: [],
              erro: e.message || 'Erro ao buscar vendas.',
            },
          }));
        });
    }
  };

  const abrirVendedores = (titulo, vendedores, filtroFilial = null) => {
    pushView({
      tipo: 'vendedores',
      titulo,
      vendedores: [...vendedores].sort((a, b) => b.valor - a.valor),
      filtroFilial,
    });
  };

  // VAREJO: primeiro nível é a lista de filiais (dados do painel oficial,
  // mesma fonte do Ranking de Faturamento)
  const abrirFiliais = (titulo) => {
    const filiais = varejoPainel.map((b) => ({
      branch: b.branch_code,
      qtd: b.qtd,
      valor: b.valor,
      vendedores: (b.sellers || []).map((s) => ({
        code: s.seller_code,
        nome: s.seller_name,
        qtd: s.qtd,
        valor: s.valor,
      })),
    }));
    pushView({ tipo: 'filiais', titulo, filiais });
  };

  const viewAtual = drillStack[drillStack.length - 1] || null;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch justify-start py-3 px-2 gap-4">
      <PageTitle
        title="Painel de Vendas"
        subtitle="Faturamento por vendedor • TOTVS Moda"
        icon={ShoppingCart}
        iconColor="text-blue-600"
      />

      {/* Filtro de data */}
      <div className="bg-white p-3 rounded-lg shadow-md border border-[#000638]/10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Data Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
              Data Fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#000638] bg-[#f8f9fb] text-[#000638] text-xs"
            />
          </div>

          <div>
            <button
              onClick={handleBuscar}
              disabled={loading || !dataInicio || !dataFim}
              className="flex gap-1 items-center justify-center bg-[#000638] text-white px-4 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-8 text-xs font-bold shadow-md tracking-wide uppercase w-full"
            >
              {loading ? (
                <>
                  <Spinner size={12} className="animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <ChartBar size={12} />
                  Buscar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-16 gap-3 text-gray-500">
          <Spinner size={28} className="animate-spin text-[#000638]" />
          <span>Consultando TOTVS...</span>
        </div>
      )}

      {!loading && !linhas && !erro && (
        <div className="flex justify-center items-center py-16 text-gray-400 text-sm">
          Selecione o período e clique em "Buscar".
        </div>
      )}

      {!loading && linhas && linhas.length === 0 && varejoPainel.length === 0 && (
        <div className="flex justify-center items-center py-16 text-gray-400 text-sm">
          Nenhum vendedor no período.
        </div>
      )}

      {!loading &&
        linhas &&
        (linhas.length > 0 || varejoPainel.length > 0) &&
        (() => {
          // Remove o pseudo-vendedor GERAL (ajustes que o TOTVS não atribui)
          const semGeral = linhas.filter(
            (l) => !/\bGERAL\b/i.test(String(l.nome || '')),
          );
          const emGrupo = new Set(GRUPOS_FIXOS.flatMap((g) => g.codes));
          const grupos = GRUPOS_FIXOS.map((g) => ({
            ...g,
            membros: semGeral.filter((l) => g.codes.includes(Number(l.code))),
          })).filter((g) => g.membros.length > 0);
          // Individuais do atacado: fora dos grupos e com venda na 99.
          // O varejo NÃO vem mais daqui — vem do painel oficial (varejoPainel).
          const atacado = semGeral.filter(
            (l) =>
              !emGrupo.has(Number(l.code)) && (l.branches || []).includes(99),
          );

          const somar = (arr, campo) =>
            arr.reduce((a, v) => a + (v[campo] || 0), 0);

          const varejoValor = somar(varejoPainel, 'valor');
          const varejoQtd = somar(varejoPainel, 'qtd');
          const varejoVendedores = new Set(
            varejoPainel.flatMap((b) =>
              (b.sellers || []).map((s) => s.seller_code),
            ),
          ).size;

          const totalGeral =
            somar(grupos.flatMap((g) => g.membros), 'valor') +
            somar(atacado, 'valor') +
            varejoValor;
          const qtdGeral =
            somar(grupos.flatMap((g) => g.membros), 'qtd') +
            somar(atacado, 'qtd') +
            varejoQtd;

          const CardResumo = ({ titulo, subtitulo, valor, qtd, onClick }) => (
            <div
              onClick={onClick}
              className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-4 cursor-pointer hover:ring-2 hover:ring-[#000638]/30 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className="text-xs font-bold text-[#000638] uppercase tracking-wide truncate"
                  title={titulo}
                >
                  {titulo}
                </p>
                {subtitulo && (
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {subtitulo}
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-[#000638] mt-1">
                R$ {formatBRL(valor)}
              </p>
              <p className="text-[11px] text-gray-400">
                {formatInt(qtd)} venda(s)
              </p>
            </div>
          );

          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-end px-1">
                <span className="text-xs text-gray-500">
                  {formatInt(qtdGeral)} venda(s) &bull;{' '}
                  <span className="font-bold text-[#000638]">
                    Total R$ {formatBRL(totalGeral)}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
                {grupos.map((g) => (
                  <CardResumo
                    key={g.nome}
                    titulo={g.nome}
                    subtitulo={`${g.membros.length} vend.`}
                    valor={somar(g.membros, 'valor')}
                    qtd={somar(g.membros, 'qtd')}
                    onClick={() => abrirVendedores(g.nome, g.membros)}
                  />
                ))}
                {varejoPainel.length > 0 && (
                  <CardResumo
                    titulo="VAREJO"
                    subtitulo={`${varejoVendedores} vend.`}
                    valor={varejoValor}
                    qtd={varejoQtd}
                    onClick={() => abrirFiliais('VAREJO')}
                  />
                )}
                {atacado.map((v) => (
                  <CardResumo
                    key={v.code}
                    titulo={v.nome || `Vend. ${v.code}`}
                    subtitulo={`#${v.code}`}
                    valor={v.valor}
                    qtd={v.qtd}
                    onClick={() => abrirVendas(v)}
                  />
                ))}
              </div>
            </div>
          );
        })()}

      {/* Modal de drill (filiais → vendedores → vendas) */}
      {viewAtual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeDrill}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2 min-w-0">
                {drillStack.length > 1 && (
                  <button
                    onClick={popView}
                    className="p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
                    title="Voltar"
                  >
                    <CaretLeft size={16} className="text-gray-600" />
                  </button>
                )}
                <h2 className="text-sm font-bold text-[#000638] uppercase tracking-wide truncate">
                  {viewAtual.titulo}
                  {viewAtual.tipo === 'vendas' && viewAtual.filtroFilial
                    ? ` — Filial ${viewAtual.filtroFilial}`
                    : ''}
                </h2>
              </div>
              <button
                onClick={closeDrill}
                className="p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {/* Nível: filiais (VAREJO) */}
              {viewAtual.tipo === 'filiais' && (
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#000638]/5">
                      <th className="px-3 py-1.5 font-semibold text-[#000638] border-b">
                        Filial
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-[#000638] border-b text-right">
                        Vendedores
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-[#000638] border-b text-right">
                        Qtd
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-[#000638] border-b text-right">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewAtual.filiais.map((f) => (
                      <tr
                        key={f.branch}
                        onClick={() =>
                          abrirVendedores(
                            `Filial ${f.branch}`,
                            f.vendedores,
                            f.branch,
                          )
                        }
                        className="border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-1.5 text-gray-700 font-semibold">
                          {f.branch}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700 text-right">
                          {f.vendedores.length}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700 text-right">
                          {formatInt(f.qtd)}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700 text-right">
                          R$ {formatBRL(f.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Nível: vendedores */}
              {viewAtual.tipo === 'vendedores' && (
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#000638]/5">
                      <th className="px-3 py-1.5 font-semibold text-[#000638] border-b">
                        Código
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-[#000638] border-b">
                        Vendedor
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-[#000638] border-b text-right">
                        Qtd
                      </th>
                      <th className="px-3 py-1.5 font-semibold text-[#000638] border-b text-right">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewAtual.vendedores.map((v) => (
                      <tr
                        key={v.code}
                        onClick={() => abrirVendas(v, viewAtual.filtroFilial)}
                        className="border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-1.5 text-gray-700">{v.code}</td>
                        <td className="px-3 py-1.5 text-gray-700">
                          {v.nome || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700 text-right">
                          {formatInt(v.qtd)}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700 text-right">
                          R$ {formatBRL(v.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Nível: vendas do vendedor */}
              {/* Nível: clientes do vendedor (agrupados) */}
              {viewAtual.tipo === 'vendas' &&
                (() => {
                  const entry = vendasCache[viewAtual.sellerCode];
                  if (!entry) {
                    return (
                      <div className="flex justify-center items-center py-10 gap-3 text-gray-500">
                        <Spinner
                          size={22}
                          className="animate-spin text-[#000638]"
                        />
                        <span className="text-sm">Buscando vendas...</span>
                      </div>
                    );
                  }
                  if (entry.erro) {
                    return (
                      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                        {entry.erro}
                      </div>
                    );
                  }
                  const vendas = viewAtual.filtroFilial
                    ? entry.vendas.filter(
                        (v) =>
                          Number(v.branch_code) ===
                          Number(viewAtual.filtroFilial),
                      )
                    : entry.vendas;
                  if (vendas.length === 0) {
                    return (
                      <div className="text-center text-gray-400 text-sm py-8">
                        Nenhuma venda no período.
                      </div>
                    );
                  }
                  const clientes = agruparPorCliente(vendas);
                  const totalVendas = vendas.reduce(
                    (a, v) => a + (v.valor || 0),
                    0,
                  );
                  return (
                    <>
                      <p className="text-[11px] text-gray-400 mb-2">
                        {formatInt(clientes.length)} cliente(s) &bull;{' '}
                        {formatInt(vendas.length)} venda(s) &bull; R${' '}
                        {formatBRL(totalVendas)}
                      </p>
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-[#000638]/5">
                            <th className="px-3 py-1.5 font-semibold text-[#000638] border-b">
                              Código
                            </th>
                            <th className="px-3 py-1.5 font-semibold text-[#000638] border-b">
                              Cliente
                            </th>
                            <th className="px-3 py-1.5 font-semibold text-[#000638] border-b text-right">
                              Vendas
                            </th>
                            <th className="px-3 py-1.5 font-semibold text-[#000638] border-b text-right">
                              Valor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientes.map((c) => (
                            <tr
                              key={c.cliente_code}
                              onClick={() =>
                                pushView({
                                  tipo: 'faturas',
                                  titulo: c.cliente_nome,
                                  vendas: c.vendas,
                                })
                              }
                              className="border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              <td className="px-3 py-1.5 text-gray-700">
                                {c.cliente_code}
                              </td>
                              <td className="px-3 py-1.5 text-gray-700">
                                {c.cliente_nome}
                              </td>
                              <td className="px-3 py-1.5 text-gray-700 text-right">
                                {formatInt(c.qtd)}
                              </td>
                              <td className="px-3 py-1.5 text-gray-700 text-right whitespace-nowrap">
                                R$ {formatBRL(c.valor)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  );
                })()}

              {/* Nível: faturas de um cliente */}
              {viewAtual.tipo === 'faturas' && (
                <>
                  <p className="text-[11px] text-gray-400 mb-2">
                    {formatInt(viewAtual.vendas.length)} venda(s) &bull; R${' '}
                    {formatBRL(
                      viewAtual.vendas.reduce((a, v) => a + (v.valor || 0), 0),
                    )}
                  </p>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-[#000638]/5">
                        <th className="px-3 py-1.5 font-semibold text-[#000638] border-b">
                          Data
                        </th>
                        <th className="px-3 py-1.5 font-semibold text-[#000638] border-b">
                          Fatura
                        </th>
                        <th className="px-3 py-1.5 font-semibold text-[#000638] border-b">
                          Filial
                        </th>
                        <th className="px-3 py-1.5 font-semibold text-[#000638] border-b text-right">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewAtual.vendas.map((v, i) => (
                        <tr
                          key={i}
                          className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                            {formatData(v.data)}
                          </td>
                          <td className="px-3 py-1.5 text-gray-700">
                            {v.fatura || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-gray-700">
                            {v.branch_code}
                          </td>
                          <td className="px-3 py-1.5 text-gray-700 text-right whitespace-nowrap">
                            R$ {formatBRL(v.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
