// Preço Promocional (Excel) — grava o valor promocional de uma lista de SKUs
// na promoção do TOTVS (PRDFM002) via product/v2/promotion-values/update.
//
// Fluxo: empresa + promoção + % de desconto → planilha (ou lista colada) com
// os SKUs → "Buscar no TOTVS" mostra o preço atual e o valor calculado →
// revisa (pode ajustar o valor linha a linha) → "GERAR NO TOTVS" ou
// "GERAR NO PDV CROSBY".
// TOTVS: produto que ainda não está na promoção é INSERIDO (promotion-items)
// quando a opção "incluir novos" estiver marcada.
// PDV CROSBY: não precisa de promoção do TOTVS — grava uma promoção própria
// do HeadCoach (nome, período, lojas) e o PDV Crosby aplica o valor como
// desconto ao bipar, com o selo PROMOCIONAL (/api/pdv-crosby/promocoes).
//
// Sem limite de SKUs: a planilha é dividida em lotes e enviada em loop (consulta
// de 500 em 500, gravação de 5.000 em 5.000). Lote que falha é repetido e, se
// continuar falhando, o loop segue e os itens ficam para reenviar depois.
//
// Sem planilha: "Buscar produtos por nome e tamanho" monta lotes (nome com
// qualquer termo E tamanho em qualquer um dos escolhidos) e vai somando na
// mesma promoção. A base é o erp_produtos + o relatório de produtos acabados
// do TOTVS importado em CSV (dá para atualizar pela própria tela).
//
// Backend: totvsrouter/promocaoValores.js (apigestaocrosby) em
// /api/totvs/promocao-valores/{promocoes,preview,aplicar,buscar-produtos,base-produtos}.
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
  CashRegister,
  Plus,
  X,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import useApiClient from '../hooks/useApiClient';
import { useAuth } from '../components/AuthContext';
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

const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

const LOTE_CONSULTA = 500;
const LOTE_GRAVACAO = 5000;
const POR_PAGINA = 200; // linhas desenhadas na tabela (o resto fica só em memória)
const TIMEOUT_CONSULTA = 10 * 60 * 1000;
const TIMEOUT_GRAVACAO = 60 * 60 * 1000;
const ESPERAS_LOTE_MS = [5000, 15000];

const emLotes = (lista, tamanho) => {
  const lotes = [];
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
  return lotes;
};

async function repetirLote(fn, deveParar) {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await fn();
    } catch (err) {
      if (tentativa >= ESPERAS_LOTE_MS.length || deveParar()) throw err;
      await new Promise((r) => setTimeout(r, ESPERAS_LOTE_MS[tentativa]));
    }
  }
}

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

const hojeISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Recife' });
const somarDias = (iso, dias) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const SITUACAO = {
  atualizar: { label: 'Atualizar', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  inserir: { label: 'Inserir na promoção', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ignorar: { label: 'Fora da promoção (ignorado)', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  nao_encontrado: { label: 'Não encontrado', cls: 'bg-red-50 text-red-700 border-red-200' },
  sem_preco: { label: 'Sem preço', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  falha_consulta: { label: 'Falha na consulta', cls: 'bg-red-50 text-red-700 border-red-200' },
  pronto: { label: 'Pronto', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  gravado: { label: 'Gravado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  erro: { label: 'Erro', cls: 'bg-red-100 text-red-800 border-red-300' },
};

// ─── Busca de produtos por nome / tamanho ────────────────────────────────────
const TAMANHOS = [
  { grupo: 'Infantil', itens: ['2', '4', '6', '8', '10', '12', '14', '16'] },
  { grupo: 'Adulto', itens: ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'XGG2', 'U'] },
  { grupo: 'King', itens: ['XL1', 'XL2', 'XL3', 'XL4'] },
  { grupo: 'Numeração', itens: ['28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60'] },
];
const ATALHOS_TAMANHO = [
  { nome: 'Infantis', tamanhos: ['2', '4', '6', '8', '10', '12', '14', 'P', 'PP'] },
  { nome: 'King', tamanhos: ['GG', 'XG', 'XL1', 'XL2', 'XL3'] },
];
const separarTermos = (t) =>
  String(t || '')
    .split(/[,;\n]+/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);

function BuscaProdutos({ apiMutate, codigosNaLista, ocupado, onAdicionar }) {
  const [termos, setTermos] = useState([]);
  const [termoTxt, setTermoTxt] = useState('');
  const [tamanhos, setTamanhos] = useState([]);
  const [outroTam, setOutroTam] = useState('');
  const [buscandoProd, setBuscandoProd] = useState(false);
  const [achados, setAchados] = useState(null); // { itens, filtro }
  const [erroBusca, setErroBusca] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [base, setBase] = useState(null);
  const [importandoBase, setImportandoBase] = useState(null); // texto do progresso
  const baseRef = useRef(null);

  const carregarBase = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/totvs/promocao-valores/base-produtos`, { headers: { 'x-api-key': API_KEY } });
      const j = await r.json();
      if (j.success) setBase(j.data);
    } catch {
      /* só informativo */
    }
  }, []);
  useEffect(() => {
    carregarBase();
  }, [carregarBase]);

  const incluirTermos = (txt) => {
    const novos = separarTermos(txt);
    if (novos.length) setTermos((t) => [...new Set([...t, ...novos])]);
    setTermoTxt('');
  };
  const alternarTam = (t) => setTamanhos((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  const aplicarAtalho = (lista) =>
    setTamanhos((l) => (lista.every((t) => l.includes(t)) ? l.filter((t) => !lista.includes(t)) : [...new Set([...l, ...lista])]));

  const buscarProdutos = async () => {
    const tTermos = [...new Set([...termos, ...separarTermos(termoTxt)])];
    if (termoTxt.trim()) {
      setTermos(tTermos);
      setTermoTxt('');
    }
    if (!tTermos.length && !tamanhos.length) {
      setErroBusca('Digite um termo do nome ou escolha um tamanho.');
      return;
    }
    setBuscandoProd(true);
    setErroBusca(null);
    setAviso(null);
    try {
      const j = await apiMutate('/api/totvs/promocao-valores/buscar-produtos', 'POST', { termos: tTermos, tamanhos }, {}, { timeout: TIMEOUT_CONSULTA });
      setAchados({ itens: j?.data?.itens || [], termos: tTermos, tamanhos: [...tamanhos] });
    } catch (e) {
      setErroBusca(e.message);
      setAchados(null);
    } finally {
      setBuscandoProd(false);
    }
  };

  const novos = useMemo(() => (achados ? achados.itens.filter((i) => !codigosNaLista.has(String(i.code))) : []), [achados, codigosNaLista]);

  const adicionar = () => {
    if (!achados || !novos.length) return;
    const partes = [];
    if (achados.termos.length) partes.push(achados.termos.join(' / '));
    if (achados.tamanhos.length) partes.push(`tam. ${achados.tamanhos.join(',')}`);
    onAdicionar(novos, partes.join(' · '));
    setAviso(`${fmtNum(novos.length)} produto(s) adicionados à lista. Pode fazer outra busca e somar mais um lote.`);
    setAchados(null);
  };

  // Atualiza a base com o relatório de produtos do TOTVS (CSV ; em ISO-8859-1)
  const importarBase = async (file) => {
    if (!file) return;
    try {
      const texto = new TextDecoder('iso-8859-1').decode(await file.arrayBuffer());
      const num = (v) => {
        const n = Number(String(v || '').replace(/\./g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : null;
      };
      const linhas = texto
        .split(/\r?\n/)
        .slice(1)
        .map((l) => l.split(';'))
        .filter((c) => /^\d+$/.test((c[0] || '').trim()) && (c[1] || '').trim())
        .map((c) => ({
          code: Number(c[0]),
          nome: c[1].trim(),
          unidade: c[2],
          referencia_code: c[3],
          fisico: num(c[4]),
          cor_code: c[5],
          cor_nome: c[6],
          tamanho: c[7],
        }));
      if (!linhas.length) throw new Error('Não reconheci o arquivo. Use o relatório: Produto;Descrição;Espécie;Grupo;Físico;Cd.Cor;Ds.Cor;Ds.Tamanho');
      const lotes = emLotes(linhas, 5000);
      for (let i = 0; i < lotes.length; i++) {
        setImportandoBase(`enviando ${fmtNum(i * 5000)} de ${fmtNum(linhas.length)}…`);
        await apiMutate('/api/totvs/promocao-valores/base-produtos', 'POST', { linhas: lotes[i], fonte: `${file.name} (${new Date().toLocaleDateString('pt-BR')})` }, {}, { timeout: TIMEOUT_CONSULTA });
      }
      setAviso(`Base atualizada: ${fmtNum(linhas.length)} produtos de ${file.name}.`);
      carregarBase();
    } catch (e) {
      setErroBusca(`Base não atualizada: ${e.message}`);
    } finally {
      setImportandoBase(null);
      if (baseRef.current) baseRef.current.value = '';
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#000638]">
          <MagnifyingGlass size={16} className="text-rose-600" /> …ou busque os produtos por nome e tamanho
        </p>
        <span className="text-[11px] text-gray-500">
          {base ? `Base: ${fmtNum(base.total)} produtos${base.fonte ? ` · ${base.fonte}` : ''} · ` : ''}
          <button type="button" onClick={() => baseRef.current?.click()} disabled={!!importandoBase} className="text-rose-700 hover:underline disabled:opacity-50">
            {importandoBase || 'atualizar base (CSV de produtos do TOTVS)'}
          </button>
          <input ref={baseRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => importarBase(e.target.files?.[0])} />
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-3">
        <div>
          <label className="text-xs text-gray-600 block">
            Nome contém (qualquer um destes)
            <input
              value={termoTxt}
              onChange={(e) => setTermoTxt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  if (termoTxt.trim()) incluirTermos(termoTxt);
                  else if (e.key === 'Enter') buscarProdutos();
                }
              }}
              onBlur={() => termoTxt.trim() && incluirTermos(termoTxt)}
              placeholder="Ex.: FEM, FEMININO, VESTIDO, GOLA"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
          </label>
          {termos.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {termos.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#000638] px-2 py-0.5 text-[11px] font-semibold text-white">
                  {t}
                  <button type="button" onClick={() => setTermos((l) => l.filter((x) => x !== t))} className="text-white/70 hover:text-white">
                    <X size={10} weight="bold" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="mt-1 text-[11px] text-gray-400">Separe por vírgula ou Enter. O produto entra se o nome tiver qualquer um dos termos.</p>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
            <span>Tamanhos (qualquer um destes)</span>
            {ATALHOS_TAMANHO.map((a) => {
              const ativo = a.tamanhos.every((t) => tamanhos.includes(t));
              return (
                <button
                  key={a.nome}
                  type="button"
                  onClick={() => aplicarAtalho(a.tamanhos)}
                  title={a.tamanhos.join(', ')}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ativo ? 'border-rose-600 bg-rose-600 text-white' : 'border-rose-300 text-rose-700 hover:bg-rose-50'}`}
                >
                  {a.nome}: {a.tamanhos.join(', ')}
                </button>
              );
            })}
            {tamanhos.length > 0 && (
              <button type="button" onClick={() => setTamanhos([])} className="text-[11px] text-gray-400 hover:text-red-600 hover:underline">
                limpar tamanhos
              </button>
            )}
          </div>
          <div className="mt-1.5 space-y-1">
            {TAMANHOS.map((g) => (
              <div key={g.grupo} className="flex flex-wrap items-center gap-1">
                <span className="w-20 text-[10px] uppercase tracking-wide text-gray-400">{g.grupo}</span>
                {g.itens.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => alternarTam(t)}
                    className={`min-w-[2.1rem] rounded border px-1.5 py-0.5 text-[11px] font-semibold ${tamanhos.includes(t) ? 'border-[#000638] bg-[#000638] text-white' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-1">
              <span className="w-20 text-[10px] uppercase tracking-wide text-gray-400">Outro</span>
              <input
                value={outroTam}
                onChange={(e) => setOutroTam(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && outroTam.trim()) {
                    e.preventDefault();
                    if (!tamanhos.includes(outroTam.trim())) alternarTam(outroTam.trim());
                    setOutroTam('');
                  }
                }}
                placeholder="ex.: 37/38 + Enter"
                className="w-32 rounded border border-gray-300 px-1.5 py-0.5 text-[11px] mb-0"
              />
              {tamanhos
                .filter((t) => !TAMANHOS.some((g) => g.itens.includes(t)))
                .map((t) => (
                  <button key={t} type="button" onClick={() => alternarTam(t)} className="rounded border border-[#000638] bg-[#000638] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {t} ×
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={buscarProdutos}
          disabled={buscandoProd || ocupado}
          className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
        >
          {buscandoProd ? <Spinner size={16} className="animate-spin" /> : <MagnifyingGlass size={16} />}
          {buscandoProd ? 'Buscando…' : 'Buscar produtos'}
        </button>
        <span className="text-[11px] text-gray-500">
          {termos.length && tamanhos.length ? 'nome com qualquer termo E tamanho entre os escolhidos' : termos.length ? 'qualquer tamanho' : tamanhos.length ? 'qualquer nome' : ''}
        </span>
        {erroBusca && <span className="text-xs text-red-600">{erroBusca}</span>}
        {aviso && <span className="text-xs text-emerald-700">{aviso}</span>}
      </div>

      {achados && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-3 py-2 text-xs">
            <span className="font-semibold text-[#000638]">{fmtNum(achados.itens.length)} produto(s) encontrados</span>
            {achados.itens.length - novos.length > 0 && <span className="text-gray-500">{fmtNum(achados.itens.length - novos.length)} já estão na lista</span>}
            <div className="flex-1" />
            <button type="button" onClick={() => setAchados(null)} className="text-gray-500 hover:underline">
              descartar busca
            </button>
            <button
              type="button"
              onClick={adicionar}
              disabled={!novos.length || ocupado}
              className="flex items-center gap-1.5 rounded-lg bg-[#000638] px-3 py-1.5 font-semibold text-white hover:bg-[#1a2060] disabled:opacity-40"
            >
              <Plus size={14} weight="bold" /> Adicionar {fmtNum(novos.length)} à promoção
            </button>
          </div>
          {achados.itens.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Cód.</th>
                    <th className="px-2 py-1.5 text-left">Produto</th>
                    <th className="px-2 py-1.5 text-left">Cor</th>
                    <th className="px-2 py-1.5 text-left">Tam.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {achados.itens.slice(0, 200).map((i) => (
                    <tr key={i.code} className={codigosNaLista.has(String(i.code)) ? 'text-gray-400' : ''}>
                      <td className="px-2 py-1 font-mono">{i.code}</td>
                      <td className="px-2 py-1">{i.nome}</td>
                      <td className="px-2 py-1">{i.cor_nome || '—'}</td>
                      <td className="px-2 py-1 font-semibold">{i.tamanho || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {achados.itens.length > 200 && (
                <p className="px-3 py-1.5 text-[11px] text-gray-400">mostrando 200 de {fmtNum(achados.itens.length)} — todos entram ao adicionar</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PromocaoValores() {
  const { apiMutate } = useApiClient();
  const { user } = useAuth();
  const fileRef = useRef(null);
  const pararRef = useRef(false);

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
  const [lotesBusca, setLotesBusca] = useState([]); // lotes somados pela busca por nome/tamanho
  // Lista da conferência: pesquisa por nome/SKU e remoção (o que sai não volta
  // nos próximos lotes da busca)
  const [filtroLista, setFiltroLista] = useState('');
  const [removidos, setRemovidos] = useState(() => new Set()); // códigos/SKUs tirados da lista
  const [textoSkus, setTextoSkus] = useState('');

  // ── prévia / gravação ──
  const [buscando, setBuscando] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [progresso, setProgresso] = useState(null);
  const [valores, setValores] = useState({}); // productCode → valor editado
  const [selecionados, setSelecionados] = useState({}); // productCode → bool
  const [erro, setErro] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState(null);

  // ── PDV Crosby (promoção própria do HeadCoach) ──
  const [promosPdv, setPromosPdv] = useState([]);
  const [modalPdv, setModalPdv] = useState(null); // { promoId: 'nova' | id, nome, inicio, fim, todas }
  const [gerandoPdv, setGerandoPdv] = useState(false);
  const [resultadoPdv, setResultadoPdv] = useState(null);

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

  // SKUs novos (ou empresa trocada) → consulta os preços sozinha, sem botão
  const consultaPendente = useRef(false);
  const rolarParaConferencia = useRef(false);
  const conferenciaRef = useRef(null);

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
        setLotesBusca([]);
        setRemovidos(new Set());
        consultaPendente.current = true;
        setOrigemSkus({ arquivo: file.name, coluna, aba: wb.SheetNames[0] });
        setTextoSkus('');
        setRows([]);
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
    setLotesBusca([]);
    setRemovidos(new Set());
    consultaPendente.current = true;
    setOrigemSkus({ arquivo: 'lista colada', coluna: null });
    setRows([]);
    setResultado(null);
  }, [textoSkus]);

  const limparSkus = () => {
    setSkus([]);
    setLotesBusca([]);
    setRemovidos(new Set());
    setFiltroLista('');
    setOrigemSkus(null);
    setRows([]);
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

  const calcularRef = useRef(calcular);
  calcularRef.current = calcular;

  const resumo = useMemo(() => {
    const conta = (fn) => rows.filter(fn).length;
    return {
      total: rows.length,
      ok: conta((r) => r.status === 'ok'),
      naoEncontrados: conta((r) => r.status === 'nao_encontrado'),
      semPreco: conta((r) => r.status === 'sem_preco'),
      falhas: conta((r) => r.status === 'falha_consulta'),
      jaNaPromocao: conta((r) => r.naPromocao),
    };
  }, [rows]);

  // Consulta em loop. `base` são as linhas já resolvidas ao reconsultar falhas.
  const consultar = useCallback(
    async (lista, base) => {
      if (!empresa || !lista.length) return;
      pararRef.current = false;
      setBuscando(true);
      setErro(null);
      setResultado(null);
      setPagina(1);
      const acumulado = [...base];
      const vistos = new Set(base.map((r) => r.sku));
      setRows(acumulado.slice());
      const lotes = emLotes(lista, LOTE_CONSULTA);
      const registrar = (novas) => {
        const entradas = novas.filter((r) => !vistos.has(r.sku));
        entradas.forEach((r) => vistos.add(r.sku));
        acumulado.push(...entradas);
        setRows(acumulado.slice());
        const validas = entradas.filter((r) => r.status === 'ok');
        setSelecionados((prev) => {
          const next = { ...prev };
          for (const r of validas) next[r.productCode] = true;
          return next;
        });
        setValores((prev) => {
          const next = { ...prev };
          for (const r of validas) next[r.productCode] = calcularRef.current(r.price);
          return next;
        });
      };
      const comFalha = (skusLote, msg) =>
        skusLote.map((sku) => ({ sku, productCode: null, status: 'falha_consulta', erro: msg }));

      for (let i = 0; i < lotes.length; i++) {
        if (pararRef.current) {
          registrar(comFalha(lotes.slice(i).flat(), 'Consulta interrompida'));
          break;
        }
        setProgresso({
          acao: 'Consultando o TOTVS',
          feito: i * LOTE_CONSULTA,
          total: lista.length,
          lote: i + 1,
          lotes: lotes.length,
        });
        try {
          const j = await repetirLote(
            () =>
              apiMutate(
                '/api/totvs/promocao-valores/preview',
                'POST',
                {
                  branch: Number(empresa),
                  promotionCode: promocao ? Number(promocao) : undefined,
                  priceCode: Number(priceCode) || 1,
                  skus: lotes[i],
                  primeiroLote: i === 0,
                },
                {},
                { timeout: TIMEOUT_CONSULTA },
              ),
            () => pararRef.current,
          );
          registrar(j?.data?.rows || []);
        } catch (e) {
          registrar(comFalha(lotes[i], e.message));
        }
      }
      setProgresso(null);
      setBuscando(false);
    },
    [empresa, promocao, priceCode, apiMutate],
  );

  const buscar = useCallback(() => {
    setSelecionados({});
    setValores({});
    return consultar([...new Set(skus)], []);
  }, [consultar, skus]);

  const reconsultarFalhas = useCallback(
    () =>
      consultar(
        rows.filter((r) => r.status === 'falha_consulta').map((r) => r.sku),
        rows.filter((r) => r.status !== 'falha_consulta'),
      ),
    [consultar, rows],
  );

  // Lote da busca por nome/tamanho: soma na lista e consulta só os novos
  // (a promoção vai acumulando lotes). Sem empresa ainda, consulta tudo depois.
  const codigosNaLista = useMemo(() => new Set(skus.map(String)), [skus]);
  const adicionarLote = useCallback(
    (itensLote, descricao) => {
      const novos = itensLote.map((i) => String(i.code)).filter((c) => !codigosNaLista.has(c) && !removidos.has(c));
      if (!novos.length) return;
      setSkus((prev) => [...prev, ...novos]);
      setLotesBusca((l) => [...l, { descricao, qtd: novos.length }]);
      setOrigemSkus({ arquivo: 'busca por nome e tamanho', coluna: null });
      setResultado(null);
      rolarParaConferencia.current = true;
      if (empresa && rows.length) consultar(novos, rows);
      else consultaPendente.current = true;
    },
    [codigosNaLista, removidos, empresa, rows, consultar],
  );

  // % ou arredondamento novo recalcula tudo; sem depender de `rows`, a edição
  // manual de uma linha não é apagada quando os lotes atualizam a tabela.
  useEffect(() => {
    setValores((prev) => {
      const next = { ...prev };
      for (const r of rows) if (r.status === 'ok') next[r.productCode] = calcular(r.price);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percentual, arredondamento]);

  // Fechar a aba no meio do loop deixaria os lotes seguintes sem enviar.
  const emAndamento = buscando || aplicando;
  useEffect(() => {
    if (!emAndamento) return undefined;
    const avisar = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [emAndamento]);

  const situacaoDe = (r) => {
    if (resultado) {
      if (resultado.gravados.has(r.productCode)) return 'gravado';
      if (resultado.errosPorCodigo[r.productCode]) return 'erro';
    }
    if (r.status !== 'ok') return r.status;
    if (!promocao) return 'pronto';
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

  // Itens selecionados que ainda não foram gravados (falha, ou loop interrompido)
  const pendentes = useMemo(
    () => itensParaGravar.filter((i) => !resultado?.gravados.has(i.productCode)),
    [itensParaGravar, resultado],
  );

  // Gravação em loop, de 5.000 em 5.000. Com `somentePendentes` mantém o que já
  // foi gravado e envia só o restante.
  const aplicar = useCallback(
    async (somentePendentes = false) => {
      setConfirmar(false);
      const lista = somentePendentes ? pendentes : itensParaGravar;
      if (!lista.length) return;
      pararRef.current = false;
      setAplicando(true);
      setErro(null);
      const acc = {
        atualizados: somentePendentes ? [...(resultado?.atualizados || [])] : [],
        inseridos: somentePendentes ? [...(resultado?.inseridos || [])] : [],
        ignorados: [],
        erros: [],
        naoEnviados: 0,
      };
      const publicar = () => {
        const errosPorCodigo = {};
        for (const e of acc.erros) errosPorCodigo[e.productCode] = e;
        setResultado({
          ...acc,
          atualizados: [...acc.atualizados],
          inseridos: [...acc.inseridos],
          ignorados: [...acc.ignorados],
          erros: [...acc.erros],
          gravados: new Set([...acc.atualizados, ...acc.inseridos]),
          errosPorCodigo,
        });
      };
      const lotes = emLotes(lista, LOTE_GRAVACAO);
      for (let i = 0; i < lotes.length; i++) {
        if (pararRef.current) {
          acc.naoEnviados = lotes.slice(i).flat().length;
          break;
        }
        setProgresso({
          acao: 'Gravando no TOTVS',
          feito: i * LOTE_GRAVACAO,
          total: lista.length,
          lote: i + 1,
          lotes: lotes.length,
        });
        try {
          const j = await repetirLote(
            () =>
              apiMutate(
                '/api/totvs/promocao-valores/aplicar',
                'POST',
                {
                  branch: Number(empresa),
                  promotionCode: Number(promocao),
                  items: lotes[i],
                  incluirNovos,
                  primeiroLote: i === 0,
                },
                {},
                { timeout: TIMEOUT_GRAVACAO },
              ),
            () => pararRef.current,
          );
          const d = j?.data || {};
          acc.atualizados.push(...(d.atualizados || []));
          acc.inseridos.push(...(d.inseridos || []));
          acc.ignorados.push(...(d.ignorados || []));
          acc.erros.push(...(d.erros || []));
        } catch (e) {
          acc.erros.push(
            ...lotes[i].map((it) => ({
              productCode: it.productCode,
              erro: `Lote ${i + 1} não gravado: ${e.message}`,
            })),
          );
        }
        publicar();
      }
      publicar();
      // Marca como existentes: uma nova aplicação vira update
      const gravados = new Set([...acc.atualizados, ...acc.inseridos]);
      setRows((prev) =>
        prev.map((r) =>
          gravados.has(r.productCode)
            ? { ...r, naPromocao: true, valorPromocaoAtual: round2(valores[r.productCode]) }
            : r,
        ),
      );
      setProgresso(null);
      setAplicando(false);
    },
    [pendentes, itensParaGravar, resultado, empresa, promocao, incluirNovos, apiMutate, valores],
  );

  // ── GERAR NO PDV CROSBY ──
  const itensPdv = useMemo(
    () =>
      rows
        .filter((r) => r.status === 'ok' && selecionados[r.productCode])
        .map((r) => ({
          productCode: r.productCode,
          sku: r.productSku || r.sku,
          nome: r.productName || null,
          precoBase: r.price,
          precoPromocional: round2(valores[r.productCode]),
        }))
        .filter((i) => Number.isFinite(i.precoPromocional) && i.precoPromocional > 0),
    [rows, selecionados, valores],
  );

  const carregarPromosPdv = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/promocoes`, { headers: { 'x-api-key': API_KEY } });
      const j = await r.json();
      if (j.success) setPromosPdv(j.data?.items || []);
    } catch {
      /* lista é só apoio */
    }
  }, []);
  useEffect(() => {
    carregarPromosPdv();
  }, [carregarPromosPdv]);

  const abrirModalPdv = () => {
    const hoje = hojeISO();
    setModalPdv({
      promoId: 'nova',
      nome: `${String(percentual).replace('.', ',')}% OFF`,
      inicio: hoje,
      fim: somarDias(hoje, 30),
      todas: false,
    });
  };

  const gerarNoPdv = useCallback(async () => {
    const m = modalPdv;
    if (!m || !itensPdv.length) return;
    setGerandoPdv(true);
    setErro(null);
    pararRef.current = false;
    const acc = { gravados: 0, recusados: [], erros: [] };
    try {
      let promo = promosPdv.find((p) => String(p.id) === String(m.promoId)) || null;
      if (m.promoId === 'nova') {
        const j = await apiMutate('/api/pdv-crosby/promocoes', 'POST', {
          nome: m.nome,
          inicio: m.inicio,
          fim: m.fim,
          empresas: m.todas ? null : [Number(empresa)],
          descontoPct: Number(percentual),
          criadoPor: user?.email || user?.name || null,
        });
        promo = j?.data;
        if (!promo?.id) throw new Error(j?.message || 'Não consegui criar a promoção');
      }
      setModalPdv(null);
      const lotes = emLotes(itensPdv, LOTE_GRAVACAO);
      for (let i = 0; i < lotes.length; i++) {
        if (pararRef.current) {
          acc.erros.push(`${fmtNum(lotes.slice(i).flat().length)} itens não enviados (interrompido)`);
          break;
        }
        setProgresso({ acao: 'Gravando no PDV Crosby', feito: i * LOTE_GRAVACAO, total: itensPdv.length, lote: i + 1, lotes: lotes.length });
        try {
          const j = await repetirLote(
            () => apiMutate(`/api/pdv-crosby/promocoes/${promo.id}/itens`, 'POST', { items: lotes[i] }, {}, { timeout: TIMEOUT_GRAVACAO }),
            () => pararRef.current,
          );
          acc.gravados += j?.data?.gravados?.length || 0;
          acc.recusados.push(...(j?.data?.recusados || []));
        } catch (e) {
          acc.erros.push(`Lote ${i + 1} não gravado: ${e.message}`);
        }
        setResultadoPdv({ promo, ...acc });
      }
      setResultadoPdv({ promo, ...acc });
      carregarPromosPdv();
    } catch (e) {
      setErro(`PDV Crosby: ${e.message}`);
    } finally {
      setProgresso(null);
      setGerandoPdv(false);
    }
  }, [modalPdv, itensPdv, promosPdv, apiMutate, empresa, percentual, user, carregarPromosPdv]);

  const alternarPromoPdv = async (p) => {
    try {
      await apiMutate(`/api/pdv-crosby/promocoes/${p.id}`, 'PUT', { ativa: !p.ativa });
      carregarPromosPdv();
    } catch (e) {
      setErro(`PDV Crosby: ${e.message}`);
    }
  };

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
    XLSX.writeFile(wb, `preco-promocional-${empresa}-${promocao || 'pdv'}.xlsx`);
  };

  const todosSelecionados = rows.filter((r) => r.status === 'ok').every((r) => selecionados[r.productCode]);
  const toggleTodos = () => {
    const sel = {};
    for (const r of rows) if (r.status === 'ok') sel[r.productCode] = !todosSelecionados;
    setSelecionados(sel);
  };

  const pronto = empresa && skus.length > 0 && pctValido && !emAndamento && !gerandoPdv;

  // Preço é por empresa: trocou a empresa com SKUs carregados, consulta de novo
  const empresaConsultada = useRef(empresa);
  useEffect(() => {
    if (empresaConsultada.current === empresa) return;
    empresaConsultada.current = empresa;
    if (skus.length) consultaPendente.current = true;
  }, [empresa, skus.length]);

  useEffect(() => {
    if (!consultaPendente.current || !pronto || buscando) return;
    consultaPendente.current = false;
    rolarParaConferencia.current = true;
    buscar();
  }, [pronto, buscando, buscar]);

  // Leva a tela para a conferência assim que as primeiras linhas chegam
  useEffect(() => {
    if (!rolarParaConferencia.current || !rows.length || !conferenciaRef.current) return;
    rolarParaConferencia.current = false;
    conferenciaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [rows.length]);

  // Pesquisa na lista: vários termos separados por vírgula (qualquer um)
  const termosLista = useMemo(
    () =>
      filtroLista
        .split(/[,;]+/)
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    [filtroLista],
  );
  const rowsFiltradas = useMemo(() => {
    if (!termosLista.length) return rows;
    return rows.filter((r) => {
      const nome = String(r.productName || '').toUpperCase();
      return termosLista.some((t) => nome.includes(t) || String(r.sku).toUpperCase() === t || String(r.productCode) === t);
    });
  }, [rows, termosLista]);

  const chaveSku = (v) => String(v ?? '').trim().toUpperCase();
  const removerDaLista = (lista) => {
    if (!lista.length) return;
    const tirar = new Set();
    for (const r of lista) {
      tirar.add(chaveSku(r.sku));
      if (r.productCode != null) tirar.add(String(r.productCode));
    }
    setRows((prev) => prev.filter((r) => !tirar.has(chaveSku(r.sku))));
    setSkus((prev) => prev.filter((x) => !tirar.has(chaveSku(x))));
    const limpar = (obj) => {
      const next = { ...obj };
      for (const r of lista) delete next[r.productCode];
      return next;
    };
    setSelecionados(limpar);
    setValores(limpar);
    setRemovidos((prev) => new Set([...prev, ...tirar]));
    setResultado(null);
  };
  // Itens que já estão na promoção do TOTVS: carrega todos na conferência com o
  // valor atual (nada marcado para gravar). A API não exclui item de promoção;
  // para tirar o desconto, "Zerar" grava o valor = preço cheio (0%).
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [origemItens, setOrigemItens] = useState(null); // { fonte, lidoEm }
  // refresh: relê a promoção no TOTVS (lento) e atualiza a cópia do banco
  const carregarItensPromocao = async (refresh = false) => {
    if (!empresa || !promocao) return;
    if (rows.length && !refresh && !window.confirm('Trocar a lista atual pelos itens da promoção?')) return;
    setCarregandoItens(true);
    setErro(null);
    try {
      const url = new URL('/api/totvs/promocao-valores/itens', API_BASE_URL);
      url.searchParams.set('branch', empresa);
      url.searchParams.set('promotionCode', promocao);
      url.searchParams.set('priceCode', Number(priceCode) || 1);
      if (refresh) url.searchParams.set('refresh', '1');
      const r = await fetch(url.toString(), { headers: { 'x-api-key': API_KEY } });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao ler os itens da promoção');
      const lista = j.data?.rows || [];
      setOrigemItens({ fonte: j.data?.fonte || null, lidoEm: j.data?.lidoEm || null });
      consultaPendente.current = false;
      setSkus(lista.map((x) => x.sku));
      setRows(lista);
      setLotesBusca([]);
      setRemovidos(new Set());
      setFiltroLista('');
      setOrigemSkus({ arquivo: `promoção ${promocao} do TOTVS`, coluna: null });
      setResultado(null);
      setSelecionados({});
      setValores(Object.fromEntries(lista.filter((x) => x.status === 'ok').map((x) => [x.productCode, round2(x.valorPromocaoAtual ?? x.price)])));
      setPagina(1);
      rolarParaConferencia.current = true;
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregandoItens(false);
    }
  };

  // Zera o desconto (valor = preço cheio) dos exibidos e marca só eles para gravar
  const zerarFiltrados = () => {
    const alvo = rowsFiltradas.filter((r) => r.status === 'ok' && r.price > 0);
    if (!alvo.length) return;
    if (!window.confirm(`Zerar o desconto (0%) de ${fmtNum(alvo.length)} produto(s)? Só eles ficam marcados para gravar.`)) return;
    setValores((v) => ({ ...v, ...Object.fromEntries(alvo.map((r) => [r.productCode, round2(r.price)])) }));
    setSelecionados(Object.fromEntries(alvo.map((r) => [r.productCode, true])));
  };

  const removerFiltrados = () => {
    if (!rowsFiltradas.length) return;
    if (!window.confirm(`Remover ${fmtNum(rowsFiltradas.length)} produto(s) com "${termosLista.join(', ')}" da lista desta promoção?`)) return;
    removerDaLista(rowsFiltradas);
    setFiltroLista('');
  };

  const totalPaginas = Math.max(1, Math.ceil(rowsFiltradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const linhasPagina = rowsFiltradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const barraProgresso = progresso && (
    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {progresso.acao}: lote {fmtNum(progresso.lote)} de {fmtNum(progresso.lotes)} (
          {fmtNum(progresso.feito)} de {fmtNum(progresso.total)} concluídos)
        </span>
        <button
          type="button"
          onClick={() => {
            pararRef.current = true;
          }}
          className="rounded border border-rose-300 px-2 py-0.5 text-rose-700 hover:bg-rose-100"
        >
          Parar após este lote
        </button>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-rose-100">
        <div
          className="h-full bg-rose-600 transition-all"
          style={{ width: `${Math.round((progresso.feito / progresso.total) * 100)}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      <PageTitle
        title="Preço Promocional (Excel)"
        subtitle="Importe a planilha com os SKUs e o percentual de desconto. O valor promocional é calculado sobre o preço atual e gerado na promoção do TOTVS (PRDFM002) ou numa promoção própria do PDV Crosby."
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
                <span>Promoção do TOTVS <span className="text-gray-400">(só para GERAR NO TOTVS)</span></span>
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
                        ? 'Selecione… (deixe vazio para gerar só no PDV Crosby)'
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
                  lista do banco (lida do TOTVS em {new Date(promoCache).toLocaleString('pt-BR')}) — clique no ícone para recarregar
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
              <button
                type="button"
                onClick={() => carregarItensPromocao(false)}
                disabled={carregandoItens || emAndamento}
                className="ml-auto flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                title="Mostra todos os produtos da promoção (do banco; na primeira vez lê o TOTVS)"
              >
                {carregandoItens ? <Spinner size={13} className="animate-spin" /> : <MagnifyingGlass size={13} />}
                {carregandoItens ? 'Carregando os itens…' : `Ver os ${promoSelecionada.itens} itens desta promoção`}
              </button>
              <button
                type="button"
                onClick={() => carregarItensPromocao(true)}
                disabled={carregandoItens || emAndamento}
                className="flex items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                title="Relê a promoção no TOTVS (lento) e atualiza o banco — use se alguém mexeu direto no PRDFM002"
              >
                <ArrowsClockwise size={13} /> atualizar do TOTVS
              </button>
              {origemItens?.lidoEm && (
                <span className="w-full text-[11px] text-rose-700/80">
                  Itens {origemItens.fonte === 'totvs' ? 'lidos agora do TOTVS' : 'do banco'} · última leitura do TOTVS em{' '}
                  {new Date(origemItens.lidoEm).toLocaleString('pt-BR')} (gravações feitas por esta tela já entram no banco)
                </span>
              )}
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
            <FileXls size={18} className="text-rose-600" /> 3. SKUs (planilha, lista ou busca)
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
            {lotesBusca.length > 0 && (
              <div className="w-full flex flex-wrap gap-1">
                {lotesBusca.map((l, i) => (
                  <span key={i} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-200">
                    lote {i + 1}: {l.descricao} · <b>{fmtNum(l.qtd)}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <BuscaProdutos apiMutate={apiMutate} codigosNaLista={codigosNaLista} ocupado={buscando || aplicando || gerandoPdv} onAdicionar={adicionarLote} />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={buscar}
            disabled={!pronto || buscando}
            className="flex items-center gap-2 rounded-lg bg-[#000638] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a2060] disabled:opacity-40"
          >
            {buscando ? <Spinner size={16} className="animate-spin" /> : <MagnifyingGlass size={16} />}
            {buscando ? 'Consultando o TOTVS…' : rows.length ? 'Consultar os preços de novo' : 'Buscar preços no TOTVS'}
          </button>
          {!pronto && !emAndamento && (
            <span className="text-xs text-gray-400">
              {!empresa
                ? skus.length
                  ? 'escolha a empresa — os preços carregam sozinhos'
                  : 'escolha a empresa'
                : !skus.length
                  ? 'importe os SKUs — os preços carregam sozinhos'
                  : 'informe um percentual entre 0 e 99,99'}
            </span>
          )}
        </div>
        {buscando && barraProgresso}
      </div>

      {/* ── 4. Prévia ── */}
      {rows.length > 0 && (
        <div ref={conferenciaRef} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm scroll-mt-4">
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

          {resumo.falhas > 0 && !buscando && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <WarningCircle size={18} />
              <span>{fmtNum(resumo.falhas)} SKUs não foram consultados.</span>
              <button
                type="button"
                onClick={reconsultarFalhas}
                disabled={emAndamento}
                className="rounded border border-red-300 px-2 py-1 text-xs hover:bg-red-100 disabled:opacity-40"
              >
                Consultar de novo ({fmtNum(resumo.falhas)})
              </button>
            </div>
          )}

          {resultado && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                resultado.erros.length || resultado.naoEnviados
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {resultado.erros.length || resultado.naoEnviados ? <WarningCircle size={18} /> : <CheckCircle size={18} />}
                {aplicando ? 'Gravação em andamento' : 'Gravação concluída'}: {resultado.atualizados.length} atualizados, {resultado.inseridos.length} inseridos
                {resultado.ignorados.length ? `, ${resultado.ignorados.length} ignorados (fora da promoção)` : ''}
                {resultado.erros.length ? `, ${resultado.erros.length} com erro` : ''}
                {resultado.naoEnviados ? `, ${resultado.naoEnviados} não enviados (interrompido)` : ''}
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

          {resultadoPdv && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                resultadoPdv.erros.length || resultadoPdv.recusados.length
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <CashRegister size={18} />
                {gerandoPdv ? 'Gravando no PDV Crosby' : 'PDV Crosby'}: {fmtNum(resultadoPdv.gravados)} itens na promoção "
                {resultadoPdv.promo?.nome}" ({fmtData(resultadoPdv.promo?.inicio)} a {fmtData(resultadoPdv.promo?.fim)})
                {resultadoPdv.recusados.length ? `, ${resultadoPdv.recusados.length} recusados` : ''}
              </div>
              {resultadoPdv.erros.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {resultadoPdv.erros.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              {!gerandoPdv && !resultadoPdv.erros.length && (
                <p className="mt-1 text-xs">Ao bipar esses produtos no PDV Crosby, eles já entram com o desconto e o selo PROMOCIONAL.</p>
              )}
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="relative">
              <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={filtroLista}
                onChange={(e) => {
                  setFiltroLista(e.target.value);
                  setPagina(1);
                }}
                placeholder="Pesquisar na lista: nome, SKU ou código (ex.: PIMA)"
                className="w-80 rounded-lg border border-gray-300 py-1.5 pl-8 pr-7 text-xs mb-0 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
              {filtroLista && (
                <button type="button" onClick={() => setFiltroLista('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} weight="bold" />
                </button>
              )}
            </div>
            {termosLista.length > 0 && (
              <>
                <span className="text-xs text-gray-600">
                  <b>{fmtNum(rowsFiltradas.length)}</b> de {fmtNum(rows.length)} na lista
                </span>
                <button
                  type="button"
                  onClick={removerFiltrados}
                  disabled={!rowsFiltradas.length || emAndamento || gerandoPdv}
                  className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                >
                  <Trash size={13} /> Remover os {fmtNum(rowsFiltradas.length)} da lista
                </button>
              </>
            )}
            {promocao && rows.some((r) => r.naPromocao) && (
              <button
                type="button"
                onClick={zerarFiltrados}
                disabled={!rowsFiltradas.length || emAndamento || gerandoPdv}
                title="A API do TOTVS não tira item de promoção: grava o valor promocional igual ao preço cheio"
                className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40"
              >
                <Percent size={13} /> Zerar desconto (0%) {termosLista.length ? `dos ${fmtNum(rowsFiltradas.length)} filtrados` : 'de todos'}
              </button>
            )}
            {removidos.size > 0 && (
              <span className="ml-auto text-[11px] text-gray-500">
                {fmtNum(removidos.size)} código(s) removidos — não voltam nas próximas buscas ·{' '}
                <button type="button" onClick={() => setRemovidos(new Set())} className="text-rose-700 hover:underline" title="Deixa os removidos voltarem nas próximas buscas">
                  liberar
                </button>
              </span>
            )}
          </div>

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
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {termosLista.length > 0 && rowsFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-2 py-6 text-center text-gray-400">
                      Nenhum produto da lista com "{termosLista.join(', ')}".
                    </td>
                  </tr>
                )}
                {linhasPagina.map((r, i) => {
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
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removerDaLista([r])}
                          disabled={emAndamento || gerandoPdv}
                          className="text-gray-300 hover:text-red-600 disabled:opacity-40"
                          title="Tirar da lista desta promoção"
                        >
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-xs text-gray-600">
              <button
                type="button"
                onClick={() => setPagina(Math.max(1, paginaAtual - 1))}
                disabled={paginaAtual === 1}
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <span>
                Página {fmtNum(paginaAtual)} de {fmtNum(totalPaginas)} ({fmtNum(rowsFiltradas.length)} SKUs{termosLista.length ? ' filtrados' : ''})
              </span>
              <button
                type="button"
                onClick={() => setPagina(Math.min(totalPaginas, paginaAtual + 1))}
                disabled={paginaAtual === totalPaginas}
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}

          {(aplicando || gerandoPdv) && barraProgresso}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              disabled={!promocao || !itensParaGravar.length || emAndamento || gerandoPdv}
              title={!promocao ? 'Escolha a promoção do TOTVS no passo 1' : undefined}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
            >
              {aplicando ? <Spinner size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {aplicando ? 'Gravando no TOTVS…' : `GERAR NO TOTVS (${fmtNum(promocao ? itensParaGravar.length : 0)})`}
            </button>
            <button
              type="button"
              onClick={abrirModalPdv}
              disabled={!itensPdv.length || emAndamento || gerandoPdv}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {gerandoPdv ? <Spinner size={16} className="animate-spin" /> : <CashRegister size={16} />}
              {gerandoPdv ? 'Gravando no PDV Crosby…' : `GERAR NO PDV CROSBY (${fmtNum(itensPdv.length)})`}
            </button>
            {resultado && !emAndamento && pendentes.length > 0 && (
              <button
                type="button"
                onClick={() => aplicar(true)}
                className="flex items-center gap-2 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                <ArrowsClockwise size={16} /> Enviar pendentes ({fmtNum(pendentes.length)})
              </button>
            )}
            <span className="text-xs text-gray-500">
              {!promocao && 'TOTVS: escolha a promoção no passo 1 · '}
              {qtdAtualizar} atualizar · {qtdInserir} inserir
              {!incluirNovos && rows.some((r) => r.status === 'ok' && !r.naPromocao)
                ? ` · ${rows.filter((r) => r.status === 'ok' && !r.naPromocao).length} fora da promoção serão ignorados`
                : ''}
            </span>
          </div>
        </div>
      )}

      {/* ── Promoções do PDV Crosby ── */}
      {promosPdv.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#000638] mb-3">
            <CashRegister size={18} className="text-emerald-600" /> Promoções do PDV Crosby
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">Promoção</th>
                  <th className="px-2 py-2 text-left">Lojas</th>
                  <th className="px-2 py-2 text-left">Período</th>
                  <th className="px-2 py-2 text-right">Itens</th>
                  <th className="px-2 py-2 text-left">Situação</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {promosPdv.map((p) => (
                  <tr key={p.id}>
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-gray-800">{p.nome}</div>
                      <div className="text-[11px] text-gray-400">
                        nº {p.id}
                        {p.criado_por ? ` · ${p.criado_por}` : ''}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">{p.empresas?.length ? p.empresas.join(', ') : 'Todas'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {fmtData(p.inicio)} a {fmtData(p.fim)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(p.qtdItens)}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${
                          p.vigente
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : p.ativa
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {p.vigente ? 'Vigente' : p.ativa ? (p.inicio > hojeISO() ? 'Agendada' : 'Vencida') : 'Encerrada'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => alternarPromoPdv(p)}
                        className={`text-xs hover:underline ${p.ativa ? 'text-red-600' : 'text-emerald-700'}`}
                      >
                        {p.ativa ? 'Encerrar' : 'Reativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalPdv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#000638] mb-1">
              <CashRegister size={20} className="text-emerald-600" /> Gerar no PDV Crosby
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              {fmtNum(itensPdv.length)} produtos. Não altera o TOTVS: o PDV Crosby aplica o valor promocional como desconto ao bipar,
              com o selo PROMOCIONAL.
            </p>
            <label className="text-xs text-gray-600 block">
              Promoção
              <select
                value={modalPdv.promoId}
                onChange={(e) => setModalPdv((m) => ({ ...m, promoId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="nova">+ Nova promoção</option>
                {promosPdv
                  .filter((p) => p.ativa && p.fim >= hojeISO())
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      Adicionar em: {p.nome} ({fmtData(p.inicio)} a {fmtData(p.fim)}) · {fmtNum(p.qtdItens)} itens
                    </option>
                  ))}
              </select>
            </label>
            {modalPdv.promoId === 'nova' && (
              <div className="mt-3 space-y-3">
                <label className="text-xs text-gray-600 block">
                  Nome
                  <input
                    value={modalPdv.nome}
                    onChange={(e) => setModalPdv((m) => ({ ...m, nome: e.target.value }))}
                    maxLength={120}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-600 block">
                    Início
                    <input
                      type="date"
                      value={modalPdv.inicio}
                      onChange={(e) => setModalPdv((m) => ({ ...m, inicio: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs text-gray-600 block">
                    Fim
                    <input
                      type="date"
                      value={modalPdv.fim}
                      min={modalPdv.inicio}
                      onChange={(e) => setModalPdv((m) => ({ ...m, fim: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <div className="text-xs text-gray-600">
                  Vale para
                  <div className="mt-1 flex flex-col gap-1">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={!modalPdv.todas} onChange={() => setModalPdv((m) => ({ ...m, todas: false }))} className="w-4 h-4 shrink-0 mb-0 p-0 accent-emerald-600" />
                      só a empresa {empresa} — {empresas.find((e) => String(e.codigo) === String(empresa))?.nome || ''}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={modalPdv.todas} onChange={() => setModalPdv((m) => ({ ...m, todas: true }))} className="w-4 h-4 shrink-0 mb-0 p-0 accent-emerald-600" />
                      todas as lojas
                    </label>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setModalPdv(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={gerarNoPdv}
                disabled={
                  modalPdv.promoId === 'nova' &&
                  (!modalPdv.nome.trim() || !modalPdv.inicio || !modalPdv.fim || modalPdv.fim < modalPdv.inicio)
                }
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Gerar no PDV Crosby
              </button>
            </div>
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
                envio em <strong>{Math.ceil(itensParaGravar.length / LOTE_GRAVACAO)}</strong> lote(s) de até{' '}
                {fmtNum(LOTE_GRAVACAO)} itens
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
              <button type="button" onClick={() => aplicar(false)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700">
                Gravar no TOTVS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
