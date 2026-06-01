// Faturamento por Vendedor — MENSAL (todos os vendedores de revenda/multimarcas).
// Backend calcula somando as semanas do mês (leve e confiável), endpoint
// /forecast/vendedores-mensal. Mostra B2R e B2M com TODOS os vendedores.
import React, { useState, useEffect, useCallback } from 'react';
import { UsersThree } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';
import {
  MetricaHeader,
  PctPill,
  LoadingValue,
  formatBRL,
} from './MetricasDiariasUI';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function VendedoresMensal() {
  const now = new Date();
  const [ano, setAno] = useState(now.getUTCFullYear());
  const [mes, setMes] = useState(now.getUTCMonth() + 1);
  const [untilToday, setUntilToday] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  // Sob demanda: só carrega quando o usuário pedir (evita disparar a consulta
  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const periodoKey = `${ano}-${String(mes).padStart(2, '0')}`;
      const qs = `?periodo_tipo=mensal&periodo_key=${periodoKey}`;
      const r = await fetch(`${API_BASE_URL}/api/forecast/vendedores-db${qs}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) throw new Error(j?.message || `HTTP ${r.status}`);
      setData(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => { carregar(); }, [carregar]);

  const mesAnterior = () => {
    if (mes <= 1) { setAno(ano - 1); setMes(12); } else setMes(mes - 1);
  };
  const mesProximo = () => {
    if (mes >= 12) { setAno(ano + 1); setMes(1); } else setMes(mes + 1);
  };
  const irAtual = () => { setAno(now.getUTCFullYear()); setMes(now.getUTCMonth() + 1); };

  const cards = data?.cards || [];
  const fallback = data?.fallback_aplicado;
  const subt = fallback
    ? `${MESES[(mes || 1) - 1]}/${ano} sem dados · exibindo ${data?.periodo_key} · líquido · empresa 99`
    : `${MESES[(mes || 1) - 1]}/${ano} · líquido (bruto − credev) · empresa 99`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <MetricaHeader
        title="Faturamento por Vendedor — Mensal"
        subtitle={subt}
        icon={UsersThree}
        color="purple"
        onPrev={mesAnterior}
        onNext={mesProximo}
        onToday={irAtual}
        onRefresh={carregar}
        loading={loading}
      />

      {erro && (
        <div className="px-5 py-3 text-xs text-rose-700 bg-rose-50 border-b border-rose-200">
          Erro ao carregar: {erro}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
        {(loading && !data ? [{ code: 'B2R' }, { code: 'B2M' }] : cards).map((card) => (
          <CardVendedores key={card.code} card={card} loading={loading && !data} />
        ))}
      </div>
    </div>
  );
}

function CardVendedores({ card, loading }) {
  const vendedores = card?.vendedores || [];
  const total = Number(card?.total || 0);
  const meta = Number(card?.meta || 0);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-purple-800 to-purple-900 text-white flex items-center justify-between">
        <div>
          <p className="text-sm font-bold leading-tight">{card?.label || card?.code}</p>
          <p className="text-[10px] text-purple-200 mt-0.5">
            {vendedores.length} vendedor{vendedores.length === 1 ? '' : 'es'}
          </p>
        </div>
        <div className="text-right">
          {loading ? (
            <LoadingValue width={90} />
          ) : (
            <>
              <p className="text-sm font-extrabold tabular-nums">
                R$ {formatBRL(total)}
              </p>
              <p className="text-[10px] text-purple-200">/ R$ {formatBRL(meta)}</p>
            </>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200">
            <th className="text-left py-1.5 px-3 font-bold">Vendedor</th>
            <th className="text-right py-1.5 px-3 font-bold">Realizado</th>
            <th className="text-right py-1.5 px-3 font-bold">% do total</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 px-3"><LoadingValue width={110} /></td>
                <td className="py-2 px-3 text-right"><LoadingValue width={70} /></td>
                <td className="py-2 px-3 text-right"><LoadingValue width={40} /></td>
              </tr>
            ))
          ) : vendedores.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-center text-xs text-gray-400 py-5">
                Sem faturamento no período.
              </td>
            </tr>
          ) : (
            vendedores.map((v) => {
              const pct = total > 0 ? (v.real / total) * 100 : 0;
              return (
                <tr key={v.seller_code} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-800 truncate max-w-[160px]" title={v.nome}>
                    {v.nome}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                    R$ {formatBRL(v.real)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-500">
                    {pct.toFixed(0)}%
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {!loading && vendedores.length > 0 && (
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
              <td className="py-2 px-3 text-gray-800 text-[13px] uppercase tracking-wider">Total</td>
              <td className="py-2 px-3 text-right tabular-nums text-gray-900 whitespace-nowrap">
                R$ {formatBRL(total)}
              </td>
              <td className="py-2 px-3 text-right">
                {meta > 0 ? <PctPill pct={card.percentual} size="sm" /> : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
