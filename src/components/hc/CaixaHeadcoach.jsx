// ============================================================================
// Caixa do HeadCoach (HEADCOACH › Caixa) nas telas de venda — PDV Crosby e
// Faturamento (Yago, 12–13/11/2026): card com o cadeado (verde aberto,
// vermelho fechado) que leva à página do caixa, e o modal "Caixa fechado"
// que abre o caixa ali mesmo, sem perder a venda em andamento.
// API: /api/hc/caixa (services/hcCaixa.js).
// ============================================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LockOpen, Spinner } from '@phosphor-icons/react';
import { apiJson } from '../../utils/apiAuth';

// Situação do caixa (HEADCOACH › Caixa) da empresa da venda.
// { aberto, id, desde, por, data, hoje, dataAtrasada, fundoSugerido } | { erro } | null
export async function lerCaixa(branch) {
  try {
    const j = await apiJson(`/api/hc/caixa/situacao?empresa=${encodeURIComponent(branch)}`, { timeoutMs: 20000 });
    const d = j.data || {};
    const c = d.caixa?.caixa || null;
    return { aberto: !!c, id: c?.id, desde: c?.aberto_em, por: c?.aberto_por, data: d.dataCaixa, hoje: d.hoje, dataAtrasada: !!d.dataAtrasada, fundoSugerido: d.fundoSugerido };
  } catch (e) {
    return { erro: e.message };
  }
}
export const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

// Ir para a página do caixa (avisa se tem venda em andamento, que se perde ao sair)
export function useIrParaCaixa(branch, temItens) {
  const navigate = useNavigate();
  return () => {
    if (temItens && !window.confirm('Tem peças na venda. Ir para o caixa agora descarta a venda em andamento. Continuar?')) return;
    try {
      if (branch) localStorage.setItem('hc_caixa_empresa', String(branch));
    } catch {
      /* sem storage */
    }
    navigate('/headcoach/caixa/abertura');
  };
}

// Card do caixa no topo: cadeado aberto (verde) com o caixa aberto, fechado
// (vermelho) sem caixa. Clicar abre a página do caixa.
export function CaixaCard({ branch, sit, temItens }) {
  const abrir = useIrParaCaixa(branch, temItens);
  const dataTxt = sit?.data ? String(sit.data).split('-').reverse().join('/') : '';
  const aberto = sit && !sit.erro && sit.aberto;
  const fechado = sit && !sit.erro && !sit.aberto;
  const cls = aberto
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-300 hover:bg-emerald-100'
    : fechado
      ? 'bg-rose-50 text-rose-700 ring-rose-300 hover:bg-rose-100'
      : 'bg-gray-50 text-gray-500 ring-gray-300 hover:bg-gray-100';
  const titulo = !branch
    ? 'Escolha a empresa para ver o caixa'
    : sit?.erro
      ? `Caixa: ${sit.erro}`
      : aberto
        ? `Caixa #${sit.id} aberto${sit.por ? ` por ${sit.por}` : ''}${sit.desde ? ` em ${new Date(sit.desde).toLocaleString('pt-BR')}` : ''} · data de caixa ${dataTxt} — clique para abrir o caixa`
        : fechado
          ? `Caixa fechado · data de caixa ${dataTxt} — clique para abrir o caixa`
          : 'Carregando o caixa…';
  return (
    <button
      type="button"
      onClick={abrir}
      title={titulo}
      className={`h-9 shrink-0 rounded-lg px-2.5 ring-1 inline-flex items-center gap-1.5 text-[11px] font-bold leading-none ${cls}`}
    >
      {aberto ? <LockOpen size={16} weight="bold" /> : <Lock size={16} weight={fechado ? 'fill' : 'regular'} />}
      <span className="flex flex-col items-start gap-0.5">
        <span>{aberto ? 'CAIXA ABERTO' : fechado ? 'CAIXA FECHADO' : 'CAIXA'}</span>
        {(aberto || fechado) && <span className="text-[9.5px] font-semibold opacity-80">{aberto ? `#${sit.id} · ${dataTxt}` : dataTxt}</span>}
      </span>
    </button>
  );
}

// Venda com o caixa fechado: pede para abrir o caixa (ali mesmo, sem perder a venda)
export function CaixaFechadoModal({ branch, sit, temItens, onAberto, onCancelar }) {
  const irParaCaixa = useIrParaCaixa(branch, temItens);
  const [fundo, setFundo] = useState(sit?.fundoSugerido != null ? String(sit.fundoSugerido).replace('.', ',') : '');
  const [encerrar, setEncerrar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const atrasada = !!sit?.dataAtrasada;
  const abrir = async () => {
    setBusy(true);
    setErro('');
    try {
      const j = await apiJson('/api/hc/caixa/abrir', {
        method: 'POST',
        body: {
          empresa: parseInt(branch, 10),
          fundoInicial: Number(String(fundo || '0').replace(/\./g, '').replace(',', '.')) || 0,
          observacao: 'Aberto pelo PDV Crosby',
          encerrarAnterior: atrasada && encerrar,
        },
      });
      onAberto(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <Lock size={20} weight="fill" />
          </span>
          <div>
            <h3 className="text-lg font-bold leading-tight text-[#000638]">Caixa fechado</h3>
            <p className="text-xs text-gray-500">Empresa {branch} · data de caixa {dataBR(sit?.data)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-700">Só dá para vender com o caixa aberto. Abra o caixa para continuar a venda.</p>
        <label className="mt-3 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">Fundo de troco (dinheiro no caixa)</label>
        <input
          autoFocus
          inputMode="decimal"
          value={fundo}
          onChange={(e) => setFundo(e.target.value)}
          placeholder="0,00"
          className="mb-0 mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-base font-bold tabular-nums text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
        />
        {sit?.fundoSugerido != null && <p className="mt-1 text-[10.5px] text-gray-400">O caixa anterior deixou R$ {Number(sit.fundoSugerido).toFixed(2).replace('.', ',')}.</p>}
        {atrasada && (
          <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 ring-1 ring-amber-300">
            <input type="checkbox" checked={encerrar} onChange={(e) => setEncerrar(e.target.checked)} className="mt-0.5" />
            <span>
              O dia {dataBR(sit.data)} não foi encerrado. Encerrar {dataBR(sit.data)} e abrir o caixa em hoje ({dataBR(sit.hoje)}).
            </span>
          </label>
        )}
        {erro && <p className="mt-3 rounded-lg bg-rose-50 px-2.5 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        <button
          type="button"
          onClick={abrir}
          disabled={busy || (atrasada && !encerrar)}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {busy ? <Spinner size={16} className="animate-spin" /> : <LockOpen size={16} weight="bold" />} ABRIR CAIXA
        </button>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onCancelar} disabled={busy} className="h-9 flex-1 rounded-lg text-xs font-bold text-gray-600 ring-1 ring-gray-300">
            Voltar
          </button>
          <button type="button" onClick={irParaCaixa} disabled={busy} className="h-9 flex-1 rounded-lg text-xs font-bold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50">
            Ir para o caixa
          </button>
        </div>
      </div>
    </div>
  );
}
