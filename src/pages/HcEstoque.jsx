// ============================================================================
// HEADCOACH › ESTOQUE › Estoque (Yago, 13/11/2026) — o estoque da loja.
// Cada pessoa só vê as lojas dela (vendedor: a própria; owner/admin: todas) —
// a API (/api/recebimento-mercadoria/estoque) aplica a mesma trava.
// Por enquanto o estoque é o que a loja recebeu por transferência (Recebimento
// de Transferência); vendas e devoluções entram depois.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { Stack } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { apiJson } from '../utils/apiAuth';
import { Estoque } from './RecebimentoMercadoria';

const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';

export default function HcEstoque() {
  const [empresas, setEmpresas] = useState(null);
  const [empresa, setEmpresa] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    apiJson('/api/hc/caixa/empresas')
      .then((j) => {
        const lista = j.data.empresas || [];
        setEmpresas(lista);
        if (lista.length === 1) setEmpresa(String(lista[0].code));
      })
      .catch((e) => {
        setEmpresas([]);
        setErro(e.message);
      });
  }, []);
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-6xl">
        <PageTitle title="Estoque" subtitle="Estoque da loja — só as lojas que você tem cadastradas" icon={Stack} />
        <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="w-full sm:w-80">
            <label className={labelCls}>Loja</label>
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inputCls} disabled={empresas === null}>
              {(empresas || []).length !== 1 && <option value="">{empresas === null ? 'Carregando…' : 'Todas as minhas lojas'}</option>}
              {(empresas || []).map((e) => (
                <option key={e.code} value={e.code}>
                  {e.code} — {e.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {empresas && empresas.length === 0 ? (
          <p className="rounded-xl bg-white px-3 py-10 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200">Você não tem loja cadastrada. Peça ao administrador para vincular a sua loja no Painel Admin.</p>
        ) : (
          empresas && <Estoque empresa={empresa} />
        )}
      </div>
    </div>
  );
}
