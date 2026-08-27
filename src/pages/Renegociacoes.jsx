import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import {
  Funnel,
  Spinner,
  Handshake,
  Warning,
  X,
  MagnifyingGlass,
  CheckCircle,
  FileXls,
  ImageSquare,
  CalendarBlank,
} from '@phosphor-icons/react';

// ─── Fornecedores renegociados ───────────────────────────────────────────────
// Lista fixa dos fornecedores com renegociação ativa no contas a pagar.
// cd = código do fornecedor no TOTVS · diaVencimento = dia acordado na renegociação
// inicio = ano-mês ('AAAA-MM') da primeira parcela da renegociação; vencimentos
// anteriores a ele são ignorados. null = puxa tudo.
const FORNECEDORES_RENEGOCIADOS = [
  {
    cd: 5520,
    nome: 'EXCIM IMPORTACAO E EXPORTACAO SA',
    diaVencimento: 30,
    inicio: '2026-03',
  },
  {
    cd: 40700,
    nome: 'SULNOVE INDUSTRIA DE EMBALAGENS LTDA',
    diaVencimento: 30,
    inicio: '2026-07',
  },
  {
    cd: 30037,
    nome: 'PASSAMANARIA DO NORDESTE S A',
    diaVencimento: 27,
    inicio: '2026-06',
  },
  { cd: 20950, nome: 'ARTECA', diaVencimento: 27, inicio: '2026-08' },
  {
    cd: 67813,
    nome: 'ELIAN INDUSTRIA TEXTIL LTDA',
    diaVencimento: 24,
    inicio: '2026-04',
  },
  { cd: 32136, nome: 'RENAUXVIEW', diaVencimento: 22, inicio: '2026-06' },
  { cd: 11766, nome: 'NOVAPELLI', diaVencimento: 27, inicio: '2026-07' },
  { cd: 6499, nome: 'LUNELLI TEXTIL LTDA', diaVencimento: 22, inicio: null },
  { cd: 6975, nome: 'VICUNHA', diaVencimento: 10, inicio: null },
];

// Duplicatas que não existem mais no contas a pagar mas ainda voltam na busca.
// Todas as parcelas da duplicata são ignoradas. fornecedor = cd do TOTVS.
const DUPLICATAS_IGNORADAS = [
  { fornecedor: 67813, duplicata: '5459' }, // ELIAN — fatura cancelada
];

// Filiais fixas — mesmo conjunto da página de despesas de indústria
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

// Janela de busca no contas a pagar — cobre todo o período das renegociações
const PERIODO_INICIO = '2026-01-01';
const PERIODO_FIM = '2035-12-31';

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

function estaVencida(item) {
  if (item.dt_liq) return false;
  const d = criarDataSemFuso(item.dt_vencimento);
  if (!d) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d < hoje;
}

// Status da parcela do mês:
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

