// Parser da planilha de BONIFICAÇÕES (geral / marketing) — puro, sem React.
//
// As bonificações não existem no TOTVS: o financeiro importa uma planilha por
// mês e cada linha vira um lançamento da despesa correspondente na DRE
// Analítica. As colunas são detectadas pelo cabeçalho (tolerante a acento,
// caixa e texto extra); se a planilha não tiver cabeçalho reconhecível, usa a
// primeira coluna de texto como fornecedor e a primeira numérica como valor.
import * as XLSX from 'xlsx';

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// campo → sinônimos de cabeçalho (normalizados). Ordem importa: o primeiro
// campo que casar leva a coluna.
const MAPA = [
  ['forn', ['fornecedor', 'nomefornecedor', 'nmfornecedor', 'razaosocial', 'beneficiario', 'favorecido', 'cliente', 'loja', 'nome', 'quem', 'vendedor', 'funcionario', 'colaborador']],
  ['val', ['valor', 'vlr', 'vl', 'total', 'valortotal', 'valorpago', 'vlpago', 'montante', 'bonificacao', 'bonus', 'premio']],
  ['venc', ['vencimento', 'dtvencimento', 'dtvenc', 'datavencimento', 'pagamento', 'dtpagamento', 'datapagamento', 'dtpag', 'data', 'dt', 'competencia', 'mes']],
  ['emis', ['emissao', 'dtemissao', 'dataemissao']],
  ['dupl', ['documento', 'nrdocumento', 'numerodocumento', 'duplicata', 'nrduplicata', 'nrdupl', 'nf', 'nota', 'notafiscal', 'titulo', 'numero', 'nr', 'id', 'codigo']],
  ['emp', ['empresa', 'cdempresa', 'codempresa', 'filial']],
  ['obs', ['observacao', 'observacoes', 'obs', 'descricao', 'historico', 'motivo', 'comentario', 'detalhe']],
];

function detectarColunas(headers) {
  const mapa = {};
  const usada = new Set();
  // exato
  headers.forEach((h, idx) => {
    const n = norm(h);
    if (!n) return;
    for (const [campo, nomes] of MAPA) {
      if (mapa[campo] != null) continue;
      if (nomes.includes(n)) {
        mapa[campo] = idx;
        usada.add(idx);
        break;
      }
    }
  });
  // contido
  headers.forEach((h, idx) => {
    if (usada.has(idx)) return;
    const n = norm(h);
    if (!n) return;
    for (const [campo, nomes] of MAPA) {
      if (mapa[campo] != null) continue;
      if (nomes.some((x) => x.length >= 3 && n.includes(x))) {
        mapa[campo] = idx;
        usada.add(idx);
        break;
      }
    }
  });
  return mapa;
}

// "1.234,56" | "R$ 1.234,56" | 1234.56 | "1234.56" → número
export function parseValor(v) {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  let s = String(v ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.round((neg ? -n : n) * 100) / 100;
}

const pad = (n) => String(n).padStart(2, '0');
// serial Excel | Date | 'dd/mm/aaaa' | 'aaaa-mm-dd' → 'dd/mm/aaaa' (ou '')
export function parseData(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // serial do Excel: dias desde 30/12/1899 (sem depender de XLSX.SSF)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${pad(m[1])}/${pad(m[2])}/${y}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return '';
}

// Lê a planilha e devolve { headers, mapa, linhas:[{linha, forn, val, venc, emis, dupl, emp, obs, _ok, _erro}], prontas, total }
export function parseBonificacoes(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
  const aba = wb.SheetNames[0];
  const matriz = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, blankrows: false, defval: '' });
  if (!matriz.length) throw new Error('A planilha está vazia.');

  // acha a linha de cabeçalho: a primeira (até a 10ª) que reconhece fornecedor E valor
  let hdrIdx = -1;
  let mapa = {};
  for (let i = 0; i < Math.min(matriz.length, 10); i++) {
    const cand = detectarColunas(matriz[i].map((h) => String(h)));
    if (cand.forn != null && cand.val != null) {
      hdrIdx = i;
      mapa = cand;
      break;
    }
  }
  let headers = [];
  let dados;
  if (hdrIdx >= 0) {
    headers = matriz[hdrIdx].map((h) => String(h).trim());
    dados = matriz.slice(hdrIdx + 1);
  } else {
    // sem cabeçalho: 1ª coluna de texto = fornecedor, 1ª numérica = valor
    const amostra = matriz.find((l) => l.some((c) => parseValor(c) != null && typeof c !== 'string')) || matriz[0];
    const iVal = amostra.findIndex((c) => typeof c === 'number');
    const iForn = amostra.findIndex((c, i) => i !== iVal && typeof c === 'string' && c.trim());
    if (iVal < 0 || iForn < 0) {
      throw new Error('Não reconheci as colunas. A planilha precisa de uma coluna de fornecedor/nome e uma de valor (cabeçalho: FORNECEDOR e VALOR, por exemplo).');
    }
    mapa = { forn: iForn, val: iVal };
    dados = matriz;
  }
  const col = (l, campo) => (mapa[campo] != null ? l[mapa[campo]] : undefined);

  const linhas = dados
    .map((l, i) => {
      const forn = String(col(l, 'forn') ?? '').trim();
      const val = parseValor(col(l, 'val'));
      const r = {
        linha: (hdrIdx >= 0 ? hdrIdx + 1 : 0) + i + 1,
        forn: forn.toUpperCase(),
        val,
        venc: parseData(col(l, 'venc')),
        emis: parseData(col(l, 'emis')) || parseData(col(l, 'venc')),
        dupl: String(col(l, 'dupl') ?? '').trim(),
        emp: String(col(l, 'emp') ?? '').replace(/\D/g, '') || '1',
        obs: String(col(l, 'obs') ?? '').trim(),
      };
      // ignora linhas de total/rodapé e vazias
      if (!forn && val == null) return null;
      if (/^total/i.test(forn) && !r.dupl) return null;
      r._erro = !forn ? 'sem fornecedor/nome' : val == null ? 'valor inválido' : '';
      r._ok = !r._erro;
      return r;
    })
    .filter(Boolean);

  const prontas = linhas.filter((l) => l._ok);
  return {
    headers,
    mapa,
    linhas,
    prontas,
    total: Math.round(prontas.reduce((s, l) => s + l.val, 0) * 100) / 100,
  };
}
