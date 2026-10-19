// Modal "Selecionar duplicatas" da provisão automática (Liberação de Pagamento).
//
// Mostra as duplicatas específicas que a rotina diária provisiona (além das
// despesas fixas por código), permite remover e pesquisar outras no Contas a
// Pagar do TOTVS para incluir. Backend: /api/provisao-liberacao/* (apigestaocrosby).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  ListChecks,
  MagnifyingGlass,
  PlusCircle,
  Spinner,
  Trash,
  X,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import { apiJson } from '../utils/apiAuth';

const fmtBRL = (v) =>
  parseFloat(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).split('T')[0].split('-');
  return `${day}/${m}/${y}`;
};

const hojeIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const primeiroDiaMes = () => `${hojeIso().slice(0, 7)}-01`;

const addMeses = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

const TIPOS_BUSCA_FORN = [
  { value: 'nome', label: 'Nome' },
  { value: 'fantasia', label: 'Fantasia' },
  { value: 'cnpj_cpf', label: 'CNPJ/CPF' },
  { value: 'codigo', label: 'Código' },
];

const chave = (r) => `${r.cd_fornecedor}|${String(r.nr_duplicata)}`;

const inputCls =
  'w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#000638]';
const labelCls = 'text-[10px] font-bold uppercase text-gray-500 mb-0.5 block';

