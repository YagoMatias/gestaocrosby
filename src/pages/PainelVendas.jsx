import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Funnel,
  Spinner,
  CurrencyDollar,
  Receipt,
  ChartBar,
  Tag,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import FiltroEmpresa from '../components/FiltroEmpresa';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/cards';
import useApiClient from '../hooks/useApiClient';

// ─── helpers ─────────────────────────────────────────────────────────────────
const formatBRL = (v) =>
  typeof v === 'number'
    ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v !== undefined && v !== null
    ? String(v)
    : '—';

const formatInt = (v) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR') : v !== undefined && v !== null ? String(v) : '—';

const isMonetary = (key) =>
  /value|amount|total|gross|net|discount|ticket|receita|faturamento|preco|price/i.test(key);

const isQuantity = (key) => /quantity|qty|count|amount/i.test(key) && !isMonetary(key);

function MetricCard({ title, value, icon: Icon, color = 'text-blue-600', bg = 'bg-blue-50' }) {
  return (
    <Card className="flex-1 min-w-[160px]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-full ${bg} shrink-0`}>
          <Icon size={20} className={color} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium truncate">{title}</p>
          <p className="text-base font-bold text-[#000638] truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RawDataCard({ data }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(
    ([, v]) => v !== null && v !== undefined && typeof v !== 'object',
  );
  if (entries.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-[#000638]">Detalhes retornados pela API</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
          {entries.map(([key, val]) => (
            <div key={key}>
              <dt className="text-xs text-gray-400 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </dt>
              <dd className="text-sm font-semibold text-[#000638]">
                {isMonetary(key) ? `R$ ${formatBRL(Number(val))}` : formatInt(Number.isFinite(Number(val)) ? Number(val) : val)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function PainelVendas() {
  const apiClient = useApiClient();

  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [totals, setTotals] = useState(null);

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
    setLoading(true);
    setErro('');
    setTotals(null);
    try {
      const filtroempresa =
        empresasSelecionadas.length > 0
          ? empresasSelecionadas.map((e) => parseInt(e.cd_empresa))
          : [];

      const result = await apiClient.totvs.salePanelTotals({
        filtroempresa,
        datemin: `${dataInicio}T00:00:00.000Z`,
        datemax: `${dataFim}T23:59:59.999Z`,
      });

      if (result && (result.success !== false)) {
        // apiMutate devolve o resultado bruto; data pode estar em result.data ou result diretamente
        const payload = result.data ?? result;
        setTotals(payload);
      } else {
        setErro(result?.message || 'Erro ao buscar dados.');
      }
    } catch (err) {
      setErro(err.message || 'Erro ao conectar com a API.');
    } finally {
      setLoading(false);
    }
  };

  const handleLimpar = () => {
    setTotals(null);
    setErro('');
  };

  // ─── cards de destaque ────────────────────────────────────────────────────
  const cards = totals
    ? [
        totals.netValue !== undefined && {
          title: 'Faturamento Líquido',
          value: `R$ ${formatBRL(totals.netValue)}`,
          icon: CurrencyDollar,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
        },
        totals.grossValue !== undefined && {
          title: 'Faturamento Bruto',
          value: `R$ ${formatBRL(totals.grossValue)}`,
          icon: ChartBar,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        totals.discountValue !== undefined && {
          title: 'Descontos',
          value: `R$ ${formatBRL(totals.discountValue)}`,
          icon: Tag,
          color: 'text-orange-500',
          bg: 'bg-orange-50',
        },
        totals.quantity !== undefined && {
          title: 'Qtd. Transações',
          value: formatInt(totals.quantity),
          icon: Receipt,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
        totals.averageTicket !== undefined && {
          title: 'Ticket Médio',
          value: `R$ ${formatBRL(totals.averageTicket)}`,
          icon: ShoppingCart,
          color: 'text-cyan-600',
          bg: 'bg-cyan-50',
        },
      ].filter(Boolean)
    : [];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-stretch justify-start py-3 px-2 gap-4">
      <PageTitle
        title="Painel de Vendas"
        subtitle="Faturamento total • TOTVS Moda"
        icon={ShoppingCart}
        iconColor="text-blue-600"
      />

      {/* Filtros */}
      <div className="bg-white p-3 rounded-lg shadow-md border border-[#000638]/10">
        <span className="text-sm font-bold text-[#000638] flex items-center gap-1 mb-2">
          <Funnel size={16} weight="bold" />
          Filtros
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
          {/* Filtro empresa */}
          <div>
            <FiltroEmpresa
              empresasSelecionadas={empresasSelecionadas}
              onSelectEmpresas={setEmpresasSelecionadas}
            />
          </div>

          {/* Data início */}
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

          {/* Data fim */}
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

          {/* Buscar */}
          <div>
            <button
              onClick={handleBuscar}
              disabled={loading || !dataInicio || !dataFim}
              className="flex gap-1 items-center justify-center bg-[#000638] text-white px-4 py-1.5 rounded-lg hover:bg-[#fe0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-8 text-xs font-bold shadow-md tracking-wide uppercase w-full mt-4"
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

          {/* Limpar */}
          {totals && (
            <div>
              <button
                onClick={handleLimpar}
                className="flex gap-1 items-center justify-center border border-gray-300 text-gray-600 px-4 py-1.5 rounded-lg hover:bg-gray-100 transition-colors h-8 text-xs font-semibold w-full mt-4"
              >
                <ArrowCounterClockwise size={12} />
                Limpar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-16 gap-3 text-gray-500">
          <Spinner size={28} className="animate-spin text-[#000638]" />
          <span>Consultando TOTVS...</span>
        </div>
      )}

      {/* Estado inicial */}
      {!loading && !totals && !erro && (
        <div className="flex justify-center items-center py-16 text-gray-400 text-sm">
          Selecione o período e clique em "Buscar" para ver o faturamento total.
        </div>
      )}

      {/* Resultados */}
      {!loading && totals && (
        <>
          {/* Cards de destaque */}
          {cards.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {cards.map((c) => (
                <MetricCard key={c.title} {...c} />
              ))}
            </div>
          )}

          {/* Detalhes completos da API */}
          <RawDataCard data={totals} />

          {/* Se vier array de itens */}
          {Array.isArray(totals) && totals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#000638]">
                  Itens retornados ({totals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#000638]/5">
                      {Object.keys(totals[0]).map((k) => (
                        <th
                          key={k}
                          className="px-3 py-2 font-semibold text-[#000638] whitespace-nowrap border-b"
                        >
                          {k.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        {Object.entries(row).map(([k, v]) => (
                          <td key={k} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                            {isMonetary(k) && typeof v === 'number'
                              ? `R$ ${formatBRL(v)}`
                              : v !== null && v !== undefined
                              ? String(v)
                              : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Se não houver nada reconhecível */}
          {cards.length === 0 &&
            !(Array.isArray(totals) && totals.length > 0) &&
            Object.entries(totals).filter(([, v]) => v !== null && typeof v !== 'object').length === 0 && (
              <Card>
                <CardContent className="p-4 text-sm text-gray-500">
                  <pre className="overflow-x-auto text-xs">{JSON.stringify(totals, null, 2)}</pre>
                </CardContent>
              </Card>
            )}
        </>
      )}
    </div>
  );
}
