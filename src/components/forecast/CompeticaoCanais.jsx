// Competição de Vendas por canal — dados e componentes compartilhados entre
// a página ForecastCanal (placar por canal, pensado pra TV) e a seção
// consolidada do Painel de Vendas.
//
// Fonte: /sale-panel/faturamento-vendedor (mês corrente + semana corrente,
// mesma régua de semanas do New Forecast, respeitando ajustes salvos).
// Auto-atualiza a cada 30 minutos — casado com o cache do backend.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  ArrowsClockwise,
  Spinner,
  CaretRight,
  Storefront,
  Package,
  Tag,
  Handshake,
} from '@phosphor-icons/react';
import useApiClient from '../../hooks/useApiClient';
import { TotvsURL } from '../../config/constants';

// ─── configuração dos canais (visual único do projeto, muda só o ícone) ──────
export const CANAIS_COMPETICAO = {
  varejo: { titulo: 'Varejo', icon: Storefront },
  revenda: { titulo: 'Revenda', icon: Package, codes: [161, 241, 165] },
  multimarcas: { titulo: 'Multimarcas', icon: Tag, codes: [259, 21, 26] },
  franquias: {
    titulo: 'Franquias',
    icon: Handshake,
    codes: [40],
    clientes: true, // ranking = franquias (clientes), 1 vendedor só
  },
};

export const formatBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const blocosSemana = (ini, fim) => {
  const out = [];
  let cur = ini;
  let s = 1;
  while (cur <= fim && s <= 10) {
    const f = addDays(cur, 6);
    out.push({ s, datemin: cur, datemax: f <= fim ? f : fim });
    cur = addDays(out[out.length - 1].datemax, 1);
    s++;
  }
  return out;
};

export const ddmm = (iso) =>
  iso && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '';

// ─── extração dos rankings de um payload do faturamento-vendedor ─────────────
const ehPseudo = (code, nome) =>
  Number(code) <= 0 || /\bGERAL\b/i.test(String(nome || ''));

const vendedoresVarejo = (payloadVarejo) => {
  const mapa = new Map();
  for (const l of payloadVarejo || []) {
    for (const s of l.sellers || []) {
      if (ehPseudo(s.seller_code, s.seller_name)) continue;
      const cur = mapa.get(s.seller_code) || {
        code: s.seller_code,
        nome: s.seller_name,
        qtd: 0,
        valor: 0,
        lojas: new Set(),
      };
      if (s.seller_name) cur.nome = s.seller_name;
      cur.qtd += s.qtd || 0;
      cur.valor = Math.round((cur.valor + (s.valor || 0)) * 100) / 100;
      cur.lojas.add(l.branch_code);
      mapa.set(s.seller_code, cur);
    }
  }
  return [...mapa.values()]
    .map((v) => ({ ...v, lojas: [...v.lojas] }))
    .sort((a, b) => b.valor - a.valor);
};

