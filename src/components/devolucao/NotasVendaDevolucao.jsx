// Devolução RFID — notas de VENDA do cliente que a devolução vai referenciar.
// O operador busca as notas emitidas para o cliente naquela empresa (TOTVS +
// HeadCoach), escolhe as que quer e o servidor confere se cada peça lida está
// nelas (services/devolucaoRfidHc.js). A NF-e de devolução sai com essas notas
// referenciadas e com o valor que o cliente pagou em cada peça.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, CheckCircle, FileText, MagicWand, Spinner, Warning, X } from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDia = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const isoHaDias = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const PERIODOS = [
  { dias: 90, label: '3 meses' },
  { dias: 180, label: '6 meses' },
  { dias: 365, label: '1 ano' },
  { dias: 730, label: '2 anos' },
];

/**
 * Peça que NÃO ACHOU nas notas escolhidas: o operador referencia OUTRA nota só
 * para ela (Yago, 18/11/2026). Lista as notas do cliente (até 2 anos) e aceita a
 * chave de acesso de qualquer nota de venda da empresa. Se a peça estiver na
 * nota, entra pelo valor pago; se não, pelo valor da tabela do cliente.
 *
 * @param peca      { productCode, name, unit }
 * @param onEscolher ({ chave, numero, serie }) => void
 */
