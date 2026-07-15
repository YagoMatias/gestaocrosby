import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Funnel,
  Spinner,
  FileArrowDown,
  WarningCircle,
  Tag,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import FiltroEmpresa from '../components/FiltroEmpresa';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/cards';
import useApiClient from '../hooks/useApiClient';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const formatBRL = (v) =>
  typeof v === 'number'
    ? v.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—';

const formatQtd = (v) =>
  typeof v === 'number'
    ? v.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      })
    : '—';

// Divide um array em "chunks" de no máximo `size` elementos
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Limitador de concorrência (estilo p-limit). Permite disparar várias
// requisições em paralelo sem sobrecarregar o servidor/TOTVS.
const createLimit = (concurrency) => {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(
        (v) => {
          active--;
          resolve(v);
          next();
        },
        (e) => {
          active--;
          reject(e);
          next();
        },
      );
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
};

export default function CMVConsolidado() {
  const apiClient = useApiClient();

  // Filtros
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [operationType, setOperationType] = useState('Output');
  const [costCode, setCostCode] = useState(1); // Código de custo TOTVS (PRDFL003)

  // Dados
  const [invoices, setInvoices] = useState([]); // NFs cruas
  const [productMap, setProductMap] = useState({}); // productCode → { referenceCode, productName }
  const [costMap, setCostMap] = useState({}); // `${branchCode}|${referenceCode}` → custo unitário
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(''); // texto de progresso
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [erro, setErro] = useState('');
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [totalItemsServer, setTotalItemsServer] = useState(0);

  // Expand/collapse removido — tabela plana por referência

  // CSS local
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .cmv-table { border-collapse: collapse; width: 100%; }
      .cmv-table th, .cmv-table td { padding: 6px 8px !important; border-bottom: 1px solid #f3f4f6; font-size: 12px; line-height: 1.3; }
      .cmv-table th { background-color: #000638; color: white; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; text-align: left; }
      .cmv-table tbody tr.empresa-row { background-color: #e8eaf2; font-weight: 700; }
      .cmv-table tbody tr.empresa-row:hover { background-color: #d8dcec; cursor: pointer; }
      .cmv-table tbody tr.ref-row { background-color: white; }
      .cmv-table tbody tr.ref-row:hover { background-color: #fafbff; }
      .cmv-table .text-right { text-align: right; }
      .cmv-table .text-center { text-align: center; }
      .cmv-table .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .pos { color:#15803d } .neg { color:#b91c1c }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Período padrão: mês atual
  useEffect(() => {
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    setDataInicio(primeiro.toISOString().split('T')[0]);
    setDataFim(hoje.toISOString().split('T')[0]);
  }, []);

  // ─── Helpers de fetch ────────────────────────────────────────────────
  const buildInvoicesBody = (page = 1, branchCodeList) => ({
    filter: {
      branchCodeList,
      startIssueDate: `${dataInicio}T00:00:00.000Z`,
      endIssueDate: `${dataFim}T23:59:59.999Z`,
      operationType,
      invoiceStatusList: ['Normal', 'Issued'],
    },
    page,
    pageSize: 100,
    expand: 'items',
    order: 'branchCode',
  });

  /**
   * Extrai todos os productCodes únicos das NFs.
   * Cada item de NF pode ter `invoiceItemsProduct[]` com productCode reais,
   * ou então usar item.productCode/code como fallback.
   */
  const extractProductCodes = (nfs) => {
    const set = new Set();
    for (const nf of nfs) {
      for (const item of nf.items || []) {
        if (
          Array.isArray(item.invoiceItemsProduct) &&
          item.invoiceItemsProduct.length
        ) {
          item.invoiceItemsProduct.forEach((p) => {
            const c = Number(p.productCode);
            if (Number.isFinite(c) && c > 0) set.add(c);
          });
        } else {
          const c = Number(item.productCode ?? item.code);
          if (Number.isFinite(c) && c > 0) set.add(c);
        }
      }
    }
    return Array.from(set);
  };

  /** Busca produtos em lotes (em paralelo) para descobrir referenceCode. */
  /**
   * Duas etapas otimizadas:
   * 1) products/search com productCodeList → descobre referenceCode por produto
   *    (lotes de 500, paralelo) — custo da referência é igual para todos os
   *    SKUs, então só precisamos das referências ÚNICAS.
   * 2) costs/search com referenceCodeList (ÚNICO por referência, não por produto)
   *    → muito menos chamadas quando há muitos produtos por referência.
   */
  const fetchCostsAndReferences = async (
    productCodes,
    branchCodes,
    costCodeNum,
  ) => {
    const pMap = {}; // productCode → { referenceCode, referenceName, productName }
    const cMap = {}; // `${branchCode}|${referenceCode}` → custo

    // ── Etapa 1: products/search para mapear productCode → referenceCode ──
    const PRODS_PER_CALL = 500;
    const prodLotes = chunk(productCodes, PRODS_PER_CALL);
    const limitProds = createLimit(4);
    let doneProds = 0;

    await Promise.all(
      prodLotes.map((lote) =>
        limitProds(async () => {
          let page = 1;
          while (true) {
            const body = {
              filter: { productCodeList: lote },
              option: { branchInfoCode: branchCodes[0] },
              page,
              pageSize: 1000,
            };
            const r = await apiClient.totvs.cmvProductsSearch(body);
            const raw = r?.data ?? r;
            const itensResp = raw?.items ?? [];
            // DEBUG: imprime 1 item da 1ª página do 1º lote pra ver os campos
            if (page === 1 && doneProds === 0 && itensResp.length > 0) {
              console.log('[CMV] Sample product item:', itensResp[0]);
              console.log('[CMV] Sample keys:', Object.keys(itensResp[0]));
            }
            for (const p of itensResp) {
              const code = p.productCode;
              // Tenta TODOS os caminhos possíveis para o referenceCode
              const ref =
                p.referenceCode ??
                p.ReferenceCode ??
                p.lastReferenceCode ??
                p.reference?.code ??
                p.reference?.referenceCode ??
                p.referenceId ??
                null;
              if (code != null) {
                pMap[code] = {
                  referenceCode: ref,
                  referenceName:
                    p.referenceName ??
                    p.reference?.name ??
                    p.reference?.referenceName ??
                    '',
                  productName: p.productName ?? '',
                };
              }
            }
            if (!raw?.hasNext) break;
            page += 1;
          }
          doneProds += 1;
          setStage(
            `Carregando referências (${doneProds}/${prodLotes.length})...`,
          );
        }),
      ),
    );

    // Diagnóstico: produtos solicitados mas não retornados pela API
    const faltantes = productCodes.filter((c) => !(c in pMap));
    if (faltantes.length > 0) {
      console.warn(
        `[CMV] ${faltantes.length} produtos sem retorno em products/search:`,
        faltantes.slice(0, 30),
      );
    }
    // Diagnóstico: produtos retornados mas SEM ReferenceCode
    const semRef = Object.entries(pMap)
      .filter(([, v]) => !v.referenceCode)
      .map(([k]) => k);
    if (semRef.length > 0) {
      console.warn(
        `[CMV] ${semRef.length} produtos retornados SEM ReferenceCode:`,
        semRef.slice(0, 30),
      );
    }

    // ── Etapa 2: costs/search por referência ÚNICA ──
    // O custo da referência é IGUAL para todas as empresas e para todos os
    // produtos (SKUs) dela. Então:
    //   • Buscamos só 1 vez por referência (não por SKU).
    //   • Usamos apenas 1 branch em option.costs[] (param obrigatório do schema).
    //   • cMap fica indexado apenas por referenceCode.
    const uniqueRefs = Array.from(
      new Set(
        Object.values(pMap)
          .map((x) => x.referenceCode)
          // sanitiza: precisa ser string não vazia, sem espaços nas pontas
          .map((x) => (typeof x === 'string' ? x.trim() : x))
          .filter((x) => typeof x === 'string' && x.length > 0),
      ),
    );
    if (uniqueRefs.length === 0) return { pMap, cMap };

    // Lote menor (a TOTVS rejeita lotes grandes em alguns casos com 400).
    const REFS_PER_CALL = 30;
    const refLotes = chunk(uniqueRefs, REFS_PER_CALL);
    const limitCosts = createLimit(4);
    let doneCosts = 0;

    /**
     * Faz a chamada de custos. Em caso de 400 (Bad Request), tenta dividir o
     * lote em duas metades e re-tentar — é provável que alguma refCode
     * específica esteja causando o erro. Quando o lote é unitário e ainda dá
     * erro, registra a ref problemática e segue.
     */
    const fetchCostLote = async (lote) => {
      let page = 1;
      while (true) {
        const body = {
          filter: { referenceCodeList: lote },
          option: {
            costs: [
              { branchCode: branchCodes[0], costCodeList: [costCodeNum] },
            ],
          },
          page,
          pageSize: 1000,
        };
        let r;
        try {
          r = await apiClient.totvs.cmvCostsSearch(body);
        } catch (e) {
          // 400: tenta dividir
          if (e?.status === 400 || /400/.test(e?.message || '')) {
            if (lote.length === 1) {
              console.warn('[CMV] ref problemática:', lote[0]);
              return;
            }
            const mid = Math.floor(lote.length / 2);
            console.warn(
              `[CMV] 400 no lote de ${lote.length} refs — dividindo`,
            );
            await fetchCostLote(lote.slice(0, mid));
            await fetchCostLote(lote.slice(mid));
            return;
          }
          console.warn('Custo falhou:', e?.message);
          return;
        }
        const raw = r?.data ?? r;
        for (const it of raw?.items ?? []) {
          const ref = it.referenceCode;
          if (!ref) continue;
          for (const c of it.costs || []) {
            if (Number(c.costCode) !== Number(costCodeNum)) continue;
            const valor = Number(c.cost ?? 0);
            if (!valor) continue;
            cMap[ref] = valor;
          }
        }
        if (!raw?.hasNext) break;
        page += 1;
      }
    };

    await Promise.all(
      refLotes.map((lote) =>
        limitCosts(async () => {
          await fetchCostLote(lote);
          doneCosts += 1;
          setStage(`Carregando custos (${doneCosts}/${refLotes.length})...`);
        }),
      ),
    );
    return { pMap, cMap };
  };

  // ─── Ação principal ──────────────────────────────────────────────────
  const buscarDados = async () => {
    if (!dataInicio || !dataFim) {
      setErro('Informe as datas de início e fim.');
      return;
    }
    if (empresasSelecionadas.length === 0) {
      setErro('Selecione pelo menos uma empresa.');
      return;
    }
    setLoading(true);
    setErro('');
    setInvoices([]);
    setProductMap({});
    setCostMap({});
    setDadosCarregados(false);
    setProgresso({ atual: 0, total: 0 });
    setStage('');

    try {
      const branchCodeList = empresasSelecionadas.map((e) =>
        parseInt(e.cd_empresa),
      );

      // 1) Notas fiscais (paginação completa)
      setStage('Carregando notas fiscais...');
      const r1 = await apiClient.totvs.cmvInvoicesSearch(
        buildInvoicesBody(1, branchCodeList),
      );
      const raw1 = r1?.data ?? r1;
      const items1 = raw1?.items ?? [];
      const totalPages = raw1?.totalPages ?? 1;
      const totalItems = raw1?.totalItems ?? items1.length;
      setTotalItemsServer(totalItems);

      const acumulado = [...items1];
      setProgresso({ atual: 1, total: totalPages });

      if (totalPages > 1) {
        // Paraleliza páginas 2..N com limite de concorrência para não
        // estourar o servidor TOTVS nem o backend proxy.
        const limit = createLimit(6);
        const pages = [];
        for (let p = 2; p <= totalPages; p++) pages.push(p);
        let concluidas = 1;
        await Promise.all(
          pages.map((p) =>
            limit(async () => {
              const r = await apiClient.totvs.cmvInvoicesSearch(
                buildInvoicesBody(p, branchCodeList),
              );
              const raw = r?.data ?? r;
              acumulado.push(...(raw?.items ?? []));
              concluidas += 1;
              setProgresso({ atual: concluidas, total: totalPages });
              setStage(
                `Carregando notas fiscais (${concluidas}/${totalPages})...`,
              );
            }),
          ),
        );
      }

      // 2) Busca referências e custos em uma única rodada de chamadas.
      //    costs/search aceita productCodeList e já devolve referenceCode
      //    por item — elimina o products/search completamente.
      const productCodes = extractProductCodes(acumulado);
      let pMap = {};
      let cMap = {};
      if (productCodes.length > 0) {
        setStage('Carregando referências e custos...');
        const result = await fetchCostsAndReferences(
          productCodes,
          branchCodeList,
          Number(costCode),
        );
        pMap = result.pMap;
        cMap = result.cMap;
      }

      setInvoices(acumulado);
      setProductMap(pMap);
      setCostMap(cMap);
      setDadosCarregados(true);
    } catch (err) {
      setErro(err.message || 'Erro ao buscar dados.');
    } finally {
      setLoading(false);
      setProgresso({ atual: 0, total: 0 });
      setStage('');
    }
  };

  // ─── Agrupamento: apenas por Referência ─────────────────────────────
  const dadosAgrupados = useMemo(() => {
    const mapa = new Map(); // referenceCode → acumulador

    for (const nf of invoices) {
      for (const item of nf.items || []) {
        const subProds =
          Array.isArray(item.invoiceItemsProduct) &&
          item.invoiceItemsProduct.length > 0
            ? item.invoiceItemsProduct.map((p) => ({
                productCode: Number(p.productCode ?? item.code) || 0,
                productName: p.productName ?? item.name ?? '',
                quantity: Number(p.quantity) || 0,
                netValue: Number(p.netValue) || 0,
              }))
            : [
                {
                  productCode: Number(item.productCode ?? item.code) || 0,
                  productName: item.productName ?? item.name ?? '',
                  quantity: Number(item.quantity) || 0,
                  netValue:
                    Number(item.netValue ?? item.productValue ?? 0) || 0,
                },
              ];

        for (const prod of subProds) {
          const refInfo = productMap[prod.productCode];
          const refCode =
            refInfo?.referenceCode || `SEM-REF-${prod.productCode}`;
          const refName = refInfo?.referenceName || prod.productName || '';

          if (!mapa.has(refCode)) {
            mapa.set(refCode, {
              referenceCode: refCode,
              referenceName: refName,
              hasReference: !!refInfo,
              totalQtd: 0,
              totalValor: 0,
              custoUnit: costMap[refCode] ?? 0,
            });
          }
          const ref = mapa.get(refCode);
          ref.totalQtd += prod.quantity;
          ref.totalValor += prod.netValue;
        }
      }
    }

    return Array.from(mapa.values()).sort(
      (a, b) => b.totalValor - a.totalValor,
    );
  }, [invoices, productMap, costMap]);

  const totaisGerais = useMemo(
    () =>
      dadosAgrupados.reduce(
        (acc, r) => {
          const custoTotal = (r.custoUnit || 0) * r.totalQtd;
          acc.totalValor += r.totalValor;
          acc.totalQtd += r.totalQtd;
          acc.totalCusto += custoTotal;
          return acc;
        },
        { totalValor: 0, totalQtd: 0, totalCusto: 0 },
      ),
    [dadosAgrupados],
  );

  // ─── UI helpers ──────────────────────────────────────────────────────
  const exportarExcel = () => {
    if (dadosAgrupados.length === 0) return;
    const rows = dadosAgrupados.map((r) => {
      const custoTotal = (r.custoUnit || 0) * r.totalQtd;
      const margem = r.totalValor - custoTotal;
      return {
        Referência: r.referenceCode,
        'Nome Referência': r.referenceName,
        Quantidade: r.totalQtd,
        'Valor Venda': r.totalValor,
        'Custo Unit.': r.custoUnit,
        'Custo Total': custoTotal,
        Margem: margem,
        'Margem %': r.totalValor > 0 ? (margem / r.totalValor) * 100 : 0,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CMV por Referência');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      `cmv-referencias_${dataInicio}_${dataFim}.xlsx`,
    );
  };

  // Estatísticas auxiliares
  const totalProdutosMapeados = Object.keys(productMap).length;
  const margemGeral = totaisGerais.totalValor - totaisGerais.totalCusto;
  const margemGeralPct =
    totaisGerais.totalValor > 0
      ? (margemGeral / totaisGerais.totalValor) * 100
      : 0;

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      <PageTitle
        title="CMV Consolidado"
        icon={Package}
        subtitle="Vendas consolidadas por Referência, com custo TOTVS"
      />

      {/* ── Filtros ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Funnel size={16} /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Empresas (Filiais)
              </label>
              <FiltroEmpresa
                empresasSelecionadas={empresasSelecionadas}
                onSelectEmpresas={setEmpresasSelecionadas}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Tipo Operação
              </label>
              <select
                value={operationType}
                onChange={(e) => setOperationType(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="All">Todos</option>
                <option value="Input">Entradas</option>
                <option value="Output">Saídas (Vendas)</option>
              </select>
            </div>
            <div>
              <label
                className="text-xs font-semibold text-gray-600 block mb-1"
                title="Código de custo TOTVS (PRDFL003) — ex.: 1 = custo médio"
              >
                Cód. Custo TOTVS
              </label>
              <input
                type="number"
                min={1}
                value={costCode}
                onChange={(e) => setCostCode(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>

            <div className="flex items-end gap-2 lg:col-span-5 flex-wrap">
              <button
                onClick={buscarDados}
                disabled={loading}
                className="flex items-center gap-2 bg-[#000638] text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-[#0a1a5c] disabled:opacity-50"
              >
                {loading ? (
                  <Spinner size={14} className="animate-spin" />
                ) : (
                  <Package size={14} />
                )}
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
              <button
                onClick={async () => {
                  try {
                    await apiClient.totvs.cmvClearCache();
                    alert('Cache limpo com sucesso.');
                  } catch {
                    alert('Falha ao limpar cache.');
                  }
                }}
                disabled={loading}
                title="Limpa o cache do servidor TOTVS (força novo fetch)"
                className="border border-gray-300 text-gray-500 px-3 py-1.5 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                Limpar cache
              </button>
              {dadosCarregados && dadosAgrupados.length > 0 && (
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                >
                  <FileArrowDown size={14} />
                  Exportar Excel
                </button>
              )}
            </div>
          </div>

          {loading && (stage || progresso.total > 0) && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              {stage}
              {progresso.total > 0 &&
                ` (página ${progresso.atual}/${progresso.total})`}
            </div>
          )}

          {erro && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <WarningCircle size={14} /> {erro}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Cards de totais ── */}
      {dadosCarregados && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                NFs
              </p>
              <p className="text-lg font-bold text-[#000638]">
                {invoices.length.toLocaleString('pt-BR')}
              </p>
              {totalItemsServer > invoices.length && (
                <p className="text-[10px] text-orange-500">
                  {totalItemsServer.toLocaleString('pt-BR')} no servidor
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                Referências
              </p>
              <p className="text-lg font-bold text-[#000638]">
                {dadosAgrupados.length.toLocaleString('pt-BR')}
              </p>
              <p className="text-[10px] text-gray-500">
                {totalProdutosMapeados} produtos mapeados
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                Valor Venda
              </p>
              <p className="text-lg font-bold text-green-700">
                R$ {formatBRL(totaisGerais.totalValor)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                Custo Total
              </p>
              <p className="text-lg font-bold text-orange-700">
                R$ {formatBRL(totaisGerais.totalCusto)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                Margem
              </p>
              <p
                className={`text-lg font-bold ${
                  margemGeral >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
              >
                R$ {formatBRL(margemGeral)}
              </p>
              <p className="text-[10px] text-gray-500">
                {margemGeralPct.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tabela ── */}
      {dadosCarregados && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Vendas por Referência</CardTitle>
            <CardDescription className="text-xs">
              Consolidado de todas as lojas selecionadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dadosAgrupados.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">
                Nenhuma venda no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="cmv-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Referência</th>
                      <th className="text-right">Qtd</th>
                      <th className="text-right">Valor Venda</th>
                      <th className="text-right">Custo Unit</th>
                      <th className="text-right">Custo Total</th>
                      <th className="text-right">Margem</th>
                      <th className="text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosAgrupados.map((r) => {
                      const custoTotal = (r.custoUnit || 0) * r.totalQtd;
                      const margem = r.totalValor - custoTotal;
                      const pct =
                        r.totalValor > 0 ? (margem / r.totalValor) * 100 : 0;
                      return (
                        <tr key={r.referenceCode} className="ref-row">
                          <td>
                            <span className="inline-flex items-center gap-1.5">
                              <Tag size={12} weight="duotone" />
                              <span
                                className={`font-mono ${
                                  r.hasReference
                                    ? 'text-gray-700'
                                    : 'text-orange-600'
                                }`}
                              >
                                {r.referenceCode}
                              </span>
                              {r.referenceName && (
                                <span className="text-[11px] text-gray-500">
                                  — {r.referenceName}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="text-right font-mono">
                            {formatQtd(r.totalQtd)}
                          </td>
                          <td className="text-right font-mono pos">
                            R$ {formatBRL(r.totalValor)}
                          </td>
                          <td className="text-right font-mono text-gray-600">
                            {r.custoUnit ? `R$ ${formatBRL(r.custoUnit)}` : '—'}
                          </td>
                          <td className="text-right font-mono text-gray-600">
                            {r.custoUnit ? `R$ ${formatBRL(custoTotal)}` : '—'}
                          </td>
                          <td
                            className={`text-right font-mono ${
                              r.custoUnit
                                ? margem >= 0
                                  ? 'pos'
                                  : 'neg'
                                : 'text-gray-400'
                            }`}
                          >
                            {r.custoUnit ? `R$ ${formatBRL(margem)}` : '—'}
                          </td>
                          <td
                            className={`text-right font-mono ${
                              r.custoUnit
                                ? margem >= 0
                                  ? 'pos'
                                  : 'neg'
                                : 'text-gray-400'
                            }`}
                          >
                            {r.custoUnit ? `${pct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total geral */}
                    <tr style={{ backgroundColor: '#000638', color: 'white' }}>
                      <td className="font-bold">TOTAL GERAL</td>
                      <td className="text-right font-mono font-bold">
                        {formatQtd(totaisGerais.totalQtd)}
                      </td>
                      <td className="text-right font-mono font-bold">
                        R$ {formatBRL(totaisGerais.totalValor)}
                      </td>
                      <td></td>
                      <td className="text-right font-mono font-bold">
                        R$ {formatBRL(totaisGerais.totalCusto)}
                      </td>
                      <td className="text-right font-mono font-bold">
                        R$ {formatBRL(margemGeral)}
                      </td>
                      <td className="text-right font-mono font-bold">
                        {margemGeralPct.toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
