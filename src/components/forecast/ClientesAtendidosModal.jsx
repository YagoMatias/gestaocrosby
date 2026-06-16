// Modal: lista de clientes atendidos por um vendedor no período.
// Aberto via clique no nome do vendedor (B2R/B2M, mensal ou semanal).
import React, { useEffect, useState, useCallback } from 'react';
import { X, UserCircle, Users, Receipt, Spinner } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

export default function ClientesAtendidosModal({
  open,
  onClose,
  canal,        // 'B2R' | 'B2M'
  sellerCode,
  sellerNome,
  ano,
  mes,
  semana,       // se vier, drilla pela semana; senão usa mes
  rangeLabel,   // ex: "Sem. 24" ou "Jun/2026"
}) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [clientes, setClientes] = useState([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    setClientes([]);
    try {
      const qs = new URLSearchParams({
        canal,
        seller_code: String(sellerCode),
        ano: String(ano),
      });
      if (semana) qs.set('semana', String(semana));
      else if (mes) qs.set('mes', String(mes));
      const r = await fetch(
        `${API_BASE_URL}/api/forecast/clientes-atendidos?${qs}`,
      );
      const j = await r.json();
      if (!r.ok || !j.success)
        throw new Error(j?.message || j?.error || 'Erro ao buscar');
      setClientes(j.data?.clientes || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [canal, sellerCode, ano, mes, semana]);

  useEffect(() => {
    if (open && sellerCode != null) carregar();
  }, [open, carregar, sellerCode]);

  if (!open) return null;

  const totalValor = clientes.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalNFs = clientes.reduce((s, c) => s + Number(c.nfs || 0), 0);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-white/80 p-2 rounded-full shadow-sm">
              <UserCircle size={22} weight="duotone" className="text-purple-700" />
            </div>
            <div>
              <div className="text-sm text-gray-500 leading-tight">
                Clientes atendidos · {canal} · {rangeLabel}
              </div>
              <div className="font-bold text-gray-900 text-lg leading-tight">
                {sellerNome}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/70 transition"
            aria-label="Fechar"
          >
            <X size={20} weight="bold" className="text-gray-600" />
          </button>
        </div>

        {/* KPIs */}
        {!loading && clientes.length > 0 && (
          <div className="grid grid-cols-3 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                <Users size={12} weight="bold" />
                Clientes
              </div>
              <div className="text-xl font-bold text-purple-700 mt-0.5">
                {clientes.length}
              </div>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                <Receipt size={12} weight="bold" />
                NFs
              </div>
              <div className="text-xl font-bold text-blue-700 mt-0.5">
                {totalNFs}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Total
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">
                R$ {formatBRL(totalValor)}
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Spinner size={28} className="animate-spin mb-2" />
              <span className="text-sm">Buscando clientes...</span>
            </div>
          ) : erro ? (
            <div className="p-5 text-sm text-red-600 bg-red-50 border-l-4 border-red-400 m-4 rounded">
              {erro}
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm">
              Nenhum cliente atendido no período.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-4 font-bold">#</th>
                  <th className="text-left py-2 px-4 font-bold">Cliente</th>
                  <th className="text-center py-2 px-3 font-bold w-[60px]">NFs</th>
                  <th className="text-right py-2 px-4 font-bold w-[110px]">Valor</th>
                  <th className="text-right py-2 px-4 font-bold w-[80px]">Última</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c, idx) => (
                  <tr
                    key={c.person_code}
                    className={`border-b border-gray-100 hover:bg-purple-50/30 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="py-2 px-4 text-gray-400 text-xs tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-4">
                      <div className="text-gray-800 font-medium text-[12.5px] leading-tight truncate max-w-[280px]" title={c.nome}>
                        {c.nome}
                      </div>
                      <div className="text-[10px] text-gray-400 tabular-nums mt-0.5">
                        cód {c.person_code}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center tabular-nums text-gray-700 font-semibold">
                      {c.nfs}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                      R$ {formatBRL(c.valor)}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-gray-500 text-xs">
                      {formatDate(c.ultima_data)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