export function OutraNotaModal({ empresa, cliente, peca, atual = null, onEscolher, onFechar }) {
  const [lista, setLista] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dias, setDias] = useState(365);
  const [filtro, setFiltro] = useState('');
  const [chave, setChave] = useState('');
  const cod = Number(peca?.productCode);

  const buscar = useCallback(
    async (diasBusca) => {
      if (!empresa || !cliente?.code) return;
      setLoading(true);
      setErro('');
      try {
        const qs = new URLSearchParams({ empresa, cliente: cliente.code, de: isoHaDias(diasBusca), ate: new Date().toISOString().slice(0, 10) });
        const r = await fetch(`${API_BASE_URL}/api/devolucao-rfid/notas-venda?${qs}`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao buscar as notas de venda');
        setLista(j.data.notas || []);
      } catch (e) {
        setErro(e.message);
        setLista([]);
      } finally {
        setLoading(false);
      }
    },
    [empresa, cliente?.code],
  );

  useEffect(() => {
    buscar(dias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, cliente?.code]);

  const qtdDaPeca = (n) => (n.itens || []).filter((i) => Number(i.productCode) === cod).reduce((s, i) => s + Number(i.quantidade || 0), 0);
  const visiveis = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const base = (lista || []).filter(
      (n) =>
        !q ||
        String(n.numero).includes(q) ||
        String(n.ref || '').toLowerCase().includes(q) ||
        (n.itens || []).some((i) => String(i.productCode).includes(q) || String(i.nome || '').toLowerCase().includes(q)),
    );
    // as que têm a peça primeiro
    return [...base].sort((a, b) => Number(qtdDaPeca(b) > 0) - Number(qtdDaPeca(a) > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, filtro, cod]);

  const chaveLimpa = chave.replace(/\D/g, '');
  const usarChave = () => {
    if (chaveLimpa.length !== 44) return;
    onEscolher({ chave: chaveLimpa, numero: Number(chaveLimpa.slice(25, 34)), serie: String(Number(chaveLimpa.slice(22, 25))) });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 p-4 border-b border-gray-100">
          <FileText size={18} weight="bold" className="text-[#000638] mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#000638]">Referenciar outra nota — só para esta peça</p>
            <p className="text-xs text-gray-600 truncate">
              <b>{peca?.name}</b> · cód. {cod}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Se a peça estiver na nota escolhida, entra pelo valor que o cliente pagou nela. Se não estiver, entra com o valor da tabela do cliente
              {Number(peca?.unit) > 0 ? ` (${fmtBRL(peca.unit)})` : ''} e a tributação das notas do cliente. A nota escolhida vai referenciada na NF-e de devolução.
            </p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="flex flex-wrap items-end gap-2 mb-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Vendas dos últimos</label>
              <div className="inline-flex rounded-lg ring-1 ring-gray-300 bg-white p-0.5">
                {PERIODOS.map((p) => (
                  <button
                    key={p.dias}
                    type="button"
                    onClick={() => {
                      setDias(p.dias);
                      buscar(p.dias);
                    }}
                    className={`h-7 px-2 rounded-md text-[11px] font-semibold ${dias === p.dias ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-gray-50'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por nº da nota, peça ou código…"
              className="h-8 px-2 rounded-lg border border-gray-300 text-xs mb-0 w-64 max-w-full"
            />
          </div>

          {erro && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-2 py-1.5 ring-1 ring-rose-200">{erro}</p>}
          {loading && (
            <p className="text-xs text-gray-400 py-2 inline-flex items-center gap-1.5">
              <Spinner size={13} className="animate-spin" /> Buscando as notas de venda do cliente…
            </p>
          )}
          {!loading && lista && lista.length === 0 && !erro && <p className="text-xs text-gray-500 py-1">Nenhuma nota de venda deste cliente no período. Tente um período maior ou cole a chave abaixo.</p>}
          {!loading && visiveis.length > 0 && (
            <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200 bg-white max-h-[46vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">NF</th>
                    <th className="px-2 py-1.5 text-left">Emissão</th>
                    <th className="px-2 py-1.5 text-left">Operação / pedido</th>
                    <th className="px-2 py-1.5 text-right">Peças</th>
                    <th className="px-2 py-1.5 text-right">Total</th>
                    <th className="px-2 py-1.5 text-center">Tem esta peça</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visiveis.map((n) => {
                    const tem = qtdDaPeca(n);
                    const sel = atual?.chave === n.chave;
                    return (
                      <tr key={n.chave} className={sel ? 'bg-violet-50/70' : 'hover:bg-gray-50/60'}>
                        <td className="px-2 py-1.5 font-mono font-bold text-[#000638] whitespace-nowrap">
                          {n.numero}/{n.serie}
                          {Number(n.modelo) === 65 && <span className="ml-1 font-sans font-normal text-gray-400">NFC-e</span>}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtDia(n.data)}</td>
                        <td className="px-2 py-1.5 truncate max-w-[220px]" title={n.ref || ''}>
                          {n.ref || '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{n.quantidade}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(n.total)}</td>
                        <td className="px-2 py-1.5 text-center">
                          {tem > 0 ? <span className="font-bold text-emerald-700">{tem} pç</span> : <span className="text-gray-300">não</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            onClick={() => onEscolher({ chave: n.chave, numero: n.numero, serie: n.serie })}
                            className="h-7 px-2.5 rounded-lg text-[11px] font-bold text-white bg-[#000638] hover:bg-[#000638]/90"
                          >
                            {sel ? 'Escolhida' : 'Usar esta'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Ou cole a chave de acesso de qualquer nota de venda desta empresa</label>
            <div className="flex flex-wrap gap-2">
              <input
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && usarChave()}
                placeholder="44 dígitos"
                className="h-8 px-2 rounded-lg border border-gray-300 text-xs font-mono mb-0 flex-1 min-w-[260px]"
              />
              <button
                onClick={usarChave}
                disabled={chaveLimpa.length !== 44}
                className="h-8 px-3 rounded-lg text-xs font-bold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-40"
              >
                Usar a chave
              </button>
            </div>
            {chaveLimpa.length > 0 && chaveLimpa.length !== 44 && <p className="mt-1 text-[11px] text-amber-700">A chave tem {chaveLimpa.length} dígitos — precisa de 44.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @param empresa       código da empresa da devolução
 * @param cliente       { code, name }
 * @param itens         peças lidas: [{ productCode, quantidade }]
 * @param selecionadas  notas escolhidas (objetos da lista)
 * @param onChange      (notas) => void
 * @param conferencia   resposta do servidor (/api/devolucao-rfid/conferir) ou null
 * @param conferindo    true enquanto o servidor confere
 * @param erroConferencia  mensagem de erro da conferência (nota de outra empresa etc.)
 */
export default function NotasVendaDevolucao({ empresa, cliente, itens = [], selecionadas = [], onChange, conferencia = null, conferindo = false, erroConferencia = '' }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState(null); // null = ainda não buscou
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dias, setDias] = useState(180);
  const [filtro, setFiltro] = useState('');

  const chavesSel = useMemo(() => new Set(selecionadas.map((n) => n.chave)), [selecionadas]);
  const lidos = useMemo(() => new Map(itens.map((i) => [Number(i.productCode), Number(i.quantidade) || 0])), [itens]);

  const buscar = useCallback(
    async (diasBusca = dias) => {
      if (!empresa || !cliente?.code) return;
      setLoading(true);
      setErro('');
      try {
        const qs = new URLSearchParams({ empresa, cliente: cliente.code, de: isoHaDias(diasBusca), ate: new Date().toISOString().slice(0, 10) });
        const r = await fetch(`${API_BASE_URL}/api/devolucao-rfid/notas-venda?${qs}`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao buscar as notas de venda');
        setLista(j.data.notas || []);
        setAvisos(j.data.avisos || []);
      } catch (e) {
        setErro(e.message);
        setLista([]);
      } finally {
        setLoading(false);
      }
    },
    [empresa, cliente?.code, dias],
  );

  // trocou de cliente ou de empresa: a lista antiga não vale mais
  useEffect(() => {
    setLista(null);
    setAvisos([]);
    setErro('');
    setFiltro('');
    setAberto(false);
  }, [empresa, cliente?.code]);

  const abrir = () => {
    setAberto(true);
    if (lista === null) buscar();
  };

  const alternar = (nota) => {
    if (chavesSel.has(nota.chave)) onChange(selecionadas.filter((n) => n.chave !== nota.chave));
    else onChange([...selecionadas, nota]);
  };

  // quantas das peças lidas aparecem em cada nota
  const lidasNaNota = useCallback(
    (nota) => {
      let n = 0;
      const porProduto = new Map();
      for (const it of nota.itens || []) porProduto.set(it.productCode, (porProduto.get(it.productCode) || 0) + Number(it.quantidade || 0));
      for (const [cod, q] of lidos) if (porProduto.has(cod)) n += Math.min(q, porProduto.get(cod));
      return n;
    },
    [lidos],
  );

  // Escolhe sozinho as notas que cobrem as peças lidas (da mais recente para a mais antiga)
  const sugerir = () => {
    if (!lista?.length || lidos.size === 0) return;
    const falta = new Map(lidos);
    const escolhidas = [];
    for (const nota of lista) {
      let usou = false;
      for (const it of nota.itens || []) {
        const f = falta.get(it.productCode) || 0;
        if (f <= 0) continue;
        falta.set(it.productCode, f - Math.min(f, Number(it.quantidade || 0)));
        usou = true;
      }
      if (usou) escolhidas.push(nota);
      if ([...falta.values()].every((v) => v <= 0)) break;
    }
    onChange(escolhidas);
  };

  const visiveis = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!lista) return [];
    if (!q) return lista;
    return lista.filter(
      (n) =>
        String(n.numero).includes(q) ||
        String(n.ref || '').toLowerCase().includes(q) ||
        (n.itens || []).some((i) => String(i.productCode).includes(q) || String(i.nome || '').toLowerCase().includes(q)),
    );
  }, [lista, filtro]);

  const temNota = selecionadas.length > 0;
  const recusadas = conferencia ? conferencia.itens.filter((i) => !i.ok).length : 0;

  return (
    <div className={`mb-2 rounded-xl border shadow-sm p-3 ${temNota ? 'bg-violet-50 border-violet-200' : 'bg-white border-amber-300'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <FileText size={16} weight="bold" className="text-[#000638]" />
        <div className="flex-1 min-w-[220px]">
          <p className="text-xs font-bold text-[#000638]">
            Notas de venda referenciadas{temNota ? ` · ${selecionadas.length}` : ''}
          </p>
          <p className="text-[11px] text-gray-500">
            {temNota
              ? 'A NF-e de devolução referencia estas notas e usa o valor que o cliente pagou em cada peça.'
              : 'A devolução precisa de nota fiscal referenciada: busque as notas de venda do cliente e escolha as das peças que estão voltando.'}
          </p>
        </div>
        {conferindo && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <Spinner size={12} className="animate-spin" /> conferindo…
          </span>
        )}
        {!conferindo && conferencia && temNota && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 text-[11px] font-semibold ${
              conferencia.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
            }`}
          >
            {conferencia.ok ? <CheckCircle size={12} weight="fill" /> : <Warning size={12} weight="bold" />}
            {conferencia.ok ? 'todas as peças estão nas notas' : `${recusadas} peça(s) fora das notas`}
          </span>
        )}
        <button
          onClick={aberto ? () => setAberto(false) : abrir}
          disabled={!cliente?.code || !empresa}
          title={!empresa ? 'Selecione a empresa primeiro' : !cliente?.code ? 'Selecione o cliente primeiro' : ''}
          className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-[#000638] hover:bg-[#000638]/90 disabled:opacity-40"
        >
          {aberto ? 'Fechar a lista' : temNota ? 'Trocar / adicionar notas' : 'Buscar notas do cliente'}
        </button>
      </div>

      {temNota && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selecionadas.map((n) => {
            const usada = conferencia?.notas?.find((x) => x.chave === n.chave)?.usada;
            return (
              <span
                key={n.chave}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white ring-1 text-[11px] text-[#000638] ${usada === false ? 'ring-amber-300' : 'ring-violet-200'}`}
                title={n.ref || ''}
              >
                <b className="font-mono">NF {n.numero}/{n.serie}</b>
                <span className="text-gray-500">
                  {fmtDia(n.data)} · {n.quantidade} pç · {fmtBRL(n.total)}
                </span>
                {usada === false && <span className="text-amber-700 font-semibold">sem peça lida</span>}
                <button onClick={() => alternar(n)} className="text-gray-400 hover:text-rose-500" title="Tirar esta nota">
                  <X size={12} weight="bold" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {erroConferencia && (
        <p className="mt-2 text-xs text-rose-700 bg-rose-50 rounded-lg px-2 py-1.5 ring-1 ring-rose-200 inline-flex items-start gap-1.5">
          <Warning size={13} weight="bold" className="mt-0.5 shrink-0" /> {erroConferencia}
        </p>
      )}
      {(conferencia?.avisos || []).map((a) => (
        <p key={a} className="mt-1 text-[11px] text-amber-700">
          {a}
        </p>
      ))}

      {aberto && (
        <div className="mt-2 pt-2 border-t border-gray-200/70">
          <div className="flex flex-wrap items-end gap-2 mb-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Vendas dos últimos</label>
              <div className="inline-flex rounded-lg ring-1 ring-gray-300 bg-white p-0.5">
                {PERIODOS.map((p) => (
                  <button
                    key={p.dias}
                    type="button"
                    onClick={() => {
                      setDias(p.dias);
                      buscar(p.dias);
                    }}
                    className={`h-7 px-2 rounded-md text-[11px] font-semibold ${dias === p.dias ? 'bg-[#000638] text-white' : 'text-[#000638] hover:bg-gray-50'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por nº da nota, peça ou código…"
              className="h-8 px-2 rounded-lg border border-gray-300 text-xs mb-0 w-64 max-w-full"
            />
            <button onClick={() => buscar()} disabled={loading} className="h-8 px-3 rounded-lg text-xs font-semibold text-[#000638] ring-1 ring-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1.5">
              <ArrowsClockwise size={13} className={loading ? 'animate-spin' : ''} /> Buscar de novo
            </button>
            <button
              onClick={sugerir}
              disabled={!lista?.length || lidos.size === 0}
              title={lidos.size === 0 ? 'Leia as peças primeiro' : 'Marca as notas mais recentes que contêm as peças lidas'}
              className="h-8 px-3 rounded-lg text-xs font-bold text-violet-700 ring-1 ring-violet-300 bg-white hover:bg-violet-50 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <MagicWand size={13} weight="bold" /> Marcar as notas das peças lidas
            </button>
            <div className="flex-1" />
            <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600">
              <X size={15} weight="bold" />
            </button>
          </div>

          {erro && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-2 py-1.5 ring-1 ring-rose-200">{erro}</p>}
          {avisos.map((a) => (
            <p key={a} className="mb-1 text-[11px] text-amber-700">
              {a}
            </p>
          ))}
          {loading && (
            <p className="text-xs text-gray-400 py-2 inline-flex items-center gap-1.5">
              <Spinner size={13} className="animate-spin" /> Buscando as notas de venda do cliente…
            </p>
          )}
          {!loading && lista && lista.length === 0 && !erro && <p className="text-xs text-gray-500 py-1">Nenhuma nota de venda para este cliente nesta empresa no período. Tente um período maior.</p>}
          {!loading && visiveis.length > 0 && (
            <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200 bg-white max-h-[46vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 w-8" />
                    <th className="px-2 py-1.5 text-left">NF</th>
                    <th className="px-2 py-1.5 text-left">Emissão</th>
                    <th className="px-2 py-1.5 text-left">Origem</th>
                    <th className="px-2 py-1.5 text-left">Operação / pedido</th>
                    <th className="px-2 py-1.5 text-right">Peças</th>
                    <th className="px-2 py-1.5 text-right">Total</th>
                    <th className="px-2 py-1.5 text-right">Peças lidas nela</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visiveis.map((n) => {
                    const sel = chavesSel.has(n.chave);
                    const lidas = lidasNaNota(n);
                    return (
                      <tr key={n.chave} onClick={() => alternar(n)} className={`cursor-pointer hover:bg-gray-50/60 ${sel ? 'bg-violet-50/70' : ''}`}>
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={sel} onChange={() => alternar(n)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 p-0 mb-0" />
                        </td>
                        <td className="px-2 py-1.5 font-mono font-bold text-[#000638] whitespace-nowrap">
                          {n.numero}/{n.serie}
                          {Number(n.modelo) === 65 && <span className="ml-1 font-sans font-normal text-gray-400">NFC-e</span>}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtDia(n.data)}</td>
                        <td className="px-2 py-1.5">{n.origem === 'headcoach' ? 'HeadCoach' : 'TOTVS'}</td>
                        <td className="px-2 py-1.5 truncate max-w-[260px]" title={n.ref || ''}>
                          {n.ref || '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{n.quantidade}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBRL(n.total)}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${lidas > 0 ? 'text-violet-700' : 'text-gray-300'}`}>{lidas || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
