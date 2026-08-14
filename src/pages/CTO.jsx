import React, { useState, useMemo, useCallback } from 'react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import * as XLSX from 'xlsx';
import centrosCusto from '../config/centrosCusto.json';
import {
  Funnel,
  Spinner,
  Storefront,
  Warning,
  X,
  MagnifyingGlass,
  CheckCircle,
  FileXls,
  CalendarBlank,
} from '@phosphor-icons/react';

// ─── Config ──────────────────────────────────────────────────────────────────
// Código da despesa de aluguel no TOTVS
const CODIGO_DESPESA_ALUGUEL = 4001;
// Centro de custo que identifica ACORDO; qualquer outro é ALUGUEL
const CCUSTO_ACORDO = 999;
// Centros de custo excluídos — mesma configuração da página de Despesas Fixas
const CC_EXCLUIDOS = new Set(['4', '30', '35', '43']);

// Filiais fixas — mesmo conjunto da página de renegociações
const FILIAIS_FIXAS = [
  { cd: '1', nome: 'FILIAL 1' },
  { cd: '2', nome: 'FILIAL 2' },
  { cd: '5', nome: 'FILIAL 5' },
  { cd: '6', nome: 'FILIAL 6' },
  { cd: '11', nome: 'FILIAL 11' },
  { cd: '55', nome: 'FILIAL 55' },
  { cd: '65', nome: 'FILIAL 65' },
  { cd: '75', nome: 'FILIAL 75' },
  { cd: '85', nome: 'FILIAL 85' },
  { cd: '87', nome: 'FILIAL 87' },
  { cd: '88', nome: 'FILIAL 88' },
  { cd: '89', nome: 'FILIAL 89' },
  { cd: '90', nome: 'FILIAL 90' },
  { cd: '91', nome: 'FILIAL 91' },
  { cd: '92', nome: 'FILIAL 92' },
  { cd: '93', nome: 'FILIAL 93' },
  { cd: '94', nome: 'FILIAL 94' },
  { cd: '95', nome: 'FILIAL 95' },
  { cd: '96', nome: 'FILIAL 96' },
  { cd: '97', nome: 'FILIAL 97' },
  { cd: '99', nome: 'FILIAL 99' },
];

const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function criarDataSemFuso(str) {
  if (!str) return null;
  const s = str.includes('T') ? str.split('T')[0] : str;
  const [a, m, d] = s.split('-');
  return new Date(parseInt(a), parseInt(m) - 1, parseInt(d));
}

function formatarMoeda(val) {
  if (val === null || val === undefined || val === '') return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(parseFloat(val) || 0);
}