const ModalSelecionarDuplicatasProvisao = ({ onClose, podeEditar }) => {
  // ── lista atual ──
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState(null);
  const [removendoId, setRemovendoId] = useState(null);

  // ── busca de fornecedor (TOTVS) ──
  const [tipoBusca, setTipoBusca] = useState('nome');
  const [termoBusca, setTermoBusca] = useState('');
  const [buscandoForn, setBuscandoForn] = useState(false);
  const [fornResultados, setFornResultados] = useState([]);
  const [fornSelecionado, setFornSelecionado] = useState(null);

  // ── busca de duplicatas (Contas a Pagar) ──
  const [nrDuplicata, setNrDuplicata] = useState('');
  const [dtInicio, setDtInicio] = useState(primeiroDiaMes());
  const [dtFim, setDtFim] = useState(addMeses(hojeIso(), 3));
  const [buscandoDup, setBuscandoDup] = useState(false);
  const [resultados, setResultados] = useState(null); // null = ainda não buscou
  const [erroBusca, setErroBusca] = useState(null);
  const [marcadas, setMarcadas] = useState(() => new Set());
  const [adicionando, setAdicionando] = useState(false);

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const j = await apiJson('/api/provisao-liberacao/duplicatas');
      setLista(j?.data?.itens || []);
    } catch (e) {
      setErroLista(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  const chavesNaLista = useMemo(() => new Set(lista.map(chave)), [lista]);

  const remover = async (item) => {
    if (
      !window.confirm(
        `Remover a duplicata ${item.nr_duplicata} de ${item.nm_fornecedor || `Cód. ${item.cd_fornecedor}`} da provisão automática?`,
      )
    )
      return;
    setRemovendoId(item.id);
    try {
      await apiJson(`/api/provisao-liberacao/duplicatas/${item.id}`, {
        method: 'DELETE',
      });
      setLista((p) => p.filter((x) => x.id !== item.id));
      setResultados((p) =>
        p
          ? p.map((r) =>
              chave(r) === chave(item) ? { ...r, ja_na_automacao: false } : r,
            )
          : p,
      );
    } catch (e) {
      alert('Erro ao remover: ' + e.message);
    } finally {
      setRemovendoId(null);
    }
  };

  const selecionarForn = (f) => {
    setFornSelecionado(f);
    setFornResultados([]);
    setTermoBusca('');
  };

  const buscarFornecedor = async () => {
    const termo = termoBusca.trim();
    if (!termo) {
      alert('Digite um valor para buscar o fornecedor.');
      return;
    }
    if (tipoBusca === 'codigo') {
      const code = parseInt(termo, 10);
      if (isNaN(code) || code <= 0) {
        alert('Código inválido.');
        return;
      }
      selecionarForn({
        cd_pessoa: code,
        nm_pessoa: `Fornecedor Cód. ${code}`,
        nm_fantasia: null,
        cpf: null,
      });
      return;
    }
    setBuscandoForn(true);
    setFornResultados([]);
    try {
      let qp = '';
      if (tipoBusca === 'nome') qp = `nome=${encodeURIComponent(termo)}`;
      else if (tipoBusca === 'fantasia')
        qp = `fantasia=${encodeURIComponent(termo)}`;
      else if (tipoBusca === 'cnpj_cpf')
        qp = `cnpj=${encodeURIComponent(termo.replace(/\D/g, ''))}`;
      const res = await fetch(
        `${API_BASE_URL}/api/totvs/clientes/search-name?${qp}`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const found = (data?.data?.clientes || []).map((f) => ({
        cd_pessoa: f.code,
        nm_pessoa: f.nm_pessoa,
        nm_fantasia: f.fantasy_name || null,
        cpf: f.cpf || null,
      }));
      if (found.length === 0) alert('Nenhum fornecedor encontrado.');
      else if (found.length === 1) selecionarForn(found[0]);
      else setFornResultados(found);
    } catch {
      alert('Erro ao buscar fornecedor.');
    } finally {
      setBuscandoForn(false);
    }
  };

  const buscarDuplicatas = async () => {
    if (!fornSelecionado && !nrDuplicata.trim()) {
      alert('Selecione um fornecedor ou informe o número da duplicata.');
      return;
    }
    if (!dtInicio || !dtFim) {
      alert('Informe o período de vencimento.');
      return;
    }
    setBuscandoDup(true);
    setErroBusca(null);
    setMarcadas(new Set());
    try {
      const j = await apiJson('/api/provisao-liberacao/buscar', {
        method: 'POST',
        body: {
          dt_inicio: dtInicio,
          dt_fim: dtFim,
          cd_fornecedor: fornSelecionado?.cd_pessoa ?? null,
          nr_duplicata: nrDuplicata.trim() || null,
        },
        timeoutMs: 190000,
      });
      setResultados(j?.data?.itens || []);
    } catch (e) {
      setErroBusca(e.message);
      setResultados([]);
    } finally {
      setBuscandoDup(false);
    }
  };

  const toggleMarcada = (k) =>
    setMarcadas((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  // Resultados agrupados por par (fornecedor, duplicata): a automação trabalha
  // por duplicata inteira (todas as parcelas), então a seleção é por par.
  const grupos = useMemo(() => {
    if (!resultados) return [];
    const map = new Map();
    for (const r of resultados) {
      const k = chave(r);
      if (!map.has(k)) {
        map.set(k, {
          chave: k,
          cd_fornecedor: r.cd_fornecedor,
          nm_fornecedor: r.nm_fornecedor,
          nr_duplicata: r.nr_duplicata,
          ja_na_automacao: r.ja_na_automacao || chavesNaLista.has(k),
          parcelas: [],
          total: 0,
        });
      }
      const g = map.get(k);
      g.parcelas.push(r);
      g.total += parseFloat(r.vl_duplicata || 0);
    }
    return [...map.values()];
  }, [resultados, chavesNaLista]);

  const disponiveis = grupos.filter((g) => !g.ja_na_automacao);
  const todasMarcadas =
    disponiveis.length > 0 && disponiveis.every((g) => marcadas.has(g.chave));

  const adicionarMarcadas = async () => {
    const itens = grupos
      .filter((g) => marcadas.has(g.chave) && !g.ja_na_automacao)
      .map((g) => {
        const p = g.parcelas[0] || {};
        return {
          cd_fornecedor: g.cd_fornecedor,
          nm_fornecedor: g.nm_fornecedor,
          nr_duplicata: g.nr_duplicata,
          cd_empresa: p.cd_empresa,
          nr_parcela: g.parcelas.length === 1 ? p.nr_parcela : null,
          dt_vencimento: p.dt_vencimento,
          vl_duplicata: g.total,
          ds_despesaitem: p.ds_despesaitem,
        };
      });
    if (itens.length === 0) {
      alert('Marque ao menos uma duplicata para adicionar.');
      return;
    }
    setAdicionando(true);
    try {
      const j = await apiJson('/api/provisao-liberacao/duplicatas', {
        method: 'POST',
        body: { itens },
      });
      const inseridas = j?.data?.inseridas || [];
      setLista((p) => [...p, ...inseridas]);
      const chavesNovas = new Set(itens.map(chave));
      setResultados((p) =>
        p
          ? p.map((r) =>
              chavesNovas.has(chave(r)) ? { ...r, ja_na_automacao: true } : r,
            )
          : p,
      );
      setMarcadas(new Set());
    } catch (e) {
      alert('Erro ao adicionar: ' + e.message);
    } finally {
      setAdicionando(false);
    }
  };

  const totalLista = lista.reduce(
    (s, i) => s + parseFloat(i.vl_duplicata || 0),
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 p-5 w-full max-w-4xl mx-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
              <ListChecks size={16} weight="bold" className="text-orange-500" />
              Duplicatas na provisão automática
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Além das despesas fixas (salários, energia, água, telefone,
              internet, vale, férias, rescisão), a rotina das 07:00 provisiona
              as duplicatas abaixo enquanto estiverem em aberto no Contas a
              Pagar, com vencimento dentro do mês corrente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 shrink-0"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* ── Lista atual ── */}
        <div className="border border-orange-200 rounded-lg overflow-hidden mb-4">
          <div className="flex items-center justify-between bg-orange-50 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase text-orange-700">
              Na automação ({lista.length})
            </span>
            <span className="text-[10px] text-orange-700 font-semibold">
              {fmtBRL(totalLista)}
            </span>
          </div>
          {carregando ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500">
              <Spinner size={14} className="animate-spin" /> Carregando...
            </div>
          ) : erroLista ? (
            <div className="px-3 py-3 text-xs text-red-600">{erroLista}</div>
          ) : lista.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500">
              Nenhuma duplicata específica selecionada. Pesquise abaixo para
              incluir.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Fornecedor</th>
                    <th className="px-2 py-1 text-left">Cód.</th>
                    <th className="px-2 py-1 text-left">Duplicata</th>
                    <th className="px-2 py-1 text-left">Venc. (ref.)</th>
                    <th className="px-2 py-1 text-right">Valor (ref.)</th>
                    <th className="px-2 py-1 text-left">Despesa</th>
                    <th className="px-2 py-1 text-left">Incluído por</th>
                    {podeEditar && <th className="px-2 py-1" />}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-2 py-1 font-semibold text-gray-800">
                        {item.nm_fornecedor || '—'}
                      </td>
                      <td className="px-2 py-1 font-mono text-gray-600">
                        {item.cd_fornecedor}
                      </td>
                      <td className="px-2 py-1 font-mono text-gray-800">
                        {item.nr_duplicata}
                        {item.nr_parcela ? `/${item.nr_parcela}` : ''}
                      </td>
                      <td className="px-2 py-1 text-gray-600">
                        {fmtDate(item.dt_vencimento)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-800">
                        {item.vl_duplicata != null
                          ? fmtBRL(item.vl_duplicata)
                          : '—'}
                      </td>
                      <td className="px-2 py-1 text-gray-600 truncate max-w-[160px]">
                        {item.ds_despesaitem || '—'}
                      </td>
                      <td className="px-2 py-1 text-gray-500 truncate max-w-[140px]">
                        {item.adicionado_por || '—'}
                      </td>
                      {podeEditar && (
                        <td className="px-2 py-1 text-right">
                          <button
                            onClick={() => remover(item)}
                            disabled={removendoId === item.id}
                            title="Remover da automação"
                            className="text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            {removendoId === item.id ? (
                              <Spinner size={13} className="animate-spin" />
                            ) : (
                              <Trash size={13} weight="bold" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Busca no Contas a Pagar ── */}
        {podeEditar && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-2 flex items-center gap-1">
              <MagnifyingGlass size={11} />
              Buscar duplicatas no Contas a Pagar (TOTVS)
            </p>

            {/* Fornecedor */}
            <div className="flex gap-1.5 mb-2">
              <select
                value={tipoBusca}
                onChange={(e) => {
                  setTipoBusca(e.target.value);
                  setFornResultados([]);
                }}
                className="border border-gray-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-[#000638] w-28 shrink-0"
              >
                {TIPOS_BUSCA_FORN.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarFornecedor()}
                placeholder={`Fornecedor por ${TIPOS_BUSCA_FORN.find((t) => t.value === tipoBusca)?.label.toLowerCase()}...`}
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#000638]"
              />
              <button
                onClick={buscarFornecedor}
                disabled={buscandoForn}
                className="flex items-center gap-1 bg-[#000638] hover:bg-[#001060] disabled:opacity-50 text-white text-xs font-semibold px-2.5 py-1 rounded transition-colors"
              >
                {buscandoForn ? (
                  <Spinner size={11} className="animate-spin" />
                ) : (
                  <MagnifyingGlass size={11} weight="bold" />
                )}
                Fornecedor
              </button>
            </div>

            {fornResultados.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-36 overflow-y-auto mb-2 bg-white">
                <table className="w-full text-[10px]">
                  <thead className="bg-[#000638] text-white">
                    <tr>
                      <th className="px-2 py-1 text-left">Cód.</th>
                      <th className="px-2 py-1 text-left">Nome</th>
                      <th className="px-2 py-1 text-left">Fantasia</th>
                      <th className="px-2 py-1 text-left">CPF/CNPJ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fornResultados.map((f) => (
                      <tr
                        key={f.cd_pessoa}
                        onClick={() => selecionarForn(f)}
                        className="border-t border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-2 py-1 font-mono text-gray-600">
                          {f.cd_pessoa}
                        </td>
                        <td className="px-2 py-1 font-semibold text-gray-800">
                          {f.nm_pessoa}
                        </td>
                        <td className="px-2 py-1 text-gray-500">
                          {f.nm_fantasia || '—'}
                        </td>
                        <td className="px-2 py-1 text-gray-500">
                          {f.cpf || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {fornSelecionado && (
              <div className="mb-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                <CheckCircle
                  size={13}
                  weight="bold"
                  className="text-green-600 shrink-0"
                />
                <p className="text-xs font-semibold text-green-800 truncate">
                  {fornSelecionado.nm_pessoa}
                </p>
                <span className="ml-auto text-[10px] text-green-700 font-mono shrink-0">
                  Cód. {fornSelecionado.cd_pessoa}
                </span>
                <button
                  onClick={() => setFornSelecionado(null)}
                  className="text-green-600 hover:text-red-600"
                  title="Limpar fornecedor"
                >
                  <X size={13} weight="bold" />
                </button>
              </div>
            )}

            {/* Duplicata + período */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
              <div>
                <label className={labelCls}>Nº duplicata (opcional)</label>
                <input
                  value={nrDuplicata}
                  onChange={(e) => setNrDuplicata(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarDuplicatas()}
                  placeholder="Ex.: 598"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Venc. de</label>
                <input
                  type="date"
                  value={dtInicio}
                  onChange={(e) => setDtInicio(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Venc. até</label>
                <input
                  type="date"
                  value={dtFim}
                  onChange={(e) => setDtFim(e.target.value)}
                  className={inputCls}
                />
              </div>
              <button
                onClick={buscarDuplicatas}
                disabled={buscandoDup}
                className="flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
              >
                {buscandoDup ? (
                  <Spinner size={12} className="animate-spin" />
                ) : (
                  <MagnifyingGlass size={12} weight="bold" />
                )}
                {buscandoDup ? 'Buscando...' : 'Buscar duplicatas'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Só títulos Normais em aberto, nas filiais (exclui franquias). A
              busca pode levar alguns segundos.
            </p>

            {erroBusca && (
              <div className="mt-2 text-xs text-red-600">{erroBusca}</div>
            )}

            {/* Resultados */}
            {resultados && !erroBusca && (
              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white">
                <div className="flex items-center justify-between bg-gray-100 px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase text-gray-600">
                    {grupos.length} duplicata(s) · {resultados.length}{' '}
                    parcela(s)
                  </span>
                  <div className="flex items-center gap-2">
                    {disponiveis.length > 0 && (
                      <button
                        onClick={() =>
                          setMarcadas(
                            todasMarcadas
                              ? new Set()
                              : new Set(disponiveis.map((g) => g.chave)),
                          )
                        }
                        className="text-[10px] text-gray-600 hover:text-gray-900 underline"
                      >
                        {todasMarcadas ? 'Desmarcar todas' : 'Marcar todas'}
                      </button>
                    )}
                    <button
                      onClick={adicionarMarcadas}
                      disabled={adicionando || marcadas.size === 0}
                      className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-2.5 py-1 rounded transition-colors"
                    >
                      {adicionando ? (
                        <Spinner size={11} className="animate-spin" />
                      ) : (
                        <PlusCircle size={11} weight="bold" />
                      )}
                      Adicionar à automação ({marcadas.size})
                    </button>
                  </div>
                </div>
                {grupos.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-500">
                    Nenhuma duplicata em aberto encontrada com esses filtros.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 w-6" />
                          <th className="px-2 py-1 text-left">Fornecedor</th>
                          <th className="px-2 py-1 text-left">Cód.</th>
                          <th className="px-2 py-1 text-left">Duplicata</th>
                          <th className="px-2 py-1 text-left">Parcelas</th>
                          <th className="px-2 py-1 text-left">Vencimentos</th>
                          <th className="px-2 py-1 text-right">Total</th>
                          <th className="px-2 py-1 text-left">Despesa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupos.map((g) => {
                          const p0 = g.parcelas[0] || {};
                          const vencs = [
                            ...new Set(
                              g.parcelas.map((p) => fmtDate(p.dt_vencimento)),
                            ),
                          ];
                          return (
                            <tr
                              key={g.chave}
                              onClick={() =>
                                !g.ja_na_automacao && toggleMarcada(g.chave)
                              }
                              className={`border-t border-gray-100 transition-colors ${
                                g.ja_na_automacao
                                  ? 'bg-orange-50/60 text-gray-500'
                                  : marcadas.has(g.chave)
                                    ? 'bg-green-50 cursor-pointer'
                                    : 'hover:bg-gray-50 cursor-pointer'
                              }`}
                            >
                              <td className="px-2 py-1">
                                {g.ja_na_automacao ? (
                                  <CheckCircle
                                    size={13}
                                    weight="fill"
                                    className="text-orange-500"
                                    title="Já está na automação"
                                  />
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={marcadas.has(g.chave)}
                                    onChange={() => toggleMarcada(g.chave)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                              </td>
                              <td className="px-2 py-1 font-semibold text-gray-800">
                                {g.nm_fornecedor || '—'}
                                {g.ja_na_automacao && (
                                  <span className="ml-1 text-[9px] font-bold uppercase text-orange-600">
                                    já incluída
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1 font-mono text-gray-600">
                                {g.cd_fornecedor}
                              </td>
                              <td className="px-2 py-1 font-mono text-gray-800">
                                {g.nr_duplicata}
                              </td>
                              <td className="px-2 py-1 text-gray-600">
                                {g.parcelas
                                  .map((p) => p.nr_parcela || '—')
                                  .join(', ')}
                              </td>
                              <td className="px-2 py-1 text-gray-600">
                                {vencs.slice(0, 3).join(', ')}
                                {vencs.length > 3 ? ` +${vencs.length - 3}` : ''}
                              </td>
                              <td className="px-2 py-1 text-right text-gray-800">
                                {fmtBRL(g.total)}
                              </td>
                              <td className="px-2 py-1 text-gray-600 truncate max-w-[160px]">
                                {p0.ds_despesaitem || '—'}
                              </td>
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
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="text-xs px-4 py-1.5 bg-gray-200 hover:bg-gray-300 rounded font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalSelecionarDuplicatasProvisao;
