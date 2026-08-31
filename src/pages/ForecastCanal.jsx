// Forecast do Canal — placar de competição dos vendedores.
// Uma página só, aberta por canal a partir do sidebar:
//   /forecast-canal/varejo · /forecast-canal/revenda ·
//   /forecast-canal/multimarcas · /forecast-canal/franquias
// Ranking do mês, campeão do mês e da semana, pódio; auto-atualiza a cada
// 30min. Botão de TELA CHEIA pra deixar rodando numa TV (fontes maiores).
import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Trophy,
  Lightning,
  ArrowsClockwise,
  Spinner,
  Storefront,
  CornersOut,
  CornersIn,
  User,
  X,
} from '@phosphor-icons/react';
import useApiClient from '../hooks/useApiClient';
import {
  CANAIS_COMPETICAO,
  useCompeticaoCanais,
  RankingBarras,
  rankingDoCanal,
  formatBRL,
  ddmm,
  primeiroNome,
  nomeFranquia,
} from '../components/forecast/CompeticaoCanais';

const diaLabel = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' });
  return `${semana.replace('.', '')} · ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

// Agrupa a lista de vendas por dia (mais recente primeiro)
const agrupaPorDia = (vendas) => {
  const mapa = new Map();
  for (const v of vendas || []) {
    const dia = String(v.data || '').slice(0, 10);
    const cur = mapa.get(dia) || { dia, valor: 0, vendas: [] };
    cur.valor = Math.round((cur.valor + (v.valor || 0)) * 100) / 100;
    cur.vendas.push(v);
    mapa.set(dia, cur);
  }
  return [...mapa.values()].sort((a, b) => b.dia.localeCompare(a.dia));
};

const iniciais = (nome) =>
  primeiroNome(nome)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();

const CampeaoCard = ({ titulo, item, icone: Icone, periodoTxt, tv }) => (
  <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-4 flex items-center gap-3">
    <div
      className={`${tv ? 'w-14 h-14' : 'w-11 h-11'} rounded-full bg-[#000638]/5 flex items-center justify-center shrink-0`}
    >
      <Icone size={tv ? 26 : 20} className="text-[#000638]" />
    </div>
    <div className="min-w-0">
      <p
        className={`${tv ? 'text-xs' : 'text-[11px]'} font-semibold uppercase tracking-wide text-gray-500`}
      >
        {titulo}{' '}
        {periodoTxt && <span className="font-normal">· {periodoTxt}</span>}
      </p>
      {item ? (
        <>
          <p
            className={`${tv ? 'text-lg' : 'text-sm'} font-bold truncate text-[#000638]`}
            title={item.nome}
          >
            {item.nome}
          </p>
          <p className={`${tv ? 'text-xl' : 'text-base'} font-extrabold text-[#000638]`}>
            {formatBRL(item.valor)}
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-400">sem vendas ainda</p>
      )}
    </div>
  </div>
);

const Podio = ({ itens, tv, fmtNome = primeiroNome }) => {
  const [p1, p2, p3] = itens;
  const Coluna = ({ item, pos, altura }) =>
    item ? (
      <div className="flex flex-col items-center justify-end flex-1 min-w-0">
        <span
          className={`${tv ? 'text-sm' : 'text-xs'} font-bold ${
            pos === 1 ? 'text-[#000638]' : 'text-gray-500'
          } mb-1`}
        >
          {pos}º
        </span>
        <div
          className={`${tv ? 'w-16 h-16 text-lg' : 'w-12 h-12 text-sm'} rounded-full flex items-center justify-center font-bold mb-1 ring-2 ring-white shadow ${
            pos === 1
              ? 'bg-[#000638] text-white'
              : 'bg-[#000638]/10 text-[#000638]'
          }`}
        >
          {iniciais(fmtNome(item.nome))}
        </div>
        <p
          className={`${tv ? 'text-sm' : 'text-xs'} font-bold text-[#000638] text-center truncate w-full`}
          title={item.nome}
        >
          {fmtNome(item.nome)}
        </p>
        <p className={`${tv ? 'text-sm' : 'text-[11px]'} font-semibold text-gray-600`}>
          {formatBRL(item.valor)}
        </p>
        <div
          className={`w-full max-w-[90px] rounded-t-lg mt-1 ${
            pos === 1 ? 'bg-[#000638]' : 'bg-[#000638]/25'
          }`}
          style={{ height: tv ? altura * 1.5 : altura }}
        />
      </div>
    ) : (
      <div className="flex-1" />
    );
  return (
    <div className="flex items-end gap-2 px-4">
      <Coluna item={p2} pos={2} altura={44} />
      <Coluna item={p1} pos={1} altura={68} />
      <Coluna item={p3} pos={3} altura={30} />
    </div>
  );
};

