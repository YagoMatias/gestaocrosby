// ============================================================================
// HEADCOACH › ESTOQUE › Estoque — o estoque das lojas.
// Desde 16/11/2026 o saldo de cada loja física vem do Dryland (ações lojas +
// saldo_loja da porta estq_gw do Estoquista): base = último balanço RFID da
// loja + movimentos lançados depois. Cada pessoa só vê as lojas dela
// (vendedor: a própria; owner/admin: todas) — a API aplica a mesma trava.
// Aba "Recebidos por transferência": o que a loja conferiu no Recebimento de
// Transferência do HeadCoach (hc_estoque_*).
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Stack, MagnifyingGlass, Spinner, ArrowsClockwise, Storefront, Package, CaretLeft, CaretRight } from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { apiJson } from '../utils/apiAuth';
import { Estoque } from './RecebimentoMercadoria';

const API = '/api/dryland-estoque';
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
const btnPri = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#000638] px-4 text-sm font-bold text-white hover:bg-[#000638]/90 disabled:opacity-40';
const btnSec = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40';
const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR');
const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Recife' }) : '—');
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' }) : '—');
const nomeBase = (b) => (b ? String(b).replace(/^balanco\s*/i, 'balanço nº ') : null);
const ABAS = [
  { k: 'saldo', label: 'Saldo da loja', icon: Storefront },
  { k: 'recebidos', label: 'Recebidos por transferência', icon: Package },
];

