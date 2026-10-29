// Preço Promocional (Excel) — grava o valor promocional de uma lista de SKUs
// na promoção do TOTVS (PRDFM002) via product/v2/promotion-values/update.
//
// Fluxo: empresa + promoção + % de desconto → planilha (ou lista colada) com
// os SKUs → "Buscar no TOTVS" mostra o preço atual e o valor calculado →
// revisa (pode ajustar o valor linha a linha) → "Aplicar no TOTVS".
// Produto que ainda não está na promoção é INSERIDO (promotion-items) quando
// a opção "incluir novos" estiver marcada.
//
// Backend: totvsrouter/promocaoValores.js (apigestaocrosby) em
// /api/totvs/promocao-valores/{promocoes,preview,aplicar}.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Tag,
  Upload,
  FileXls,
  MagnifyingGlass,
  Spinner,
  CheckCircle,
  XCircle,
  WarningCircle,
  ArrowsClockwise,
  Download,
  Percent,
  Storefront,
  ClipboardText,
  Trash,
  Megaphone,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import { API_BASE_URL } from '../config/constants';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const fmtBRL = (v) =>
  v == null || v === '' || !Number.isFinite(Number(v))
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// Arredondamento comercial do valor calculado
const ARREDONDAMENTOS = [
  { id: 'exato', nome: 'Centavos exatos' },
  { id: 'inteiro', nome: 'Sem centavos (R$ 67,00)' },
  { id: '90', nome: 'Terminar em ,90' },
  { id: '99', nome: 'Terminar em ,99' },
];
function arredondar(valor, modo) {
  const v = Number(valor);
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (modo === 'inteiro') return Math.max(1, Math.round(v));
  if (modo === '90' || modo === '99') {
    const cent = modo === '90' ? 0.9 : 0.99;
    const base = Math.floor(v);
    // vai pro ",90/,99" mais próximo (pra baixo se os centavos já passaram)
    const candidato = base + cent;
    return round2(candidato > v + 0.5 ? base - 1 + cent : candidato);
  }
  return round2(v);
}

// Acha a coluna de SKU na planilha: cabeçalho parecido com sku/código/ean…
const COLUNAS_SKU = /^(sku|c[oó]d(igo)?|c[oó]d(igo)?[\s_-]*(produto|prod|interno|barras)|produto|ean|gtin|barras|c[oó]digo de barras|referencia|referência)$/i;
function extrairSkusDaPlanilha(matriz) {
  const linhas = matriz.filter((l) => Array.isArray(l) && l.some((c) => String(c).trim() !== ''));
  if (!linhas.length) return { skus: [], coluna: null };
  const cab = linhas[0].map((c) => String(c || '').trim());
  let idx = cab.findIndex((c) => COLUNAS_SKU.test(c));
  let inicio = 1;
  if (idx === -1) {
    // sem cabeçalho reconhecível: se a primeira linha já parece dado, usa a 1ª coluna desde o início
    idx = 0;
    const primeira = cab[0];
    inicio = /^[\d.\sA-Za-z-]+$/.test(primeira) && /\d/.test(primeira) ? 0 : 1;
  }
  const skus = linhas
    .slice(inicio)
    .map((l) => l[idx])
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);
  return { skus, coluna: cab[idx] || `coluna ${idx + 1}` };
}

