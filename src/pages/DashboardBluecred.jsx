// Dashboard BlueCred — ranking de lojas por vendas no boleto/crediário.
// Destaques: loja com mais vendas, maior ticket médio e mais clientes de boleto.
// Filtro de data (padrão: mês atual). Fonte: /api/crm/bluecred-dashboard.
import React, { useState, useEffect, useCallback } from 'react';
import {
  ChartBar,
  Funnel,
  Spinner,
  Trophy,
  CurrencyDollar,
  Receipt,
  UsersThree,
  CalendarBlank,
  Storefront,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import PageTitle from '../components/ui/PageTitle';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fmtInt = (v) => Number(v || 0).toLocaleString('pt-BR');
const fmtData = (s) => {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

// Primeiro dia do mês atual (YYYY-MM-DD, horário local)
const primeiroDiaMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const hojeStr = () => {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
};

function CardDestaque({ icon: Icon, cor, titulo, loja, valor }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${cor.bg}`}>
          <Icon size={18} className={cor.text} weight="bold" />
        </div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {titulo}
        </span>
      </div>
      {loja ? (
        <>
          <div className="text-lg font-bold text-[#000638] flex items-center gap-1">
            <Trophy size={16} className="text-amber-500" weight="fill" />
            {loja.branch_name}
          </div>
          <div className="text-sm text-gray-600">{valor(loja)}</div>
        </>
      ) : (
        <div className="text-sm text-gray-400 py-2">—</div>
      )}
    </div>
  );
}

export default function DashboardBluecred() {
  const [datemin, setDatemin] = useState(primeiroDiaMes());
  const [datemax, setDatemax] = useState(hojeStr());
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const url = new URL('/api/crm/bluecred-dashboard', API_BASE_URL);
      if (datemin) url.searchParams.append('datemin', datemin);
      if (datemax) url.searchParams.append('datemax', datemax);
      const res = await fetch(url.toString(), {
        headers: API_KEY ? { 'x-api-key': API_KEY } : {},
      });
      if (!res.ok) {
        let body = null;
        try {
          body = await res.json();
        } catch {}
        throw new Error(
          (body && (body.message || body.error)) || `Erro ${res.status}`,
        );
      }
      const json = await res.json();
      setDados(json?.data || json);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar dashboard');
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, [datemin, datemax]);

  // Carrega automaticamente ao abrir (mês atual)
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = dados || {};
  const lojas = d.lojas || [];
  const dest = d.destaques || {};

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <PageTitle
          title="Dashboard BlueCred"
          subtitle="Ranking de lojas por vendas no boleto/crediário"
          icon={ChartBar}
          iconColor="text-blue-600"
        />

        {/* Filtros */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            carregar();
          }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 flex flex-wrap items-end gap-3"
        >
          <div className="flex items-center gap-1 text-[#000638] font-bold text-sm mr-2">
            <Funnel size={16} weight="bold" /> Filtros
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 mb-1">De</label>
            <div className="relative">
              <CalendarBlank
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="date"
                value={datemin}
                onChange={(e) => setDatemin(e.target.value)}
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-500 mb-1">Até</label>
            <div className="relative">
              <CalendarBlank
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="date"
                value={datemax}
                onChange={(e) => setDatemax(e.target.value)}
                className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg px-5 py-2 text-sm flex items-center gap-2"
          >
            {loading ? (
              <Spinner size={16} className="animate-spin" />
            ) : (
              <Funnel size={16} />
            )}
            Atualizar
          </button>
          {dados && (
            <span className="text-xs text-gray-500 ml-auto self-center">
              Período {fmtData(d.datemin)} a {fmtData(d.datemax)} · vendas no
              boleto
            </span>
          )}
        </form>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
            {erro}
          </div>
        )}

        {loading && (
          <div className="text-center text-gray-400 py-10">
            <Spinner size={26} className="animate-spin inline" /> Carregando…
          </div>
        )}

        {!loading && dados && (
          <>
            {/* Cards de destaque */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <CardDestaque
                icon={CurrencyDollar}
                cor={{ bg: 'bg-emerald-50', text: 'text-emerald-600' }}
                titulo="Loja com mais vendas"
                loja={dest.mais_vendas}
                valor={(l) => `R$ ${fmtBRL(l.total_vendas)} em boleto`}
              />
              <CardDestaque
                icon={Receipt}
                cor={{ bg: 'bg-indigo-50', text: 'text-indigo-600' }}
                titulo="Maior ticket médio"
                loja={dest.maior_ticket}
                valor={(l) => `R$ ${fmtBRL(l.ticket_medio)} por venda`}
              />
              <CardDestaque
                icon={UsersThree}
                cor={{ bg: 'bg-amber-50', text: 'text-amber-600' }}
                titulo="Mais clientes de boleto"
                loja={dest.mais_clientes_boleto}
                valor={(l) => `${fmtInt(l.num_clientes_boleto)} clientes`}
              />
            </div>

            {/* Totais gerais */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="text-xs text-gray-500">Faturamento boleto (total)</div>
                <div className="text-lg font-bold text-emerald-700">
                  R$ {fmtBRL(d.total_geral)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="text-xs text-gray-500">Clientes de boleto</div>
                <div className="text-lg font-bold text-amber-700">
                  {fmtInt(d.total_clientes_boleto)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="text-xs text-gray-500">Lojas com boleto</div>
                <div className="text-lg font-bold text-[#000638]">
                  {fmtInt(d.total_lojas)}
                </div>
              </div>
            </div>

            {/* Tabela de lojas */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Storefront size={16} className="text-[#000638]" weight="bold" />
                <span className="font-bold text-[#000638] text-sm">
                  Lojas ({lojas.length})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-semibold">#</th>
                      <th className="text-left px-4 py-3 font-semibold">Loja</th>
                      <th className="text-right px-4 py-3 font-semibold">
                        Faturamento boleto
                      </th>
                      <th className="text-right px-4 py-3 font-semibold">NFs</th>
                      <th className="text-right px-4 py-3 font-semibold">
                        Ticket médio
                      </th>
                      <th className="text-right px-4 py-3 font-semibold">
                        Clientes boleto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lojas.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-10 text-center text-gray-400"
                        >
                          Nenhuma venda no boleto no período.
                        </td>
                      </tr>
                    )}
                    {lojas.map((l, i) => (
                      <tr
                        key={l.branch_code}
                        className="border-t border-gray-100 hover:bg-blue-50/40"
                      >
                        <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {l.branch_name}
                          <span className="text-gray-400 font-normal ml-1">
                            ({l.branch_code})
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">
                          R$ {fmtBRL(l.total_vendas)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {fmtInt(l.num_nfs)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-indigo-700">
                          R$ {fmtBRL(l.ticket_medio)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-amber-700 font-semibold">
                          {fmtInt(l.num_clientes_boleto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