export default function ForecastCanal() {
  const { canal } = useParams();
  const key = CANAIS_COMPETICAO[canal] ? canal : 'varejo';
  const cfg = CANAIS_COMPETICAO[key];
  const IconeCanal = cfg.icon;
  const apiClient = useApiClient();
  const { dados, periodo, porSemana, atualizadoEm, loading, erro, refresh } =
    useCompeticaoCanais(key);

  // Modal "desempenho da semana" (clique no card da semana)
  const [semanaModal, setSemanaModal] = useState(null); // item de porSemana

  // Modal "vendas por dia" (canais sem loja: clique no vendedor/franquia)
  const [vendasModal, setVendasModal] = useState(null); // { titulo, chave }
  const [vendasCache, setVendasCache] = useState({}); // chave → {vendas, erro}

  const buscarDetalhe = (chave, sellerCode, filtraCliente = null) => {
    if (vendasCache[chave]) return;
    apiClient.totvs
      .salePanelFaturamentoVendedorDetalhe({
        seller_code: sellerCode,
        filtroempresa: [],
        datemin: periodo.mes.ini,
        datemax: periodo.mes.fim,
      })
      .then((r) => {
        let vendas = (r?.data ?? r)?.vendas || [];
        if (filtraCliente != null)
          vendas = vendas.filter(
            (v) => Number(v.cliente_code) === Number(filtraCliente),
          );
        setVendasCache((c) => ({ ...c, [chave]: { vendas } }));
      })
      .catch((e) => {
        setVendasCache((c) => ({
          ...c,
          [chave]: { vendas: [], erro: e.message || 'Erro ao buscar vendas.' },
        }));
      });
  };

  const abrirVendasPorDia = (item) => {
    if (!periodo) return;
    // franquias: ranking é de clientes — busca o vendedor 40 e filtra o cliente
    const ehCliente = Boolean(cfg.clientes);
    const chave = ehCliente ? `c${item.code}` : `v${item.code}`;
    setVendasModal({ titulo: item.nome, chave });
    buscarDetalhe(chave, ehCliente ? 40 : item.code, ehCliente ? item.code : null);
  };

  // ─── tela cheia (pra TV) ──────────────────────────────────────────────────
  const telaRef = useRef(null);
  const [tv, setTv] = useState(false);
  useEffect(() => {
    const onChange = () => setTv(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const alternarTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else telaRef.current?.requestFullscreen?.().catch(() => {});
  };

  const rankMes = dados ? rankingDoCanal(dados.mes, key) : [];
  const rankSem = dados ? rankingDoCanal(dados.semana, key) : [];
  // franquias: nome sem o prefixo F###; demais: nome como veio
  const nomeExib = cfg.clientes ? nomeFranquia : (n) => n;
  const nomePodio = cfg.clientes ? nomeFranquia : primeiroNome;
  const semanaVal = new Map(rankSem.map((i) => [i.code, i.valor]));
  const rotulo = cfg.clientes ? 'Franquia' : 'Vendedor';

  return (
    <div
      ref={telaRef}
      className={`w-full flex flex-col gap-4 py-3 px-2 ${
        tv ? 'bg-[#f8f9fb] overflow-y-auto px-8 py-6' : ''
      }`}
    >
      <div className={`w-full ${tv ? 'max-w-6xl' : 'max-w-5xl'} mx-auto flex flex-col gap-4`}>
        {/* Cabeçalho */}
        <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div
                className={`${tv ? 'p-3' : 'p-2.5'} rounded-xl bg-[#000638]/5`}
              >
                <IconeCanal size={tv ? 32 : 26} className="text-[#000638]" />
              </div>
              <div>
                <h1
                  className={`${tv ? 'text-3xl' : 'text-xl sm:text-2xl'} font-extrabold tracking-tight text-[#000638]`}
                >
                  Forecast {cfg.titulo}
                </h1>
                {periodo && (
                  <p className={`${tv ? 'text-sm' : 'text-xs'} text-gray-500 mt-0.5`}>
                    Mês {ddmm(periodo.mes.ini)}–{ddmm(periodo.mes.fim)} · Semana{' '}
                    {periodo.semana.s} ({ddmm(periodo.semana.datemin)}–
                    {ddmm(periodo.semana.datemax)})
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-gray-500 text-[11px] uppercase font-semibold">
                  Total do mês
                </p>
                <p className={`${tv ? 'text-3xl' : 'text-xl'} font-extrabold text-[#000638]`}>
                  {dados ? formatBRL(dados.mes?.[key]?.total) : '—'}
                </p>
                <span className="flex items-center justify-end gap-1.5 text-[11px] text-gray-400">
                  {loading && <Spinner size={12} className="animate-spin" />}
                  {atualizadoEm &&
                    `Atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                  · a cada 30 min
                  <button
                    onClick={refresh}
                    disabled={loading}
                    title="Atualizar agora"
                    className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ArrowsClockwise size={13} />
                  </button>
                </span>
              </div>
              <button
                onClick={alternarTelaCheia}
                title={tv ? 'Sair da tela cheia' : 'Tela cheia (modo TV)'}
                className="flex items-center gap-1.5 border border-[#000638]/30 text-[#000638] rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[#000638]/5 transition-colors"
              >
                {tv ? <CornersIn size={16} /> : <CornersOut size={16} />}
                {tv ? 'Sair' : 'Tela cheia'}
              </button>
            </div>
          </div>
        </div>

        {/* troca rápida de canal (some na TV) */}
        {!tv && (
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(CANAIS_COMPETICAO).map(([k, c]) => {
              const Ic = c.icon;
              return (
                <Link
                  key={k}
                  to={`/forecast-canal/${k}`}
                  className={`text-xs font-semibold rounded-full px-3 py-1 transition flex items-center gap-1 ${
                    k === key
                      ? 'bg-[#000638] text-white'
                      : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Ic size={13} /> {c.titulo}
                </Link>
              );
            })}
          </div>
        )}

        {erro && !dados && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5 text-sm">
            {erro}
          </div>
        )}
        {!dados && loading && (
          <div className="flex justify-center items-center py-16 gap-3 text-gray-500 bg-white rounded-lg shadow-md border border-[#000638]/10">
            <Spinner size={24} className="animate-spin text-[#000638]" />
            <span className="text-sm">Montando o placar...</span>
          </div>
        )}

        {dados && (
          <>
            {/* Campeões */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CampeaoCard
                titulo="Campeão do Mês"
                item={
                  rankMes[0]
                    ? { ...rankMes[0], nome: nomeExib(rankMes[0].nome) }
                    : null
                }
                icone={Trophy}
                tv={tv}
              />
              <CampeaoCard
                titulo="Campeão da Semana"
                item={
                  rankSem[0]
                    ? { ...rankSem[0], nome: nomeExib(rankSem[0].nome) }
                    : null
                }
                icone={Lightning}
                tv={tv}
                periodoTxt={
                  periodo
                    ? `${ddmm(periodo.semana.datemin)}–${ddmm(periodo.semana.datemax)}`
                    : ''
                }
              />
            </div>

            {/* Pódio do mês */}
            {rankMes.length > 0 && (
              <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 pt-4 pb-0 overflow-hidden">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 text-center mb-2">
                  Pódio do mês
                </p>
                <Podio itens={rankMes} tv={tv} fmtNome={nomePodio} />
              </div>
            )}

            {/* Vendas por semana (mesma régua do New Forecast) */}
            <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                Vendas por semana
              </p>
              {!porSemana && (
                <div className="flex justify-center py-6 gap-2 text-gray-500 text-sm">
                  <Spinner size={16} className="animate-spin" /> Calculando as
                  semanas...
                </div>
              )}
              {porSemana && porSemana.length === 0 && (
                <p className="text-xs text-gray-400 py-3 text-center">
                  Não foi possível montar a quebra semanal.
                </p>
              )}
              {porSemana && porSemana.length > 0 && (
                <div
                  className={`grid grid-cols-2 sm:grid-cols-3 ${
                    porSemana.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
                  } gap-3`}
                >
                  {porSemana.map((w) => (
                    <div
                      key={w.s}
                      onClick={() => setSemanaModal(w)}
                      title="Clique para ver o desempenho da semana"
                      className={`rounded-lg border p-3 cursor-pointer hover:ring-2 hover:ring-[#000638]/20 transition ${
                        w.atual
                          ? 'border-[#000638] bg-[#000638]/5'
                          : 'border-[#000638]/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p
                          className={`${tv ? 'text-sm' : 'text-xs'} font-bold text-[#000638]`}
                        >
                          Semana {w.s}
                        </p>
                        {w.atual && (
                          <span className="text-[9px] font-bold uppercase bg-[#000638] text-white rounded-full px-1.5 py-0.5">
                            atual
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {ddmm(w.datemin)}–{ddmm(w.datemax)}
                      </p>
                      <p
                        className={`${tv ? 'text-xl' : 'text-base'} font-extrabold text-[#000638] mt-1`}
                      >
                        {formatBRL(w.valor)}
                      </p>
                      {w.lider && w.lider.valor > 0 && (
                        <p
                          className={`${tv ? 'text-xs' : 'text-[10px]'} text-gray-500 mt-0.5 truncate`}
                          title={w.lider.nome}
                        >
                          {rotulo === 'Franquia' ? 'destaque' : 'líder'}:{' '}
                          <span className="font-semibold text-[#000638]">
                            {nomePodio(w.lider.nome)}
                          </span>{' '}
                          · {formatBRL(w.lider.valor)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {key === 'franquias' && dados.mes.franquias.vendedores[0] && (
              <div
                onClick={() => {
                  setVendasModal({
                    titulo: dados.mes.franquias.vendedores[0].nome,
                    chave: 'v40-full',
                  });
                  buscarDetalhe('v40-full', 40);
                }}
                title="Clique para ver as vendas por dia"
                className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-4 flex items-center gap-3 cursor-pointer hover:ring-2 hover:ring-[#000638]/20 transition">
                <div className="w-11 h-11 rounded-full bg-[#000638]/5 flex items-center justify-center">
                  <User size={20} className="text-[#000638]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-gray-500">
                    Vendedor do canal
                  </p>
                  <p className="text-sm font-bold text-[#000638]">
                    {dados.mes.franquias.vendedores[0].nome}
                  </p>
                  <p className="text-base font-extrabold text-[#000638]">
                    {formatBRL(dados.mes.franquias.vendedores[0].valor)}
                    <span className="text-xs font-normal text-gray-400">
                      {' '}
                      no mês
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Ranking completo do mês (com a semana ao lado) */}
            <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                Ranking do mês — {rotulo} por{' '}
                {rotulo === 'Franquia' ? 'compras' : 'vendas'}
              </p>
              <RankingBarras
                itens={rankMes}
                tv={tv}
                onItem={key !== 'varejo' ? abrirVendasPorDia : undefined}
                extraDe={(i) =>
                  `${i.qtd || 0} venda(s) · semana: ${formatBRL(semanaVal.get(i.code) || 0)}${
                    i.lojas && i.lojas.length > 1
                      ? ` · ${i.lojas.length} lojas`
                      : ''
                  }`
                }
              />
            </div>

            {/* Varejo: ranking de lojas · Franquias: card do vendedor */}
            {key === 'varejo' && (
              <div className="bg-white rounded-lg shadow-md border border-[#000638]/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1.5">
                  <Storefront size={14} /> Ranking de lojas — mês
                </p>
                <RankingBarras
                  itens={dados.mes.varejo.lojas.map((l) => ({
                    code: l.code,
                    nome: l.nome,
                    valor: l.valor,
                    qtd: l.qtd,
                  }))}
                  tv={tv}
                  extraDe={(i) => `${i.qtd || 0} venda(s)`}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: desempenho da semana */}
      {semanaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSemanaModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-bold text-[#000638] uppercase tracking-wide truncate">
                Semana {semanaModal.s}
                <span className="text-gray-400 font-normal normal-case">
                  {' '}
                  — desempenho ({ddmm(semanaModal.datemin)}–
                  {ddmm(semanaModal.datemax)})
                </span>
              </h2>
              <button
                onClick={() => setSemanaModal(null)}
                className="p-1 rounded hover:bg-gray-100 shrink-0"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <p className="text-[11px] text-gray-400 mb-3">
                Total do canal na semana:{' '}
                <span className="font-bold text-[#000638]">
                  {formatBRL(semanaModal.valor)}
                </span>
              </p>
              {(semanaModal.performers || []).length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">
                  Sem vendas nesta semana.
                </p>
              ) : (
                <RankingBarras
                  itens={semanaModal.performers}
                  onItem={key !== 'varejo' ? abrirVendasPorDia : undefined}
                  extraDe={(i) => `${i.qtd || 0} venda(s)`}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: vendas por dia */}
      {vendasModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setVendasModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-bold text-[#000638] uppercase tracking-wide truncate">
                {vendasModal.titulo}
                {periodo && (
                  <span className="text-gray-400 font-normal normal-case">
                    {' '}
                    — vendas por dia ({ddmm(periodo.mes.ini)}–
                    {ddmm(periodo.mes.fim)})
                  </span>
                )}
              </h2>
              <button
                onClick={() => setVendasModal(null)}
                className="p-1 rounded hover:bg-gray-100 shrink-0"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              {(() => {
                const entry = vendasCache[vendasModal.chave];
                if (!entry)
                  return (
                    <div className="flex justify-center py-8 gap-2 text-gray-500 text-sm">
                      <Spinner size={18} className="animate-spin" /> Buscando
                      vendas...
                    </div>
                  );
                if (entry.erro)
                  return (
                    <div className="text-sm text-rose-600 py-4">
                      {entry.erro}
                    </div>
                  );
                const dias = agrupaPorDia(entry.vendas);
                if (dias.length === 0)
                  return (
                    <div className="text-sm text-gray-400 py-6 text-center">
                      Nenhuma venda no mês.
                    </div>
                  );
                const total = dias.reduce((a, d) => a + d.valor, 0);
                return (
                  <>
                    <p className="text-[11px] text-gray-400 mb-3">
                      {entry.vendas.length} venda(s) em {dias.length} dia(s)
                      &bull; {formatBRL(total)}
                    </p>
                    <div className="flex flex-col gap-3">
                      {dias.map((d) => (
                        <div
                          key={d.dia}
                          className="border border-[#000638]/10 rounded-lg overflow-hidden"
                        >
                          <div className="flex items-center justify-between px-3 py-1.5 bg-[#000638]/5">
                            <span className="text-xs font-bold text-[#000638] capitalize">
                              {diaLabel(d.dia)}
                            </span>
                            <span className="text-xs font-bold text-[#000638]">
                              {d.vendas.length} venda(s) · {formatBRL(d.valor)}
                            </span>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {d.vendas.map((v, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-2 px-3 py-1.5"
                              >
                                <span
                                  className="text-xs text-gray-600 truncate"
                                  title={
                                    v.cliente_nome ||
                                    `Cliente ${v.cliente_code}`
                                  }
                                >
                                  {v.cliente_nome ||
                                    `Cliente ${v.cliente_code}`}
                                  {v.fatura && (
                                    <span className="text-gray-400">
                                      {' '}
                                      · fat {v.fatura}
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs font-semibold text-[#000638] whitespace-nowrap">
                                  {formatBRL(v.valor)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