const vendedoresAtacado = (dataRow, codes) =>
  (codes || [])
    .map((code) => {
      const r = (dataRow || []).find((x) => Number(x.seller_code) === code);
      return r
        ? { code, nome: r.seller_name, qtd: r.qtd || 0, valor: r.valor || 0 }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.valor - a.valor);

const agrupaClientes = (vendas) => {
  const mapa = new Map();
  for (const v of vendas || []) {
    const cur = mapa.get(v.cliente_code) || {
      code: v.cliente_code,
      nome: v.cliente_nome || `Cliente ${v.cliente_code}`,
      qtd: 0,
      valor: 0,
    };
    if (v.cliente_nome) cur.nome = v.cliente_nome;
    cur.qtd += 1;
    cur.valor = Math.round((cur.valor + (v.valor || 0)) * 100) / 100;
    mapa.set(v.cliente_code, cur);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
};

// Quebra semanal do canal a partir do /faturamento-vendedor-semanal
// (mesma régua de semanas do New Forecast). lider = quem puxa a semana.
const montarPorSemana = (payload, canal, hoje) => {
  const semanas = payload?.semanas || [];
  const canais = payload?.canais || {};
  const drill = payload?.drill || {};
  return semanas.map((w) => {
    const k = `s${w.s}`;
    const d = drill[k] || {};
    let valor = 0;
    let performers = [];
    if (canal === 'varejo') {
      valor = canais.VAREJO?.[k] || 0;
      performers = vendedoresVarejo(d.varejo);
    } else if (canal === 'revenda' || canal === 'multimarcas') {
      valor =
        canal === 'revenda'
          ? canais.REVENDA?.[k] || 0
          : (canais.MTM_RAFAEL?.[k] || 0) +
            (canais.MTM_DAVID?.[k] || 0) +
            (canais.MTM_ARTHUR?.[k] || 0);
      performers = (CANAIS_COMPETICAO[canal].codes || [])
        .map((c) => d.vendedores?.[c])
        .filter(Boolean)
        .map((v) => ({
          code: v.seller_code,
          nome: v.seller_name,
          qtd: v.qtd || 0,
          valor: v.valor || 0,
        }))
        .sort((a, b) => b.valor - a.valor);
    } else if (canal === 'franquias') {
      valor = canais.FRANQUIAS?.[k] || 0;
      performers = agrupaClientes(d.vendedores?.[40]?.vendas || []);
    }
    return {
      ...w,
      valor: Math.round(valor * 100) / 100,
      performers,
      lider: performers[0] || null,
      atual: hoje >= w.datemin && hoje <= w.datemax,
    };
  });
};

// `apenas` = monta só o canal pedido (página por canal consome menos dados)
const montarCanais = (payload, detFranquias, nomeFilial, apenas = null) => {
  const dataRow = payload?.dataRow || [];
  const quer = (k) => !apenas || apenas === k;
  const out = {};
  if (quer('varejo')) {
    const lojas = (payload?.varejo || [])
      .map((l) => ({
        code: l.branch_code,
        nome: nomeFilial(l.branch_code),
        qtd: l.qtd || 0,
        valor: l.valor || 0,
      }))
      .sort((a, b) => b.valor - a.valor);
    out.varejo = {
      vendedores: vendedoresVarejo(payload?.varejo),
      lojas,
      total: Math.round(lojas.reduce((a, l) => a + l.valor, 0) * 100) / 100,
    };
  }
  for (const k of ['revenda', 'multimarcas', 'franquias']) {
    if (!quer(k)) continue;
    const vendedores = vendedoresAtacado(dataRow, CANAIS_COMPETICAO[k].codes);
    out[k] = {
      vendedores,
      total:
        Math.round(vendedores.reduce((a, v) => a + v.valor, 0) * 100) / 100,
    };
    if (k === 'franquias') out[k].clientes = agrupaClientes(detFranquias);
  }
  return out;
};

// ─── hook de dados: mês corrente + semana corrente, refresh 30min ────────────
// canal = null → todos (seção do Painel); canal informado → só ele:
// pula o detalhe de franquias e o lookup de nomes de loja quando não precisa.
export function useCompeticaoCanais(canal = null) {
  const apiClient = useApiClient();
  const [dados, setDados] = useState(null); // { mes, semana }
  const [periodo, setPeriodo] = useState(null); // { mes:{ini,fim}, semana:{s,datemin,datemax} }
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [branchNames, setBranchNames] = useState({});
  // Quebra por semana (só nas páginas de canal): [{s, datemin, datemax, valor, lider, atual}]
  const [porSemana, setPorSemana] = useState(null);
  const seq = useRef(0);
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;

  const precisaNomes = !canal || canal === 'varejo';
  const precisaFranquias = !canal || canal === 'franquias';

  useEffect(() => {
    if (!precisaNomes) return;
    (async () => {
      try {
        const r = await fetch(`${TotvsURL}branches`);
        if (!r.ok) return;
        const json = await r.json();
        let emp = json?.data?.data || json?.data || [];
        if (!Array.isArray(emp)) emp = [];
        const m = {};
        for (const e of emp) {
          const c = parseInt(e.cd_empresa);
          if (Number.isFinite(c))
            m[c] = e.nm_grupoempresa || e.fantasyName || e.description || null;
        }
        setBranchNames(m);
      } catch (_) {
        /* segue com códigos */
      }
    })();
    // precisaNomes muda quando o usuário troca de canal pelos chips
    // (mesmo componente, só muda o param da rota)
  }, [precisaNomes]);

  const carregar = useCallback(async () => {
    const s = ++seq.current;
    setLoading(true);
    setErro('');
    try {
      const api = apiRef.current;
      const hoje = hojeLocal();
      const mesIni = `${hoje.slice(0, 7)}-01`;
      const [y, m] = hoje.slice(0, 7).split('-').map(Number);
      const mesFim = `${hoje.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

      // Semana corrente: respeita a régua ajustada no New Forecast, se houver
      let semanas = blocosSemana(mesIni, mesFim);
      try {
        const cfg = await api.totvs.newForecastConfigGet(mesIni, mesFim);
        const row = cfg?.data ?? cfg;
        if (Array.isArray(row?.semanas) && row.semanas.length)
          semanas = row.semanas;
      } catch (_) {
        /* régua padrão */
      }
      const semana =
        semanas.find((w) => hoje >= w.datemin && hoje <= w.datemax) ||
        semanas[semanas.length - 1];

      const buscar = (datemin, datemax) =>
        api.totvs.salePanelFaturamentoVendedor({
          filtroempresa: [],
          datemin,
          datemax,
        });
      const detFranq = (datemin, datemax) =>
        !precisaFranquias
          ? Promise.resolve([])
          : api.totvs
              .salePanelFaturamentoVendedorDetalhe({
                seller_code: 40,
                filtroempresa: [],
                datemin,
                datemax,
              })
              .then((r) => (r?.data ?? r)?.vendas || [])
              .catch(() => []);

      const [mesR, semR, detMes, detSem] = await Promise.all([
        buscar(mesIni, mesFim),
        buscar(semana.datemin, semana.datemax),
        detFranq(mesIni, mesFim),
        detFranq(semana.datemin, semana.datemax),
      ]);
      if (s !== seq.current) return;
      const nomeFilial = (code) =>
        branchNames[Number(code)] || `Filial ${code}`;
      setDados({
        mes: montarCanais(mesR?.data ?? mesR, detMes, nomeFilial, canal),
        semana: montarCanais(semR?.data ?? semR, detSem, nomeFilial, canal),
      });
      setPeriodo({ mes: { ini: mesIni, fim: mesFim }, semana });
      setAtualizadoEm(new Date());

      // Quebra semanal (não bloqueia o placar principal).
      // Franquias: SEM chamada extra — o detalhe do vendedor 40 já está na
      // página (venda a venda com data); é só fatiar pela régua de semanas.
      // Demais canais: endpoint semanal do New Forecast (o varejo oficial só
      // existe por janela de datas; revenda/mtm custariam 3 chamadas cada).
      if (canal === 'franquias') {
        setPorSemana(
          semanas.map((w) => {
            const vendasW = (detMes || []).filter((v) => {
              const d = String(v.data || '').slice(0, 10);
              return d >= w.datemin && d <= w.datemax;
            });
            const performers = agrupaClientes(vendasW);
            return {
              ...w,
              valor:
                Math.round(
                  vendasW.reduce((a, v) => a + (v.valor || 0), 0) * 100,
                ) / 100,
              performers,
              lider: performers[0] || null,
              atual: hoje >= w.datemin && hoje <= w.datemax,
            };
          }),
        );
      } else if (canal) {
        setPorSemana(null);
        api.totvs
          .salePanelFaturamentoVendedorSemanal({
            datemin: mesIni,
            datemax: mesFim,
            semanas,
          })
          .then((r) => {
            if (s !== seq.current) return;
            setPorSemana(montarPorSemana(r?.data ?? r, canal, hoje));
          })
          .catch(() => {
            if (s === seq.current) setPorSemana([]);
          });
      }
    } catch (e) {
      if (s !== seq.current) return;
      setErro(e.message || 'Falha ao buscar os dados.');
    } finally {
      if (s === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchNames, canal]);

  // primeira carga + refresh a cada 30 minutos
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [carregar]);

  return {
    dados,
    periodo,
    porSemana,
    atualizadoEm,
    loading,
    erro,
    refresh: carregar,
  };
}

// ─── componentes visuais (paleta do projeto: navy #000638 + cards brancos) ───
export const primeiroNome = (nome) =>
  String(nome || '')
    .split(/\s*-\s*/)[0]
    .trim();

// Franquias seguem o padrão "F124 - CROSBY PRAIA SHOPPING" → mostra só
// "CROSBY PRAIA SHOPPING". Cliente fora do padrão (ex: BORNOR INDUSTRIA)
// mantém o nome completo.
export const nomeFranquia = (nome) => {
  const s = String(nome || '').trim();
  const m = s.match(/^F\d{2,4}\s*-\s*(.+)$/i);
  return m ? m[1].trim() : s;
};

// Badge de posição: 1º em navy sólido, demais neutros
export const PosBadge = ({ pos, tv }) => (
  <span
    className={`${tv ? 'w-9 h-9 text-sm' : 'w-6 h-6 text-[11px]'} rounded-full flex items-center justify-center font-bold shrink-0 ${
      pos === 1
        ? 'bg-[#000638] text-white'
        : pos <= 3
          ? 'bg-[#000638]/10 text-[#000638]'
          : 'bg-gray-100 text-gray-500'
    }`}
  >
    {pos}º
  </span>
);

// Lista de ranking com barras proporcionais ao líder
export function RankingBarras({ itens, limite, extraDe, tv, onItem }) {
  const lista = limite ? (itens || []).slice(0, limite) : itens || [];
  const max = Math.max(...lista.map((i) => Math.abs(i.valor)), 1);
  if (lista.length === 0)
    return (
      <p className="text-xs text-gray-400 py-3 text-center">
        Sem vendas no período.
      </p>
    );
  return (
    <div className={`flex flex-col ${tv ? 'gap-3' : 'gap-1.5'}`}>
      {lista.map((i, idx) => (
        <div
          key={i.code ?? idx}
          onClick={onItem ? () => onItem(i) : undefined}
          title={onItem ? 'Clique para ver as vendas por dia' : undefined}
          className={`flex items-center gap-2.5 ${
            onItem
              ? 'cursor-pointer rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-[#000638]/5 transition-colors'
              : ''
          }`}
        >
          <PosBadge pos={idx + 1} tv={tv} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`${tv ? 'text-base' : 'text-xs'} font-semibold text-[#000638] truncate`}
                title={i.nome}
              >
                {i.nome || `#${i.code}`}
              </span>
              <span
                className={`${tv ? 'text-base' : 'text-xs'} font-bold text-[#000638] whitespace-nowrap`}
              >
                {formatBRL(i.valor)}
              </span>
            </div>
            <div
              className={`${tv ? 'h-2.5' : 'h-1.5'} rounded-full bg-gray-100 overflow-hidden mt-0.5`}
            >
              <div
                className={`h-full rounded-full ${idx === 0 ? 'bg-[#000638]' : 'bg-[#000638]/40'}`}
                style={{ width: `${Math.max((i.valor / max) * 100, 2)}%` }}
              />
            </div>
            {extraDe && (
              <p className={`${tv ? 'text-xs' : 'text-[10px]'} text-gray-400 mt-0.5`}>
                {extraDe(i)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Ranking principal do canal (vendedores; franquias usa clientes)
export const rankingDoCanal = (canaisDados, key) => {
  const d = canaisDados?.[key];
  if (!d) return [];
  return CANAIS_COMPETICAO[key].clientes ? d.clientes || [] : d.vendedores || [];
};

// ─── seção consolidada (Painel de Vendas) ────────────────────────────────────
export function CompeticaoTodosCanais() {
  const { dados, periodo, atualizadoEm, loading, erro, refresh } =
    useCompeticaoCanais();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#000638] flex items-center gap-1.5">
          <Trophy size={16} className="text-[#000638]" />
          Competição de Vendas
          {periodo && (
            <span className="text-gray-400 font-normal normal-case">
              — {ddmm(periodo.mes.ini)} a {ddmm(periodo.mes.fim)} · Semana{' '}
              {periodo.semana.s} ({ddmm(periodo.semana.datemin)}–
              {ddmm(periodo.semana.datemax)})
            </span>
          )}
        </h2>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          {loading && <Spinner size={14} className="animate-spin" />}
          {atualizadoEm &&
            `Atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          <button
            onClick={refresh}
            disabled={loading}
            title="Atualizar agora"
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
          >
            <ArrowsClockwise size={14} />
          </button>
        </span>
      </div>

      {erro && !dados && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5 text-sm">
          {erro}
        </div>
      )}
      {!dados && loading && (
        <div className="flex justify-center items-center py-10 gap-3 text-gray-500 bg-white rounded-lg shadow-md border border-[#000638]/10">
          <Spinner size={22} className="animate-spin text-[#000638]" />
          <span className="text-sm">Montando a competição...</span>
        </div>
      )}

      {dados && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          {Object.entries(CANAIS_COMPETICAO).map(([key, cfg]) => {
            const Icone = cfg.icon;
            const rankMes = rankingDoCanal(dados.mes, key);
            const rankSem = rankingDoCanal(dados.semana, key);
            const campeaoMes = rankMes[0];
            const campeaoSem = rankSem[0];
            // franquias: tira o prefixo F### do nome; vendedores: 1º nome
            const nomeCurto = cfg.clientes ? nomeFranquia : primeiroNome;
            return (
              <div
                key={key}
                className="bg-white rounded-lg shadow-md border border-[#000638]/10 overflow-hidden"
              >
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#000638]/10 bg-[#000638]/5">
                  <span className="text-[#000638] font-bold text-sm uppercase tracking-wide flex items-center gap-1.5">
                    <Icone size={16} /> {cfg.titulo}
                  </span>
                  <span className="text-[#000638] text-xs font-semibold">
                    {formatBRL(dados.mes?.[key]?.total)}
                  </span>
                </div>
                <div className="p-3 flex flex-col gap-2.5">
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {campeaoMes && (
                      <span className="bg-[#000638] text-white rounded-full px-2 py-0.5 font-semibold flex items-center gap-1">
                        <Trophy size={11} /> Mês: {nomeCurto(campeaoMes.nome)}{' '}
                        · {formatBRL(campeaoMes.valor)}
                      </span>
                    )}
                    {campeaoSem && (
                      <span className="bg-gray-100 text-gray-700 rounded-full px-2 py-0.5 font-semibold">
                        Semana: {nomeCurto(campeaoSem.nome)} ·{' '}
                        {formatBRL(campeaoSem.valor)}
                      </span>
                    )}
                  </div>
                  <RankingBarras itens={rankMes} limite={5} />
                  <Link
                    to={`/forecast-canal/${key}`}
                    className="self-end inline-flex items-center gap-0.5 text-xs font-semibold text-[#000638] hover:underline"
                  >
                    Ver placar completo <CaretRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