// ─── Modal de detalhes das parcelas do mês ───────────────────────────────────
const ModalParcelas = ({ info, onClose }) => {
  if (!info) return null;
  const { fornecedorNome, mesLabel, ano, itens } = info;
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
              Renegociação — {mesLabel}/{ano}
            </p>
            <h3 className="font-bold text-[#000638] text-base">
              {fornecedorNome}
            </h3>
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
                <th className="py-2 px-2">Empresa</th>
                <th className="py-2 px-2">Emissão</th>
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
                    {item.nm_empresa || item.cd_empresa || '—'}
                  </td>
                  <td className="py-1.5 px-2 text-gray-700">
                    {formatarData(item.dt_emissao)}
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
const Renegociacoes = () => {
  const apiClient = useApiClient();

  // ─── Filtros ───
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);

  // ─── Dados ───
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [erro, setErro] = useState(null);
  const [modalParcelas, setModalParcelas] = useState(null);
  const [gerandoPng, setGerandoPng] = useState(false);
  const tabelaRef = useRef(null);

  // ─── Buscar dados ──────────────────────────────────────────────────────────
  const buscarDados = useCallback(async () => {
    if (FORNECEDORES_RENEGOCIADOS.length === 0) {
      setDadosCarregados(true);
      setDados([]);
      return;
    }

    setLoading(true);
    setErro(null);
    try {
      // Período completo das renegociações (não só o ano filtrado), para os
      // totais gerais; a matriz filtra o ano client-side
      const payload = {
        dt_inicio: PERIODO_INICIO,
        dt_fim: PERIODO_FIM,
        branches: FILIAIS_FIXAS.map((f) => parseInt(f.cd)),
        modo: 'vencimento',
        situacao: 'N',
        previsao: 'TODOS',
        filtroPagamento: 'TODOS',
        supplierCodeList: FORNECEDORES_RENEGOCIADOS.map((f) => f.cd),
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

      const codigosSet = new Set(
        FORNECEDORES_RENEGOCIADOS.map((f) => String(f.cd)),
      );

      const ignoradasSet = new Set(
        DUPLICATAS_IGNORADAS.map(
          (d) => `${d.fornecedor}|${String(d.duplicata).trim()}`,
        ),
      );

      const processados = dadosArray
        .filter((item) => codigosSet.has(String(item.cd_fornecedor)))
        .filter(
          (item) =>
            !ignoradasSet.has(
              `${item.cd_fornecedor}|${String(item.nr_duplicata ?? '').trim()}`,
            ),
        )
        .map((item) => ({
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
  }, [apiClient]);

  const handleFiltrar = useCallback(
    (e) => {
      e.preventDefault();
      buscarDados();
    },
    [buscarDados],
  );

  // ─── Matriz fornecedor × mês (modelo da planilha) ──────────────────────────
  const linhas = useMemo(() => {
    return FORNECEDORES_RENEGOCIADOS.map((forn) => {
      const itens = dados
        .filter((i) => String(i.cd_fornecedor) === String(forn.cd))
        .sort((a, b) =>
          String(a.dt_vencimento || '').localeCompare(
            String(b.dt_vencimento || ''),
          ),
        );

      // Agrupa as faturas do mês em uma única parcela: cada mês com valor
      // vira p1, p2, p3... em sequência, independente da quantidade de faturas
      const meses = Array.from({ length: 12 }, () => ({
        itens: [],
        parcela: null,
        total: 0,
        status: null,
      }));
      itens.forEach((item) => {
        const d = criarDataSemFuso(item.dt_vencimento);
        if (!d || d.getFullYear() !== ano) return;
        // Ignora vencimentos anteriores ao início da renegociação
        if (forn.inicio) {
          const anoMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (anoMes < forn.inicio) return;
        }
        const cel = meses[d.getMonth()];
        cel.itens.push(item);
        cel.total += parseFloat(item.vl_duplicata) || 0;
      });
      let numParcela = 0;
      meses.forEach((cel) => {
        if (cel.itens.length > 0) {
          numParcela += 1;
          cel.parcela = `p${numParcela}`;
        }
        cel.status = statusCelula(cel.itens);
      });

      const nomeExibicao =
        itens[0]?.nm_fornecedor || forn.nome || `Fornecedor ${forn.cd}`;
      const totalAno = meses.reduce((s, c) => s + c.total, 0);
      const totalPago = meses.reduce(
        (s, c) =>
          s +
          c.itens
            .filter((i) => i.dt_liq)
            .reduce((s2, i) => s2 + (parseFloat(i.vl_duplicata) || 0), 0),
        0,
      );

      // Totais de todo o período (todas as parcelas desde o início da
      // renegociação, independente do ano filtrado)
      let totalGeral = 0;
      let totalGeralPago = 0;
      const gruposMes = new Map(); // anoMes -> itens da parcela
      itens.forEach((item) => {
        const d = criarDataSemFuso(item.dt_vencimento);
        if (!d) return;
        const anoMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (forn.inicio && anoMes < forn.inicio) return;
        const valor = parseFloat(item.vl_duplicata) || 0;
        totalGeral += valor;
        if (item.dt_liq) totalGeralPago += valor;
        if (!gruposMes.has(anoMes)) gruposMes.set(anoMes, []);
        gruposMes.get(anoMes).push(item);
      });

      // Parcelas de todo o período: cada mês com fatura é uma parcela;
      // paga quando todas as faturas do mês têm dt_liq
      const parcelasGeral = gruposMes.size;
      let parcelasGeralPagas = 0;
      gruposMes.forEach((grupo) => {
        if (grupo.every((i) => i.dt_liq)) parcelasGeralPagas += 1;
      });

      return {
        ...forn,
        nomeExibicao,
        meses,
        totalAno,
        totalPago,
        totalAberto: totalAno - totalPago,
        totalGeral,
        totalGeralPago,
        totalGeralAberto: totalGeral - totalGeralPago,
        qtdParcelas: numParcela,
        parcelasGeral,
        parcelasGeralPagas,
        parcelasGeralAbertas: parcelasGeral - parcelasGeralPagas,
      };
    });
  }, [dados, ano]);

  // ─── Totais por mês e resumo ───────────────────────────────────────────────
  const totaisMes = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) =>
      linhas.reduce((s, l) => s + l.meses[m].total, 0),
    );
  }, [linhas]);

  const resumo = useMemo(() => {
    const total = linhas.reduce((s, l) => s + l.totalAno, 0);
    const pago = linhas.reduce((s, l) => s + l.totalPago, 0);
    return {
      total,
      pago,
      aberto: total - pago,
      fornecedores: linhas.filter((l) => l.qtdParcelas > 0).length,
    };
  }, [linhas]);

  // ─── Totais gerais de todo o período (independente do ano filtrado) ────────
  const totaisGerais = useMemo(() => {
    const total = linhas.reduce((s, l) => s + l.totalGeral, 0);
    const pago = linhas.reduce((s, l) => s + l.totalGeralPago, 0);
    const parcelas = linhas.reduce((s, l) => s + l.parcelasGeral, 0);
    const parcelasPagas = linhas.reduce((s, l) => s + l.parcelasGeralPagas, 0);
    return { total, pago, aberto: total - pago, parcelas, parcelasPagas };
  }, [linhas]);

  // ─── Exportar Excel (mesmo layout da planilha de renegociações) ────────────
  const exportarExcel = useCallback(() => {
    const aoa = [
      [
        'Fornecedor',
        'Vencimento',
        ...MESES,
        'Total',
        'Em Aberto',
        'Pago',
        'Parcelas Pagas',
      ],
    ];
    for (const linha of linhas) {
      aoa.push([
        linha.nomeExibicao,
        linha.diaVencimento || '',
        ...linha.meses.map((c) => c.parcela || ''),
      ]);
      aoa.push([
        '',
        '',
        ...linha.meses.map((c) => c.total || 0),
        linha.totalGeral,
        linha.totalGeralAberto,
        linha.totalGeralPago,
        `${linha.parcelasGeralPagas}/${linha.parcelasGeral}`,
      ]);
    }
    aoa.push([]);
    aoa.push([
      `TOTAL (${ano})`,
      '',
      ...totaisMes,
      totaisGerais.total,
      totaisGerais.aberto,
      totaisGerais.pago,
      `${totaisGerais.parcelasPagas}/${totaisGerais.parcelas}`,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 30 },
      { wch: 12 },
      ...MESES.map(() => ({ wch: 12 })),
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Renegociações');
    XLSX.writeFile(wb, `renegociacoes-${ano}.xlsx`);
  }, [linhas, totaisMes, totaisGerais, ano]);

  // ─── Baixar PNG da tabela (html-to-image: captura a tabela inteira na
  // horizontal, mesmo a parte escondida pelo scroll) ─────────────────────────
  const baixarPng = useCallback(async () => {
    if (!tabelaRef.current) return;
    setGerandoPng(true);
    try {
      const dataUrl = await toPng(tabelaRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        quality: 1,
      });
      const link = document.createElement('a');
      link.download = `renegociacoes-${ano}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Erro ao gerar imagem:', e);
      alert('Erro ao baixar imagem: ' + e.message);
    } finally {
      setGerandoPng(false);
    }
  }, [ano]);

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
          title="Renegociações"
          subtitle="Acompanhe as parcelas das renegociações feitas no contas a pagar"
          icon={Handshake}
          iconColor="text-teal-600"
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
            {dadosCarregados && linhas.length > 0 && (
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
                Total Renegociado ({ano})
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
            <div className="bg-teal-50 rounded-lg border border-teal-300 shadow-sm px-4 py-2 flex flex-col justify-center min-w-[150px]">
              <p className="text-[9px] text-teal-700 uppercase tracking-wide">
                Fornecedores
              </p>
              <p className="text-sm font-bold text-teal-700 leading-tight">
                {resumo.fornecedores}
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
            <p className="text-sm">Carregando renegociações...</p>
          </div>
        )}

        {/* ─── Sem fornecedores configurados ───────────────────────────── */}
        {!loading &&
          dadosCarregados &&
          FORNECEDORES_RENEGOCIADOS.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <Handshake size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                Nenhum fornecedor de renegociação configurado.
              </p>
            </div>
          )}

        {/* ─── Tabela matriz fornecedor × mês ──────────────────────────── */}
        {!loading && dadosCarregados && linhas.length > 0 && (
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
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={baixarPng}
                  disabled={gerandoPng}
                  className="flex items-center gap-1.5 bg-[#000638] hover:opacity-90 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-60"
                >
                  {gerandoPng ? (
                    <Spinner size={12} className="animate-spin" />
                  ) : (
                    <ImageSquare size={12} weight="bold" />
                  )}
                  {gerandoPng ? 'Gerando...' : 'PNG'}
                </button>
                <button
                  type="button"
                  onClick={exportarExcel}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  <FileXls size={12} weight="bold" />
                  Excel
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {/* wrapper w-max: o PNG captura a largura total da tabela,
                  não só a área visível do scroll */}
              <div ref={tabelaRef} className="w-max min-w-full bg-white">
                <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#000638] text-white">
                    <th className="px-4 py-2.5 text-left font-bold sticky left-0 bg-[#000638] z-10 min-w-[180px]">
                      Fornecedor
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
                        {m}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-right font-bold min-w-[100px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => (
                    <tr
                      key={linha.cd}
                      className="border-b border-gray-100 hover:bg-gray-50 transition"
                    >
                      <td className="px-4 py-2 font-semibold text-[#000638] sticky left-0 bg-white z-10 border-r border-gray-100">
                        {linha.nomeExibicao}
                        <span className="block text-[9px] text-gray-400 font-normal">
                          Cód. {linha.cd} · {linha.qtdParcelas} parcela(s)
                        </span>
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
                            setModalParcelas({
                              fornecedorNome: linha.nomeExibicao,
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
                                {cel.parcela}
                                {cel.status === 'pago' && (
                                  <CheckCircle
                                    size={9}
                                    weight="fill"
                                    className="inline ml-0.5 mb-px"
                                  />
                                )}
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
                      <td className="px-3 py-2 text-right border-l border-gray-100 whitespace-nowrap">
                        <span className="block font-bold text-[#000638]">
                          {formatarMoeda(linha.totalGeral)}
                        </span>
                        <span className="block text-[9px] text-amber-600 font-semibold">
                          {formatarMoeda(linha.totalGeralAberto)} em aberto
                        </span>
                        <span className="block text-[9px] text-green-600 font-semibold">
                          {formatarMoeda(linha.totalGeralPago)} pago
                        </span>
                        {linha.parcelasGeral > 0 && (
                          <span
                            className="block text-[9px] text-gray-500 font-semibold"
                            title={`${linha.parcelasGeralPagas} parcela(s) paga(s) de ${linha.parcelasGeral} · ${linha.parcelasGeralAbertas} em aberto`}
                          >
                            {linha.parcelasGeralPagas}/{linha.parcelasGeral}{' '}
                            parcelas pagas
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold text-[#000638]">
                    <td className="px-4 py-2.5 sticky left-0 bg-gray-100 z-10">
                      TOTAL ({ano})
                    </td>
                    <td />
                    {totaisMes.map((t, m) => (
                      <td key={m} className="px-2 py-2.5 text-center">
                        {t > 0 ? formatarMoeda(t) : '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className="block">
                        {formatarMoeda(totaisGerais.total)}
                      </span>
                      <span className="block text-[9px] text-amber-600">
                        {formatarMoeda(totaisGerais.aberto)} em aberto
                      </span>
                      <span className="block text-[9px] text-green-600">
                        {formatarMoeda(totaisGerais.pago)} pago
                      </span>
                      {totaisGerais.parcelas > 0 && (
                        <span className="block text-[9px] text-gray-500">
                          {totaisGerais.parcelasPagas}/{totaisGerais.parcelas}{' '}
                          parcelas pagas
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── Tela inicial ─────────────────────────────────────────────── */}
        {!loading && !dadosCarregados && (
          <div className="text-center py-20 text-gray-400">
            <Handshake size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium mb-1">
              Selecione o ano e clique em Filtrar para visualizar as
              renegociações
            </p>
            <p className="text-sm">
              As parcelas são buscadas no contas a pagar por fornecedor
            </p>
          </div>
        )}
      </div>

      {/* ─── Modal de parcelas ─────────────────────────────────────────── */}
      {modalParcelas && (
        <ModalParcelas
          info={modalParcelas}
          onClose={() => setModalParcelas(null)}
        />
      )}
    </div>
  );
};

export default Renegociacoes;