function formatarData(str) {
  const d = criarDataSemFuso(str);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

// Nome da loja pelo centro de custo — mesma regra da página de Despesas Fixas
function getNomeCentroCusto(cd_ccusto, ds_ccusto_api) {
  if (!cd_ccusto) return ds_ccusto_api || 'Sem Centro de Custo';
  const nome = centrosCusto[String(cd_ccusto)];
  return nome || ds_ccusto_api || `CC ${cd_ccusto}`;
}

function estaVencida(item) {
  if (item.dt_liq) return false;
  const d = criarDataSemFuso(item.dt_vencimento);
  if (!d) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d < hoje;
}

// Status da célula do mês:
// pago = todas as faturas pagas · parcial = parte paga, parte não ·
// atrasado = nada pago e há fatura vencida · aberto = a vencer
function statusCelula(itens) {
  if (itens.length === 0) return null;
  const pagas = itens.filter((i) => i.dt_liq).length;
  if (pagas === itens.length) return 'pago';
  if (pagas > 0) return 'parcial';
  if (itens.some(estaVencida)) return 'atrasado';
  return 'aberto';
}

const STATUS_ESTILOS = {
  pago: {
    celula: 'bg-green-50 hover:bg-green-100',
    label: 'text-green-600',
  },
  parcial: {
    celula: 'bg-yellow-100 hover:bg-yellow-200',
    label: 'text-yellow-700',
  },
  atrasado: {
    celula: 'bg-red-100 hover:bg-red-200',
    label: 'text-red-600',
  },
  aberto: {
    celula: 'bg-gray-50 hover:bg-gray-100',
    label: 'text-gray-500',
  },
};

// Dia de vencimento mais frequente entre as duplicatas da linha
function diaVencimentoComum(itens) {
  const contagem = {};
  for (const item of itens) {
    const d = criarDataSemFuso(item.dt_vencimento);
    if (!d) continue;
    const dia = d.getDate();
    contagem[dia] = (contagem[dia] || 0) + 1;
  }
  let melhor = null;
  let max = 0;
  for (const [dia, qtd] of Object.entries(contagem)) {
    if (qtd > max) {
      max = qtd;
      melhor = dia;
    }
  }
  return melhor;
}

// ─── Modal de detalhes das faturas do mês ────────────────────────────────────
const ModalFaturas = ({ info, onClose }) => {
  if (!info) return null;
  const { localNome, tipoLabel, mesLabel, ano, itens } = info;
  const total = itens.reduce(
    (s, i) => s + (parseFloat(i.vl_duplicata) || 0),
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              {tipoLabel} — {mesLabel}/{ano}
            </p>
            <h3 className="font-bold text-[#000638] text-base">{localNome}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {itens.length} duplicata(s) — Total:{' '}
              <span className="font-semibold text-[#000638]">
                {formatarMoeda(total)}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 px-2">Duplicata</th>
                <th className="py-2 px-2">Fornecedor</th>
                <th className="py-2 px-2">Empresa</th>
                <th className="py-2 px-2">Vencimento</th>
                <th className="py-2 px-2 text-center">Status</th>
                <th className="py-2 px-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 px-2 font-medium text-gray-700">
                    {item.nr_duplicata || '—'}
                    {item.nr_parcela ? `/${item.nr_parcela}` : ''}
                  </td>
                  <td className="py-1.5 px-2 text-gray-700">
                    {item.nm_fornecedor || item.cd_fornecedor || '—'}
                  </td>
                  <td className="py-1.5 px-2 text-gray-700">
                    {item.nm_empresa || item.cd_empresa || '—'}
                  </td>
                  <td className="py-1.5 px-2 text-gray-700">
                    {formatarData(item.dt_vencimento)}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {item.dt_liq ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        <CheckCircle size={10} weight="fill" />
                        PAGA
                      </span>
                    ) : estaVencida(item) ? (
                      <span className="inline-flex items-center text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                        VENCIDA
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        EM ABERTO
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-right font-semibold text-[#000638]">
                    {formatarMoeda(item.vl_duplicata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#000638] text-white text-sm rounded-lg hover:opacity-90 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────
const CTO = () => {
  const apiClient = useApiClient();

  // ─── Filtros ───
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);

  // ─── Dados ───
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [erro, setErro] = useState(null);
  const [modalFaturas, setModalFaturas] = useState(null);

  // ─── Buscar dados ──────────────────────────────────────────────────────────
  const buscarDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const payload = {
        dt_inicio: `${ano}-01-01`,
        dt_fim: `${ano}-12-31`,
        branches: FILIAIS_FIXAS.map((f) => parseInt(f.cd)),
        modo: 'vencimento',
        situacao: 'N',
        previsao: 'TODOS',
        filtroPagamento: 'TODOS',
        expenseCodeList: [CODIGO_DESPESA_ALUGUEL],
      };

      const result = await apiClient.totvs.accountsPayableSearch(payload);

      let dadosArray = [];
      if (result && typeof result === 'object') {
        if (Array.isArray(result.data)) dadosArray = result.data;
        else if (result.data && Array.isArray(result.data.data))
          dadosArray = result.data.data;
        else if (result.metadata && Array.isArray(result.metadata.data))
          dadosArray = result.metadata.data;
      }

      const empresaMap = {};
      FILIAIS_FIXAS.forEach((f) => {
        empresaMap[String(f.cd)] = f.nome;
      });

      const processados = dadosArray.map((item) => ({
        ...item,
        nm_empresa:
          empresaMap[String(item.cd_empresa)] || item.nm_empresa || '',
      }));

      setDados(processados);
      setDadosCarregados(true);
    } catch (err) {
      setErro(err.message || 'Erro ao buscar dados.');
    } finally {
      setLoading(false);
    }
  }, [ano, apiClient]);

  const handleFiltrar = useCallback(
    (e) => {
      e.preventDefault();
      buscarDados();
    },
    [buscarDados],
  );

  // ─── Agrupamento: LOCAL (centro de custo) → linhas ALUGUEL / ACORDO ────────
  // Separação de lojas igual à página de Despesas Fixas: cada centro de custo
  // é uma loja, com nome vindo do centrosCusto.json. O acordo (c. custo 999)
  // não identifica a loja, então entra na loja cujo aluguel tem o mesmo
  // fornecedor; sem aluguel correspondente, vira um local próprio.
  const locais = useMemo(() => {
    const aluguelItems = [];
    const acordoItems = [];
    for (const item of dados) {
      const d = criarDataSemFuso(item.dt_vencimento);
      if (!d || d.getFullYear() !== ano) continue;
      if (CC_EXCLUIDOS.has(String(item.cd_ccusto))) continue;
      if (parseInt(item.cd_ccusto) === CCUSTO_ACORDO) acordoItems.push(item);
      else aluguelItems.push(item);
    }

    // Loja (centro de custo) → itens de aluguel
    const mapa = new Map();
    // Fornecedor → contagem por loja, para vincular os acordos
    const fornecedorPorLoja = new Map();

    for (const item of aluguelItems) {
      const ccKey = String(item.cd_ccusto || '0');
      if (!mapa.has(ccKey)) {
        mapa.set(ccKey, {
          key: ccKey,
          localNome: getNomeCentroCusto(item.cd_ccusto, item.ds_ccusto),
          aluguel: [],
          acordo: [],
        });
      }
      mapa.get(ccKey).aluguel.push(item);

      const fornKey = String(item.cd_fornecedor || '');
      if (fornKey) {
        if (!fornecedorPorLoja.has(fornKey)) {
          fornecedorPorLoja.set(fornKey, {});
        }
        const contagem = fornecedorPorLoja.get(fornKey);
        contagem[ccKey] = (contagem[ccKey] || 0) + 1;
      }
    }

    // Acordos entram na loja do fornecedor (a mais frequente); sem
    // correspondência, viram um local próprio com o nome do fornecedor
    for (const item of acordoItems) {
      const fornKey = String(item.cd_fornecedor || '');
      const contagem = fornecedorPorLoja.get(fornKey);
      let ccKey = null;
      if (contagem) {
        ccKey = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0];
      }
      if (ccKey && mapa.has(ccKey)) {
        mapa.get(ccKey).acordo.push(item);
      } else {
        const soloKey = `forn-${fornKey}`;
        if (!mapa.has(soloKey)) {
          mapa.set(soloKey, {
            key: soloKey,
            localNome: item.nm_fornecedor || `Fornecedor ${fornKey}`,
            aluguel: [],
            acordo: [],
          });
        }
        mapa.get(soloKey).acordo.push(item);
      }
    }

    const montarLinha = (itens, tipoLabel) => {
      if (itens.length === 0) return null;
      const meses = Array.from({ length: 12 }, () => ({
        itens: [],
        total: 0,
        status: null,
      }));
      for (const item of itens) {
        const d = criarDataSemFuso(item.dt_vencimento);
        const cel = meses[d.getMonth()];
        cel.itens.push(item);
        cel.total += parseFloat(item.vl_duplicata) || 0;
      }
      meses.forEach((cel) => {
        cel.status = statusCelula(cel.itens);
      });
      const totalAtrasado = itens
        .filter(estaVencida)
        .reduce((s, i) => s + (parseFloat(i.vl_duplicata) || 0), 0);
      return {
        tipoLabel,
        meses,
        diaVencimento: diaVencimentoComum(itens),
        totalAtrasado,
        total: itens.reduce((s, i) => s + (parseFloat(i.vl_duplicata) || 0), 0),
        pago: itens
          .filter((i) => i.dt_liq)
          .reduce((s, i) => s + (parseFloat(i.vl_duplicata) || 0), 0),
      };
    };

    return Array.from(mapa.values())
      .map((local) => {
        const linhas = [
          montarLinha(local.aluguel, 'ALUGUEL'),
          montarLinha(local.acordo, 'ACORDO'),
        ].filter(Boolean);
        const totalLocal = linhas.reduce((s, l) => s + l.total, 0);
        return { ...local, linhas, totalLocal };
      })
      .filter((l) => l.linhas.length > 0)
      .sort((a, b) => b.totalLocal - a.totalLocal);
  }, [dados, ano]);

  // ─── Resumo ────────────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    let total = 0;
    let pago = 0;
    let atrasado = 0;
    for (const local of locais) {
      for (const linha of local.linhas) {
        total += linha.total;
        pago += linha.pago;
        atrasado += linha.totalAtrasado;
      }
    }
    return { total, pago, aberto: total - pago, atrasado };
  }, [locais]);

  const totaisMes = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) =>
      locais.reduce(
        (s, local) =>
          s + local.linhas.reduce((s2, l) => s2 + l.meses[m].total, 0),
        0,
      ),
    );
  }, [locais]);

  // ─── Exportar Excel (mesmo layout da imagem) ───────────────────────────────
  const exportarExcel = useCallback(() => {
    const aoa = [
      [
        'Local',
        'Tipo',
        'Vencimento',
        ...MESES.map((m) => `${m}/${String(ano).slice(2)}`),
        'Total Atrasado',
      ],
    ];
    for (const local of locais) {
      for (const linha of local.linhas) {
        aoa.push([
          local.localNome,
          linha.tipoLabel,
          linha.diaVencimento || '',
          ...linha.meses.map((c) => c.total || 0),
          linha.totalAtrasado || 0,
        ]);
      }
    }
    aoa.push([]);
    aoa.push([
      'TOTAL',
      '',
      '',
      ...totaisMes,
      locais.reduce(
        (s, local) =>
          s + local.linhas.reduce((s2, l) => s2 + l.totalAtrasado, 0),
        0,
      ),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 24 },
      { wch: 10 },
      { wch: 11 },
      ...MESES.map(() => ({ wch: 12 })),
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CTO');
    XLSX.writeFile(wb, `cto-${ano}.xlsx`);
  }, [locais, totaisMes, ano]);

  // ─── Anos disponíveis no seletor ───────────────────────────────────────────
  const anos = useMemo(() => {
    const lista = [];
    for (let a = anoAtual + 1; a >= anoAtual - 3; a--) lista.push(a);
    return lista;
  }, [anoAtual]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-screen-2xl mx-auto px-6 pt-6">
        <PageTitle
          title="CTO"
          subtitle="Custo Total de Ocupação — aluguéis e acordos das lojas"
          icon={Storefront}
          iconColor="text-indigo-600"
        />

        {/* ─── Filtros ─────────────────────────────────────────────────── */}
        <form
          onSubmit={handleFiltrar}
          className="bg-white border border-[#000638]/10 rounded-xl shadow-sm p-4 mb-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Funnel size={16} weight="bold" className="text-[#000638]" />
            <span className="font-bold text-[#000638] text-sm">Filtros</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold mb-0.5 text-[#000638]">
                Ano
              </label>
              <select
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value))}
                className="border border-[#000638]/30 rounded-lg px-2 py-1.5 w-32 text-xs bg-[#f8f9fb] text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]"
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-[#000638] text-white text-xs font-semibold py-2 px-6 rounded-lg hover:opacity-90 transition disabled:opacity-60"
            >
              {loading ? (
                <Spinner size={14} className="animate-spin" />
              ) : (
                <MagnifyingGlass size={14} weight="bold" />
              )}
              {loading ? 'Carregando...' : 'Filtrar'}
            </button>
            {dadosCarregados && locais.length > 0 && (
              <button
                type="button"
                onClick={exportarExcel}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition ml-auto"
              >
                <FileXls size={13} weight="bold" />
                Excel
              </button>
            )}
          </div>
        </form>

        {/* ─── Cards de resumo ─────────────────────────────────────────── */}
        {dadosCarregados && !loading && (
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-2 flex flex-col justify-center min-w-[150px]">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide">
                Total ({ano})
              </p>
              <p className="text-sm font-bold text-[#000638] leading-tight">
                {formatarMoeda(resumo.total)}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg border border-green-300 shadow-sm px-4 py-2 flex flex-col justify-center min-w-[150px]">
              <p className="text-[9px] text-green-700 uppercase tracking-wide">
                Pago
              </p>
              <p className="text-sm font-bold text-green-700 leading-tight">
                {formatarMoeda(resumo.pago)}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg border border-amber-300 shadow-sm px-4 py-2 flex flex-col justify-center min-w-[150px]">
              <p className="text-[9px] text-amber-700 uppercase tracking-wide">
                Em Aberto
              </p>
              <p className="text-sm font-bold text-amber-700 leading-tight">
                {formatarMoeda(resumo.aberto)}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-300 shadow-sm px-4 py-2 flex flex-col justify-center min-w-[150px]">
              <p className="text-[9px] text-red-700 uppercase tracking-wide">
                Total Atrasado
              </p>
              <p className="text-sm font-bold text-red-700 leading-tight">
                {formatarMoeda(resumo.atrasado)}
              </p>
            </div>
          </div>
        )}

        {/* ─── Erro ────────────────────────────────────────────────────── */}
        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm flex items-center gap-2">
            <Warning size={16} weight="bold" />
            {erro}
          </div>
        )}

        {/* ─── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Spinner size={36} className="animate-spin mb-3 text-[#000638]" />
            <p className="text-sm">Carregando custos operacionais...</p>
          </div>
        )}

        {/* ─── Vazio ───────────────────────────────────────────────────── */}
        {!loading && dadosCarregados && locais.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Storefront size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              Nenhuma despesa de aluguel encontrada para o período selecionado.
            </p>
          </div>
        )}

        {/* ─── Tabela LOCAL × mês ──────────────────────────────────────── */}
        {!loading && dadosCarregados && locais.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
            <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-gray-100 text-[10px] text-gray-500">
              <span className="font-semibold uppercase tracking-wide">
                Legenda:
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-50 border border-green-300 inline-block" />
                Pago
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-400 inline-block" />
                Pago parcial
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />
                Atrasado
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-gray-50 border border-gray-300 inline-block" />
                A vencer
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-4 py-2.5 text-left font-bold sticky left-0 bg-[#000638] z-10 min-w-[160px]">
                      Local
                    </th>
                    <th className="px-2 py-2.5 text-center font-semibold min-w-[75px]">
                      Tipo
                    </th>
                    <th className="px-2 py-2.5 text-center font-semibold min-w-[70px]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarBlank size={11} weight="bold" />
                        Venc.
                      </span>
                    </th>
                    {MESES.map((m) => (
                      <th
                        key={m}
                        className="px-2 py-2.5 text-center font-semibold uppercase min-w-[85px]"
                      >
                        {m}/{String(ano).slice(2)}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-right font-bold min-w-[110px]">
                      Total Atrasado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {locais.map((local) =>
                    local.linhas.map((linha, li) => (
                      <tr
                        key={`${local.key}-${linha.tipoLabel}`}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition ${
                          li === local.linhas.length - 1
                            ? 'border-b-2 border-gray-200'
                            : ''
                        }`}
                      >
                        {li === 0 && (
                          <td
                            rowSpan={local.linhas.length}
                            className="px-4 py-2 font-semibold text-[#000638] sticky left-0 bg-white z-10 border-r border-gray-100 align-middle"
                          >
                            {local.localNome}
                          </td>
                        )}
                        <td
                          className={`px-2 py-2 text-center font-bold text-[10px] ${
                            linha.tipoLabel === 'ACORDO'
                              ? 'text-indigo-700'
                              : 'text-gray-600'
                          }`}
                        >
                          {linha.tipoLabel}
                        </td>
                        <td className="px-2 py-2 text-center text-gray-600 font-medium">
                          {linha.diaVencimento
                            ? `dia ${linha.diaVencimento}`
                            : '—'}
                        </td>
                        {linha.meses.map((cel, m) => (
                          <td
                            key={m}
                            onClick={() =>
                              cel.itens.length > 0 &&
                              setModalFaturas({
                                localNome: local.localNome,
                                tipoLabel: linha.tipoLabel,
                                mesLabel: MESES[m],
                                ano,
                                itens: cel.itens,
                              })
                            }
                            className={`px-2 py-2 text-center align-middle ${
                              cel.itens.length > 0
                                ? `cursor-pointer ${STATUS_ESTILOS[cel.status].celula}`
                                : 'text-gray-300'
                            }`}
                          >
                            {cel.itens.length > 0 ? (
                              <div>
                                <span
                                  className={`block text-[9px] font-bold uppercase ${STATUS_ESTILOS[cel.status].label}`}
                                >
                                  {cel.status === 'pago' && (
                                    <CheckCircle
                                      size={9}
                                      weight="fill"
                                      className="inline mb-px"
                                    />
                                  )}
                                  {cel.status === 'atrasado' && 'atrasado'}
                                  {cel.status === 'parcial' && 'parcial'}
                                  {cel.status === 'aberto' && 'a vencer'}
                                </span>
                                <span className="font-semibold text-[#000638]">
                                  {formatarMoeda(cel.total)}
                                </span>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-bold border-l border-gray-100 whitespace-nowrap">
                          {linha.totalAtrasado > 0 ? (
                            <span className="text-red-600">
                              {formatarMoeda(linha.totalAtrasado)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold text-[#000638]">
                    <td className="px-4 py-2.5 sticky left-0 bg-gray-100 z-10">
                      TOTAL
                    </td>
                    <td />
                    <td />
                    {totaisMes.map((t, m) => (
                      <td key={m} className="px-2 py-2.5 text-center">
                        {t > 0 ? formatarMoeda(t) : '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right text-red-600">
                      {formatarMoeda(resumo.atrasado)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ─── Tela inicial ─────────────────────────────────────────────── */}
        {!loading && !dadosCarregados && (
          <div className="text-center py-20 text-gray-400">
            <Storefront size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium mb-1">
              Selecione o ano e clique em Filtrar para visualizar os custos
              operacionais
            </p>
            <p className="text-sm">
              Aluguéis (despesa 4001) separados entre ALUGUEL e ACORDO (c. custo
              999)
            </p>
          </div>
        )}
      </div>

      {/* ─── Modal de faturas ──────────────────────────────────────────── */}
      {modalFaturas && (
        <ModalFaturas
          info={modalFaturas}
          onClose={() => setModalFaturas(null)}
        />
      )}
    </div>
  );
};

export default CTO;