export default function HcEstoque() {
  const [aba, setAba] = useState('saldo');
  const [lojas, setLojas] = useState(null);
  const [loja, setLoja] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    apiJson(`${API}/lojas`)
      .then((j) => {
        const lista = j.data.lojas || [];
        setLojas(lista);
        if (lista.length === 1) setLoja(String(lista[0].code));
      })
      .catch((e) => {
        setLojas([]);
        setErro(e.message);
      });
  }, []);
  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-6xl">
        <PageTitle title="Estoque" subtitle="Saldo das lojas (Dryland: último balanço RFID + movimentos) — só as lojas que você tem cadastradas" icon={Stack} />
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="w-full sm:w-80">
            <label className={labelCls}>Loja</label>
            <select value={loja} onChange={(e) => setLoja(e.target.value)} className={inputCls} disabled={lojas === null}>
              {(lojas || []).length !== 1 && <option value="">{lojas === null ? 'Carregando…' : 'Todas as minhas lojas'}</option>}
              {(lojas || []).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code} — {l.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {ABAS.map((x) => (
              <button
                key={x.k}
                onClick={() => setAba(x.k)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${aba === x.k ? 'bg-[#000638] text-white' : 'text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50'}`}
              >
                <x.icon size={14} /> {x.label}
              </button>
            ))}
          </div>
        </div>
        {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {lojas && lojas.length === 0 ? (
          <p className="rounded-xl bg-white px-3 py-10 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200">Você não tem loja cadastrada. Peça ao administrador para vincular a sua loja no Painel Admin.</p>
        ) : !lojas ? (
          <div className="py-16 text-center text-gray-400">
            <Spinner size={22} className="mx-auto animate-spin" />
          </div>
        ) : aba === 'recebidos' ? (
          <Estoque empresa={loja} />
        ) : loja ? (
          <SaldoDaLoja loja={loja} />
        ) : (
          <ResumoLojas onEscolher={(c) => setLoja(String(c))} />
        )}
      </div>
    </div>
  );
}

// ─── todas as minhas lojas: uma linha por loja ───────────────────────────────
function ResumoLojas({ onEscolher }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const carregar = useCallback(async (forcar = false) => {
    setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/lojas/resumo${forcar ? '?forcar=1' : ''}`, { timeoutMs: 180000 });
      setD(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-gray-500">
          {d ? (
            <>
              <b className="text-[#000638]">{fmtNum(d.totais.pecas)}</b> peça(s) em {fmtNum(d.totais.codigos)} produto(s) nas suas lojas. Clique numa loja para ver o saldo.
            </>
          ) : (
            'Lendo o saldo de cada loja no Dryland…'
          )}
        </p>
        <button onClick={() => carregar(true)} disabled={carregando} className={btnSec}>
          <ArrowsClockwise size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>
      {erro && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {!d && carregando && (
        <div className="py-16 text-center text-gray-400">
          <Spinner size={22} className="mx-auto animate-spin" />
        </div>
      )}
      {d && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Loja</th>
                <th className="px-3 py-2 text-right">Peças</th>
                <th className="px-3 py-2 text-right">Produtos</th>
                <th className="px-3 py-2">Saldo a partir de</th>
                <th className="px-3 py-2">Último movimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {d.lojas.map((l) => (
                <tr key={l.code} onClick={() => onEscolher(l.code)} className="cursor-pointer hover:bg-indigo-50/50">
                  <td className="px-3 py-2 font-semibold text-[#000638]">
                    {l.code} — {l.nome}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{fmtNum(l.pecas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtNum(l.codigos)}</td>
                  <td className="px-3 py-2 text-gray-600">{l.base ? `${nomeBase(l.base)} de ${fmtData(l.baseEm)}` : '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-500">{fmtDataHora(l.atualizadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── uma loja: busca, classificação e páginas ────────────────────────────────
function SaldoDaLoja({ loja }) {
  const [busca, setBusca] = useState('');
  const [classe, setClasse] = useState('');
  const [pagina, setPagina] = useState(1);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const carregar = useCallback(
    async ({ pag = 1, forcar = false } = {}) => {
      setCarregando(true);
      setErro('');
      try {
        const qs = new URLSearchParams({ loja, pagina: String(pag), porPagina: '100', ...(busca.trim() ? { busca: busca.trim() } : {}), ...(classe ? { classificacao: classe } : {}), ...(forcar ? { forcar: '1' } : {}) });
        const j = await apiJson(`${API}/saldo-loja?${qs}`, { timeoutMs: 120000 });
        setD(j.data);
        setPagina(pag);
      } catch (e) {
        setErro(e.message);
      } finally {
        setCarregando(false);
      }
    },
    [loja, busca, classe],
  );
  // troca de loja ou de classificação: volta para a 1ª página
  useEffect(() => {
    carregar({ pag: 1 });
  }, [loja, classe]); // eslint-disable-line react-hooks/exhaustive-deps
  const paginas = d ? Math.max(1, Math.ceil(d.filtrado.codigos / d.porPagina)) : 1;
  return (
    <div className="space-y-3">
      {d && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Numero rotulo="Peças na loja" valor={fmtNum(d.totais.pecas)} />
          <Numero rotulo="Produtos" valor={fmtNum(d.totais.codigos)} />
          <Numero rotulo="Saldo a partir de" valor={d.base ? nomeBase(d.base) : '—'} sub={d.baseEm ? fmtData(d.baseEm) : null} pequeno />
          <Numero rotulo="Último movimento" valor={fmtDataHora(d.atualizadoEm)} pequeno />
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          carregar({ pag: 1 });
        }}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
      >
        <div className="min-w-[220px] flex-1">
          <label className={labelCls}>Produto (código ou descrição)</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex.: 31853 ou bermuda king" className={inputCls} />
        </div>
        <div className="w-full sm:w-64">
          <label className={labelCls}>Classificação</label>
          <select value={classe} onChange={(e) => setClasse(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {(d?.classificacoes || []).map((c) => (
              <option key={c.classificacao} value={c.classificacao}>
                {c.classificacao} ({fmtNum(c.pecas)})
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={carregando} className={btnPri}>
          {carregando ? <Spinner size={15} className="animate-spin" /> : <MagnifyingGlass size={15} weight="bold" />} BUSCAR
        </button>
        <button type="button" onClick={() => carregar({ pag: 1, forcar: true })} disabled={carregando} className={btnSec} title="Lê de novo no Dryland">
          <ArrowsClockwise size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
      </form>
      {erro && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {!d && carregando && (
        <div className="py-16 text-center text-gray-400">
          <Spinner size={22} className="mx-auto animate-spin" />
        </div>
      )}
      {d && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-xs">
            <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">Cor</th>
                <th className="px-3 py-2">Tam.</th>
                <th className="px-3 py-2">Classificação</th>
                <th className="px-3 py-2 text-right">Qtd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {d.itens.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                    Nenhum produto com saldo nesse filtro.
                  </td>
                </tr>
              )}
              {d.itens.map((i) => (
                <tr key={i.cod}>
                  <td className="px-3 py-1.5 font-mono tabular-nums text-gray-500">{i.cod}</td>
                  <td className="px-3 py-1.5 font-semibold text-gray-800">{i.descricao}</td>
                  <td className="px-3 py-1.5 text-gray-600">{i.cor || '—'}</td>
                  <td className="px-3 py-1.5 text-gray-600">{i.tamanho || '—'}</td>
                  <td className="px-3 py-1.5 text-gray-500">{i.classificacao || '—'}</td>
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums">{fmtNum(i.qtd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
            <span className="flex-1">
              {fmtNum(d.filtrado.codigos)} produto(s) · {fmtNum(d.filtrado.pecas)} peça(s){busca.trim() || classe ? ' no filtro' : ''}
            </span>
            <button onClick={() => carregar({ pag: pagina - 1 })} disabled={carregando || pagina <= 1} className={btnSec}>
              <CaretLeft size={12} /> Anterior
            </button>
            <span className="tabular-nums">
              {pagina} / {paginas}
            </span>
            <button onClick={() => carregar({ pag: pagina + 1 })} disabled={carregando || pagina >= paginas} className={btnSec}>
              Próxima <CaretRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, sub, pequeno }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className={`${pequeno ? 'text-sm' : 'text-xl'} font-bold tabular-nums text-[#000638]`}>{valor}</p>
      {sub && <p className="text-[10.5px] text-gray-400">{sub}</p>}
    </div>
  );
}