const SITUACAO = {
  atualizar: { label: 'Atualizar', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  inserir: { label: 'Inserir na promoção', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ignorar: { label: 'Fora da promoção (ignorado)', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  nao_encontrado: { label: 'Não encontrado', cls: 'bg-red-50 text-red-700 border-red-200' },
  sem_preco: { label: 'Sem preço', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  gravado: { label: 'Gravado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  erro: { label: 'Erro', cls: 'bg-red-100 text-red-800 border-red-300' },
};

export default function PromocaoValores() {
  const { apiMutate } = useApiClient();
  const fileRef = useRef(null);

  // ── parâmetros ──
  const [empresas, setEmpresas] = useState([]);
  const [empresa, setEmpresa] = useState('');
  const [promocoes, setPromocoes] = useState([]);
  const [promocao, setPromocao] = useState('');
  const [statusPromo, setStatusPromo] = useState('Open');
  const [carregandoPromos, setCarregandoPromos] = useState(false);
  const [erroPromos, setErroPromos] = useState(null);
  const [promoCache, setPromoCache] = useState(null);
  const [priceCode, setPriceCode] = useState(1);
  const [percentual, setPercentual] = useState(30);
  const [arredondamento, setArredondamento] = useState('exato');
  const [incluirNovos, setIncluirNovos] = useState(true);

  // ── skus ──
  const [skus, setSkus] = useState([]);
  const [origemSkus, setOrigemSkus] = useState(null); // { arquivo, coluna }
  const [textoSkus, setTextoSkus] = useState('');

  // ── prévia / gravação ──
  const [buscando, setBuscando] = useState(false);
  const [rows, setRows] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [valores, setValores] = useState({}); // productCode → valor editado
  const [selecionados, setSelecionados] = useState({}); // productCode → bool
  const [erro, setErro] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Empresas do TOTVS
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/totvs/branches`, {
          headers: { 'x-api-key': API_KEY },
        });
        const j = await r.json();
        const lista = Array.isArray(j?.data?.data)
          ? j.data.data
          : Array.isArray(j?.data)
            ? j.data
            : [];
        setEmpresas(
          lista
            .map((e) => ({
              codigo: parseInt(e.cd_empresa ?? e.code, 10),
              nome: e.nm_grupoempresa || e.nm_empresa || e.name || '',
            }))
            .filter((e) => Number.isFinite(e.codigo))
            .sort((a, b) => a.codigo - b.codigo),
        );
      } catch (e) {
        setErro(`Não consegui carregar as empresas do TOTVS: ${e.message}`);
      }
    })();
  }, []);

  const carregarPromocoes = useCallback(
    async (refresh = false) => {
      if (!empresa) return;
      setCarregandoPromos(true);
      setErroPromos(null);
      try {
        const url = new URL('/api/totvs/promocao-valores/promocoes', API_BASE_URL);
        url.searchParams.set('branch', empresa);
        url.searchParams.set('status', statusPromo);
        if (refresh) url.searchParams.set('refresh', '1');
        const r = await fetch(url.toString(), { headers: { 'x-api-key': API_KEY } });
        const j = await r.json();
        if (!j.success) throw new Error(j.message || 'Erro ao listar promoções');
        setPromocoes(j.data?.promocoes || []);
        setPromoCache(j.data?.cache ? j.data.at : null);
        if (!(j.data?.promocoes || []).some((p) => String(p.promotionCode) === String(promocao))) {
          setPromocao('');
        }
      } catch (e) {
        setErroPromos(e.message);
        setPromocoes([]);
      } finally {
        setCarregandoPromos(false);
      }
    },
    [empresa, statusPromo, promocao],
  );

  useEffect(() => {
    setPromocoes([]);
    setPromocao('');
    if (empresa) carregarPromocoes(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, statusPromo]);

  const promoSelecionada = useMemo(
    () => promocoes.find((p) => String(p.promotionCode) === String(promocao)) || null,
    [promocoes, promocao],
  );

  // ── leitura da planilha ──
  const lerArquivo = useCallback((file) => {
    if (!file) return;
    setErro(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        const { skus: lidos, coluna } = extrairSkusDaPlanilha(matriz);
        if (!lidos.length) {
          setErro('Não achei nenhum SKU na planilha. Use uma coluna "SKU" (ou "Código", "EAN").');
          return;
        }
        setSkus(lidos);
        setOrigemSkus({ arquivo: file.name, coluna, aba: wb.SheetNames[0] });
        setTextoSkus('');
        setRows([]);
        setResumo(null);
        setResultado(null);
      } catch (e) {
        setErro(`Erro ao ler a planilha: ${e.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const usarTexto = useCallback(() => {
    const lidos = textoSkus
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lidos.length) {
      setErro('Cole ao menos um SKU (um por linha, ou separados por vírgula).');
      return;
    }
    setErro(null);
    setSkus(lidos);
    setOrigemSkus({ arquivo: 'lista colada', coluna: null });
    setRows([]);
    setResumo(null);
    setResultado(null);
  }, [textoSkus]);

  const limparSkus = () => {
    setSkus([]);
    setOrigemSkus(null);
    setRows([]);
    setResumo(null);
    setResultado(null);
    setValores({});
    setSelecionados({});
    if (fileRef.current) fileRef.current.value = '';
  };

  const baixarModelo = () => {
    const ws = XLSX.utils.aoa_to_sheet([['SKU'], ['46602'], ['7891234567890']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKUs');
    XLSX.writeFile(wb, 'modelo-preco-promocional.xlsx');
  };

  // ── prévia ──
  const pctValido = Number.isFinite(Number(percentual)) && Number(percentual) >= 0 && Number(percentual) < 100;

  const calcular = useCallback(
    (price) => arredondar(Number(price) * (1 - Number(percentual) / 100), arredondamento),
    [percentual, arredondamento],
  );

  const buscar = useCallback(async () => {
    if (!empresa || !promocao || !skus.length) return;
    setBuscando(true);
    setErro(null);
    setResultado(null);
    try {
      const j = await apiMutate(
        '/api/totvs/promocao-valores/preview',
        'POST',
        { branch: Number(empresa), promotionCode: Number(promocao), priceCode: Number(priceCode) || 1, skus },
        {},
        { timeout: 10 * 60 * 1000 },
      );
      const lista = j?.data?.rows || [];
      setRows(lista);
      setResumo(j?.data?.resumo || null);
      const sel = {};
      const vals = {};
      for (const r of lista) {
        if (r.status === 'ok') {
          sel[r.productCode] = true;
          vals[r.productCode] = calcular(r.price);
        }
      }
      setSelecionados(sel);
      setValores(vals);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  }, [empresa, promocao, skus, priceCode, apiMutate, calcular]);

  // Recalcula os valores quando o % ou o arredondamento mudam (mantém edição manual? não — % manda)
  useEffect(() => {
    if (!rows.length) return;
    setValores((prev) => {
      const next = { ...prev };
      for (const r of rows) if (r.status === 'ok') next[r.productCode] = calcular(r.price);
      return next;
    });
  }, [percentual, arredondamento, rows, calcular]);

  const situacaoDe = (r) => {
    if (resultado) {
      if (resultado.gravados.has(r.productCode)) return 'gravado';
      if (resultado.errosPorCodigo[r.productCode]) return 'erro';
    }
    if (r.status !== 'ok') return r.status;
    if (r.naPromocao) return 'atualizar';
    return incluirNovos ? 'inserir' : 'ignorar';
  };

  const itensParaGravar = useMemo(
    () =>
      rows
        .filter((r) => r.status === 'ok' && selecionados[r.productCode])
        .filter((r) => incluirNovos || r.naPromocao)
        .map((r) => ({ productCode: r.productCode, promotionValue: round2(valores[r.productCode]) }))
        .filter((i) => Number.isFinite(i.promotionValue) && i.promotionValue > 0),
    [rows, selecionados, valores, incluirNovos],
  );
  const qtdAtualizar = useMemo(
    () => rows.filter((r) => r.status === 'ok' && selecionados[r.productCode] && r.naPromocao).length,
    [rows, selecionados],
  );
  const qtdInserir = itensParaGravar.length - qtdAtualizar;

  const aplicar = useCallback(async () => {
    setConfirmar(false);
    if (!itensParaGravar.length) return;
    setAplicando(true);
    setErro(null);
    try {
      const j = await apiMutate(
        '/api/totvs/promocao-valores/aplicar',
        'POST',
        { branch: Number(empresa), promotionCode: Number(promocao), items: itensParaGravar, incluirNovos },
        {},
        { timeout: 30 * 60 * 1000 },
      );
      const d = j?.data || {};
      const errosPorCodigo = {};
      for (const e of d.erros || []) errosPorCodigo[e.productCode] = e;
      setResultado({
        atualizados: d.atualizados || [],
        inseridos: d.inseridos || [],
        ignorados: d.ignorados || [],
        erros: d.erros || [],
        gravados: new Set([...(d.atualizados || []), ...(d.inseridos || [])]),
        errosPorCodigo,
      });
      // marca os itens da promoção como existentes (pra uma 2ª aplicação virar update)
      setRows((prev) =>
        prev.map((r) =>
          (d.inseridos || []).includes(r.productCode) || (d.atualizados || []).includes(r.productCode)
            ? { ...r, naPromocao: true, valorPromocaoAtual: round2(valores[r.productCode]) }
            : r,
        ),
      );
    } catch (e) {
      setErro(e.message);
    } finally {
      setAplicando(false);
    }
  }, [itensParaGravar, empresa, promocao, incluirNovos, apiMutate, valores]);

  const exportar = () => {
    const dados = rows.map((r) => ({
      SKU: r.sku,
      'Código TOTVS': r.productCode ?? '',
      Produto: r.productName || '',
      Referência: r.referenceCode || '',
      Cor: r.colorName || '',
      Tamanho: r.sizeName || '',
      'Preço atual': r.price ?? '',
      'Promo atual': r.valorPromocaoAtual ?? '',
      'Novo valor': r.status === 'ok' ? round2(valores[r.productCode]) : '',
      Situação: SITUACAO[situacaoDe(r)]?.label || r.status,
      Erro: resultado?.errosPorCodigo?.[r.productCode]?.erro || r.erro || '',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultado');
    XLSX.writeFile(wb, `preco-promocional-${empresa}-${promocao}.xlsx`);
  };

  const todosSelecionados = rows.filter((r) => r.status === 'ok').every((r) => selecionados[r.productCode]);
  const toggleTodos = () => {
    const sel = {};
    for (const r of rows) if (r.status === 'ok') sel[r.productCode] = !todosSelecionados;
    setSelecionados(sel);
  };

  const pronto = empresa && promocao && skus.length > 0 && pctValido;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      <PageTitle
        title="Preço Promocional (Excel)"
        subtitle="Importe a planilha com os SKUs, escolha a promoção do TOTVS e o percentual de desconto. O valor promocional é calculado sobre o preço atual e gravado item a item na promoção (PRDFM002)."
        icon={Tag}
        iconColor="text-rose-600"
      />

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle size={18} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* ── 1. Parâmetros ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#000638] mb-3">
            <Storefront size={18} className="text-rose-600" /> 1. Empresa e promoção
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-gray-600">
              Empresa (TOTVS)
              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              >
                <option value="">Selecione…</option>
                {empresas.map((e) => (
                  <option key={e.codigo} value={e.codigo}>
                    {e.codigo} — {e.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              <span className="flex items-center justify-between">
                <span>Promoção</span>
                <span className="flex items-center gap-2">
                  <select
                    value={statusPromo}
                    onChange={(e) => setStatusPromo(e.target.value)}
                    className="rounded border border-gray-200 px-1 py-0.5 text-[11px]"
                    title="Situação das promoções listadas"
                  >
                    <option value="Open">Abertas</option>
                    <option value="Blocked">Bloqueadas</option>
                    <option value="Closed">Encerradas</option>
                    <option value="all">Todas</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => carregarPromocoes(true)}
                    disabled={!empresa || carregandoPromos}
                    className="text-rose-600 hover:text-rose-800 disabled:opacity-40"
                    title="Recarregar do TOTVS (ignora o cache de 10 min)"
                  >
                    <ArrowsClockwise size={14} className={carregandoPromos ? 'animate-spin' : ''} />
                  </button>
                </span>
              </span>
              <select
                value={promocao}
                onChange={(e) => setPromocao(e.target.value)}
                disabled={!empresa || carregandoPromos}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 disabled:bg-gray-50"
              >
                <option value="">
                  {carregandoPromos
                    ? 'Lendo as promoções no TOTVS (pode levar até 1 min)…'
                    : empresa
                      ? promocoes.length
                        ? 'Selecione…'
                        : 'Nenhuma promoção nesta situação'
                      : 'Escolha a empresa primeiro'}
                </option>
                {promocoes.map((p) => (
                  <option key={p.promotionCode} value={p.promotionCode}>
                    {p.promotionCode} — {p.description} ({fmtData(p.startDate)} a {fmtData(p.endDate)}) · {p.itens} itens
                  </option>
                ))}
              </select>
              {erroPromos && <span className="text-red-600">{erroPromos}</span>}
              {promoCache && !erroPromos && (
                <span className="text-[11px] text-gray-400">
                  lista do cache ({new Date(promoCache).toLocaleTimeString('pt-BR')}) — clique no ícone para recarregar
                </span>
              )}
            </label>
          </div>
          {promoSelecionada && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <Megaphone size={16} />
              <strong>{promoSelecionada.description}</strong>
              <span>· {fmtData(promoSelecionada.startDate)} a {fmtData(promoSelecionada.endDate)}</span>
              <span>· {promoSelecionada.statusLabel}</span>
              <span>· {promoSelecionada.itens} itens hoje</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#000638] mb-3">
            <Percent size={18} className="text-rose-600" /> 2. Desconto
          </h2>
          <label className="text-xs text-gray-600 block">
            Percentual sobre o preço atual
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={99.99}
                step={0.5}
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
                className={`w-28 rounded-lg border px-3 py-2 text-lg font-bold text-[#000638] focus:ring-1 ${
                  pctValido ? 'border-gray-300 focus:border-rose-500 focus:ring-rose-500' : 'border-red-400 focus:ring-red-400'
                }`}
              />
              <span className="text-xl font-bold text-gray-500">%</span>
            </div>
          </label>
          <div className="mt-2 flex flex-wrap gap-1">
            {[10, 20, 30, 40, 50, 60, 70].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPercentual(p)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  Number(percentual) === p
                    ? 'border-rose-600 bg-rose-600 text-white'
                    : 'border-gray-300 text-gray-600 hover:border-rose-400'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600">
              Arredondamento
              <select
                value={arredondamento}
                onChange={(e) => setArredondamento(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              >
                {ARREDONDAMENTOS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600" title="Tipo de valor do TOTVS (PRDFL003) usado como preço base. 1 = VAREJO.">
              Tipo de preço base
              <input
                type="number"
                min={1}
                value={priceCode}
                onChange={(e) => setPriceCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
              />
            </label>
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={incluirNovos}
              onChange={(e) => setIncluirNovos(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Incluir na promoção os produtos que ainda não estão nela
              <span className="block text-[11px] text-gray-400">
                desmarcado: só atualiza o valor de quem já está na promoção
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ── 3. SKUs ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#000638]">
            <FileXls size={18} className="text-rose-600" /> 3. SKUs da planilha
          </h2>
          <button
            type="button"
            onClick={baixarModelo}
            className="flex items-center gap-1 text-xs text-rose-700 hover:underline"
          >
            <Download size={14} /> baixar modelo .xlsx
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-center hover:border-rose-400 hover:bg-rose-50/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                lerArquivo(e.dataTransfer.files?.[0]);
              }}
            >
              <Upload size={28} className="text-rose-500 mb-2" />
              <span className="text-sm font-medium text-gray-700">Clique ou arraste o Excel (.xlsx / .csv)</span>
              <span className="text-xs text-gray-400 mt-1">
                coluna "SKU" (aceita Código, EAN, Código de barras) — 1ª aba
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => lerArquivo(e.target.files?.[0])}
              />
            </label>
          </div>
          <div>
            <label className="text-xs text-gray-600 block">
              …ou cole a lista de SKUs (um por linha)
              <textarea
                value={textoSkus}
                onChange={(e) => setTextoSkus(e.target.value)}
                rows={4}
                placeholder={'46602\n7891234567890'}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </label>
            <button
              type="button"
              onClick={usarTexto}
              disabled={!textoSkus.trim()}
              className="mt-1 flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <ClipboardText size={14} /> usar esta lista
            </button>
          </div>
        </div>

        {skus.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <CheckCircle size={16} className="text-emerald-600" />
            <span>
              <strong>{skus.length}</strong> SKUs lidos de <strong>{origemSkus?.arquivo}</strong>
              {origemSkus?.coluna ? ` (coluna "${origemSkus.coluna}")` : ''}
            </span>
            <span className="text-gray-400 truncate max-w-md">
              {skus.slice(0, 8).join(', ')}
              {skus.length > 8 ? '…' : ''}
            </span>
            <button type="button" onClick={limparSkus} className="ml-auto flex items-center gap-1 text-red-600 hover:underline">
              <Trash size={14} /> limpar
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={buscar}
            disabled={!pronto || buscando}
            className="flex items-center gap-2 rounded-lg bg-[#000638] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a2060] disabled:opacity-40"
          >
            {buscando ? <Spinner size={16} className="animate-spin" /> : <MagnifyingGlass size={16} />}
            {buscando ? 'Consultando o TOTVS…' : 'Buscar preços no TOTVS'}
          </button>
          {!pronto && (
            <span className="text-xs text-gray-400">
              {!empresa
                ? 'escolha a empresa'
                : !promocao
                  ? 'escolha a promoção'
                  : !skus.length
                    ? 'importe os SKUs'
                    : 'informe um percentual entre 0 e 99,99'}
            </span>
          )}
        </div>
      </div>

      {/* ── 4. Prévia ── */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[#000638]">
              <Tag size={18} className="text-rose-600" /> 4. Conferência e gravação
            </h2>
            <button type="button" onClick={exportar} className="flex items-center gap-1 text-xs text-rose-700 hover:underline">
              <Download size={14} /> exportar resultado
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
            {[
              { k: 'SKUs', v: resumo?.total ?? rows.length, c: 'text-[#000638]' },
              { k: 'Encontrados', v: resumo?.ok ?? 0, c: 'text-emerald-700' },
              { k: 'Já na promoção', v: resumo?.jaNaPromocao ?? 0, c: 'text-blue-700' },
              { k: 'Novos', v: (resumo?.ok ?? 0) - (resumo?.jaNaPromocao ?? 0), c: 'text-emerald-700' },
              { k: 'Não encontrados', v: resumo?.naoEncontrados ?? 0, c: 'text-red-700' },
              { k: 'Sem preço', v: resumo?.semPreco ?? 0, c: 'text-amber-700' },
            ].map((t) => (
              <div key={t.k} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">{t.k}</div>
                <div className={`text-xl font-bold ${t.c}`}>{t.v}</div>
              </div>
            ))}
          </div>

          {resultado && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                resultado.erros.length ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {resultado.erros.length ? <WarningCircle size={18} /> : <CheckCircle size={18} />}
                Gravação concluída: {resultado.atualizados.length} atualizados, {resultado.inseridos.length} inseridos
                {resultado.ignorados.length ? `, ${resultado.ignorados.length} ignorados (fora da promoção)` : ''}
                {resultado.erros.length ? `, ${resultado.erros.length} com erro` : ''}
              </div>
              {resultado.erros.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {resultado.erros.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      <strong>{e.productCode}</strong>: {e.erro}
                    </li>
                  ))}
                  {resultado.erros.length > 20 && <li>… e mais {resultado.erros.length - 20}</li>}
                </ul>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">
                    <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} />
                  </th>
                  <th className="px-2 py-2 text-left">SKU</th>
                  <th className="px-2 py-2 text-left">Cód.</th>
                  <th className="px-2 py-2 text-left">Produto</th>
                  <th className="px-2 py-2 text-right">Preço atual</th>
                  <th className="px-2 py-2 text-right">Promo atual</th>
                  <th className="px-2 py-2 text-right">Novo valor</th>
                  <th className="px-2 py-2 text-right">% efetivo</th>
                  <th className="px-2 py-2 text-left">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => {
                  const sit = situacaoDe(r);
                  const ok = r.status === 'ok';
                  const novo = ok ? Number(valores[r.productCode]) : null;
                  const pctEf = ok && r.price > 0 && Number.isFinite(novo) ? (1 - novo / r.price) * 100 : null;
                  const errItem = resultado?.errosPorCodigo?.[r.productCode];
                  return (
                    <tr key={`${r.sku}-${i}`} className={ok ? '' : 'bg-gray-50/60 text-gray-500'}>
                      <td className="px-2 py-1.5">
                        {ok && (
                          <input
                            type="checkbox"
                            checked={!!selecionados[r.productCode]}
                            onChange={(e) => setSelecionados((s) => ({ ...s, [r.productCode]: e.target.checked }))}
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{r.sku}</td>
                      <td className="px-2 py-1.5 font-mono">{r.productCode ?? '—'}</td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium text-gray-800">{r.productName || r.erro || '—'}</div>
                        {ok && (
                          <div className="text-[11px] text-gray-400">
                            {[r.referenceCode, r.colorName, r.sizeName].filter(Boolean).join(' · ')}
                            {r.promocaoAtual && r.promocaoAtual.code !== Number(promocao)
                              ? ` · em outra promoção: ${r.promocaoAtual.code} ${r.promocaoAtual.description || ''}`
                              : ''}
                          </div>
                        )}
                        {errItem && <div className="text-[11px] text-red-600">{errItem.erro}</div>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtBRL(r.price)}
                        {r.priceName && <div className="text-[10px] text-gray-400">{r.priceName}</div>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.naPromocao ? fmtBRL(r.valorPromocaoAtual) : '—'}</td>
                      <td className="px-2 py-1.5 text-right">
                        {ok ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={Number.isFinite(novo) ? novo : ''}
                            onChange={(e) => setValores((v) => ({ ...v, [r.productCode]: e.target.value }))}
                            onBlur={(e) => setValores((v) => ({ ...v, [r.productCode]: round2(e.target.value) }))}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-right font-semibold text-[#000638] tabular-nums"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {pctEf != null ? `${pctEf.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${SITUACAO[sit]?.cls || ''}`}>
                          {SITUACAO[sit]?.label || sit}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              disabled={!itensParaGravar.length || aplicando}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
            >
              {aplicando ? <Spinner size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {aplicando ? 'Gravando no TOTVS…' : `Aplicar no TOTVS (${itensParaGravar.length})`}
            </button>
            <span className="text-xs text-gray-500">
              {qtdAtualizar} atualizar · {qtdInserir} inserir
              {!incluirNovos && rows.some((r) => r.status === 'ok' && !r.naPromocao)
                ? ` · ${rows.filter((r) => r.status === 'ok' && !r.naPromocao).length} fora da promoção serão ignorados`
                : ''}
            </span>
          </div>
        </div>
      )}

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[#000638] mb-2">Confirmar gravação no TOTVS</h3>
            <p className="text-sm text-gray-700">
              Empresa <strong>{empresa}</strong>, promoção <strong>{promocao} — {promoSelecionada?.description}</strong>.
            </p>
            <ul className="mt-2 text-sm text-gray-700 list-disc pl-5">
              <li>
                <strong>{qtdAtualizar}</strong> itens terão o valor promocional atualizado
              </li>
              <li>
                <strong>{qtdInserir}</strong> itens serão inseridos na promoção
              </li>
              <li>
                desconto de <strong>{percentual}%</strong> sobre o preço tipo {priceCode}
                {arredondamento !== 'exato' ? ` (${ARREDONDAMENTOS.find((a) => a.id === arredondamento)?.nome})` : ''}
              </li>
            </ul>
            <p className="mt-3 text-xs text-amber-700">Isso altera o preço de venda no PDV das lojas desta empresa assim que a promoção estiver vigente.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmar(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="button" onClick={aplicar} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700">
                Gravar no TOTVS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
