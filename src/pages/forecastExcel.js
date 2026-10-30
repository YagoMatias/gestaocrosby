// Planilha do Forecast (Niziany 30/10): mesmo visual do painel, com fórmulas
// nos totais. Fórmula só entra quando chega ao valor da tela; onde a planilha
// base não fecha, ou o total foi digitado, a célula fica com o valor do painel.
const CANAIS = [
  'VAREJO', 'MULTIMARCAS', 'FRANQUIA', 'REVENDA', 'BAZAR',
  'FARDAMENTO', 'IMOBILIZADO', 'BLUECRED',
];
const SGA = [
  'PESSOAL FIXO', 'PESSOAL VARIÁVEL', 'PJ', 'OCUPAÇÃO', 'SERVIÇOS DE TERCEIROS FIXOS',
  'SERVIÇOS DE TERCEIROS VARIÁVEIS', 'MARKETING', 'FRETES', 'PERDAS COM INADIMPLÊNCIA',
];
const FORMULAS = {
  'RECEITA BRUTA': { termos: CANAIS, abs: 'CREDEV' },
  'RECEITA LÍQUIDA': { termos: CANAIS },
  'TAX %': { razao: ['IMPOSTOS DIRETOS', 'RECEITA LÍQUIDA'] },
  'RECEITA OPERACIONAL LÍQUIDA': { termos: ['RECEITA LÍQUIDA', 'IMPOSTOS DIRETOS'] },
  'CMV %': { razao: ['CUSTO DAS MERCADORIAS VENDIDAS', 'RECEITA OPERACIONAL LÍQUIDA'] },
  'LUCRO BRUTO': { termos: ['RECEITA OPERACIONAL LÍQUIDA', 'CUSTO DAS MERCADORIAS VENDIDAS'] },
  'MARGEM %': { razao: ['LUCRO BRUTO', 'RECEITA OPERACIONAL LÍQUIDA'] },
  'RECEITAS (DESPESAS) OPERACIONAIS': { termos: ['COMERCIAIS, GERAIS E ADMINISTRATIVAS'] },
  'COMERCIAIS, GERAIS E ADMINISTRATIVAS': { termos: SGA },
  'SERVIÇOS DE TERCEIROS VARIÁVEIS': { termos: ['TAXA DE CARTÃO'] },
  MARKETING: { termos: ['PROPAGANDA E ANÚNCIO', 'TRÁFEGO', 'BONIFICAÇÕES MARKETING'] },
  'LUCRO OPERACIONAL': {
    termos: ['LUCRO BRUTO', 'RECEITAS (DESPESAS) OPERACIONAIS', 'OUTRAS (DESPESAS) RECEITAS'],
  },
  EBITDA: { termos: ['LUCRO OPERACIONAL'] },
  'EBITDA %': { razao: ['EBITDA', 'RECEITA OPERACIONAL LÍQUIDA'] },
  'RECEITA (DESPESA) NÃO OPERACIONAL': { termos: ['RECEITA FINANCEIRA', 'DESPESA FINANCEIRA'] },
  'RECEITA FINANCEIRA': { termos: ['RECEITA FINANCEIRA COM JUROS'] },
  'DESPESA FINANCEIRA': { termos: ['ANTECIPAÇÃO DE RECEBÍVEIS', 'JUROS E MULTA POR ATRASO'] },
  'RESULTADO FINANCEIRO': { termos: ['RECEITA (DESPESA) NÃO OPERACIONAL'] },
  'LUCRO ANTES DO IR E CS': { termos: ['LUCRO OPERACIONAL', 'RESULTADO FINANCEIRO'] },
  'LUCRO LÍQUIDO': {
    termos: ['LUCRO ANTES DO IR E CS', 'IMPOSTO DE RENDA E CONTRIBUIÇÃO SOCIAL'],
  },
  '% LUCRO LÍQUIDO': { razao: ['LUCRO LÍQUIDO', 'RECEITA OPERACIONAL LÍQUIDA'] },
  'RESULTADO FINAL': { termos: ['LUCRO LÍQUIDO', 'INVESTIMENTOS', 'DISTRIBUIÇÃO LUCROS'] },
};
const TOL_MOEDA = 1.01; // o painel arredonda a folha para o real inteiro
const TOL_PCT = 0.00005;

const AZUL = 'FF000638';
const AZUL_PREV = 'FF2563EB';
const FUNDO_PREV = 'FFEFF6FF';
const FUNDO_FORTE = 'FFEEF0F6';
const CINZA_CAB = 'FFF3F4F6';
const CINZA_TEXTO = 'FF4B5563';
const CINZA_CLARO = 'FF9CA3AF';
const LINHA = 'FFE5E7EB';
const FMT_MOEDA = '#,##0;[Red]-#,##0';
const FMT_PCT = '0.0%;[Red]-0.0%';
const preenche = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

const letraColuna = (n) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) {
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  }
  return s;
};

// Junta linhas vizinhas em intervalos: [5,6,7,9] → "B5:B7,B9"
const intervalos = (col, nums) => {
  const ord = [...nums].sort((a, b) => a - b);
  const partes = [];
  for (let i = 0; i < ord.length; i++) {
    let f = i;
    while (f + 1 < ord.length && ord[f + 1] === ord[f] + 1) f++;
    partes.push(f > i ? `${col}${ord[i]}:${col}${ord[f]}` : `${col}${ord[i]}`);
    i = f;
  }
  return partes;
};
const soma = (col, nums) => {
  const p = intervalos(col, nums);
  if (p.length === 1 && !p[0].includes(':')) return p[0];
  return `SUM(${p.join(',')})`;
};

// Linhas da planilha: as da tela e, abaixo de cada uma, os detalhes.
// Liga cada detalhe ao pai pelo nível e guarda o peso com que soma nele.
export function montarLinhas(linhas, valorDe, detalhesDe) {
  const out = [];
  for (const l of linhas) {
    const nivel = Number(l.nivel) || 0;
    const pai = { label: l.label, nivel, fmt: l.fmt, l, detalhe: false, filhos: [], valores: valorDe(l) };
    out.push(pai);
    const pilha = [pai];
    for (const d of detalhesDe(l)) {
      const nv = nivel + d.nivel;
      const row = {
        label: d.label, nivel: nv, fmt: 'moeda', detalhe: true, filhos: [],
        peso: d.peso ?? 1, valores: d.valores,
      };
      while (pilha[pilha.length - 1].nivel >= nv) pilha.pop();
      pilha[pilha.length - 1].filhos.push(row);
      pilha.push(row);
      out.push(row);
    }
  }
  out.forEach((r, i) => {
    r.num = i + 3; // 2 linhas de cabeçalho
  });
  return out;
}

// Fórmula de uma célula, ou null quando ela não fecha com o valor do painel
function formulaDaCelula(r, porLabel, colKey, letra) {
  const v = r.valores[colKey];
  if (typeof v !== 'number') return null;
  const tol = r.fmt === 'pct' ? TOL_PCT : TOL_MOEDA;
  const val = (label) => Number(porLabel[label]?.valores[colKey]) || 0;
  const bate = (x) => Math.abs(x - v) <= tol;

  const def = FORMULAS[r.label];
  if (def && !r.detalhe) {
    if (def.razao) {
      const [a, b] = def.razao;
      if (!porLabel[a] || !porLabel[b] || !val(b) || !bate(val(a) / val(b))) return null;
      return `IF(${letra}${porLabel[b].num}=0,0,${letra}${porLabel[a].num}/${letra}${porLabel[b].num})`;
    }
    const nomes = def.termos.filter((t) => porLabel[t]);
    let total = nomes.reduce((a, t) => a + val(t), 0);
    let f = soma(letra, nomes.map((t) => porLabel[t].num));
    if (def.abs && porLabel[def.abs]) {
      total += Math.abs(val(def.abs));
      f += `+ABS(${letra}${porLabel[def.abs].num})`;
    }
    return bate(total) ? f : null;
  }

  // Linha com detalhe: soma os filhos, cada um com o seu sinal
  const filhos = r.filhos.filter((x) => x.peso && typeof x.valores[colKey] === 'number');
  if (!filhos.length) return null;
  const total = filhos.reduce((a, x) => a + x.peso * x.valores[colKey], 0);
  if (!bate(total)) return null;
  const pos = filhos.filter((x) => x.peso > 0).map((x) => x.num);
  const neg = filhos.filter((x) => x.peso < 0).map((x) => x.num);
  let f = pos.length ? soma(letra, pos) : '';
  if (neg.length) f += `-${soma(letra, neg)}`;
  return f;
}

export async function gerarForecastXlsx({ ExcelJS, linhas, colunas, valorDe, detalhesDe, titulo, tipoDe, inicioSecao }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(titulo.slice(0, 31), {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 2, showGridLines: false }],
    properties: { outlineProperties: { summaryBelow: false, summaryRight: false } },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  ws.columns = [{ width: 50 }, ...colunas.map(() => ({ width: 13.5 }))];

  // Cabeçalho: faixa Realizado / Previsão e os meses
  const r1 = ws.getRow(1);
  const r2 = ws.getRow(2);
  r1.getCell(1).value = titulo;
  r2.getCell(1).value = 'em R$';
  [r1.getCell(1), r2.getCell(1)].forEach((c) => {
    c.fill = preenche(CINZA_CAB);
    c.border = { right: { style: 'thin', color: { argb: LINHA } } };
  });
  r1.getCell(1).font = { bold: true, size: 11, color: { argb: CINZA_TEXTO } };
  r2.getCell(1).font = { size: 9, color: { argb: CINZA_CLARO } };
  for (let i = 0; i < colunas.length; ) {
    let f = i;
    while (f + 1 < colunas.length && colunas[f + 1].tipo === colunas[i].tipo) f++;
    if (f > i) ws.mergeCells(1, i + 2, 1, f + 2);
    const c = r1.getCell(i + 2);
    c.value = colunas[i].tipo === 'realizado' ? 'REALIZADO' : 'PREVISÃO';
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = preenche(colunas[i].tipo === 'realizado' ? AZUL : AZUL_PREV);
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    i = f + 1;
  }
  colunas.forEach((col, i) => {
    const c = r2.getCell(i + 2);
    c.value = col.label;
    c.font = { bold: true, size: 10, color: { argb: CINZA_TEXTO } };
    c.fill = preenche(CINZA_CAB);
    c.alignment = { horizontal: 'right' };
    c.border = { bottom: { style: 'thin', color: { argb: LINHA } } };
  });
  r1.height = 20;

  const rows = montarLinhas(linhas, valorDe, detalhesDe);
  const porLabel = {};
  rows.forEach((r) => {
    if (!r.detalhe) porLabel[r.label] = r;
  });
  let comFormula = 0;
  for (const r of rows) {
    const row = ws.getRow(r.num);
    const tipo = r.detalhe ? 'detalhe' : tipoDe(r.l);
    const forte = tipo === 'forte';
    const pct = tipo === 'pct';
    const topo = !r.detalhe && inicioSecao.has(r.label);
    const borda = {
      bottom: { style: 'hair', color: { argb: LINHA } },
      ...(topo ? { top: { style: 'thin', color: { argb: AZUL } } } : {}),
    };
    const fonte = forte
      ? { bold: true, size: 10, color: { argb: AZUL } }
      : pct
        ? { italic: true, size: 9, color: { argb: CINZA_CLARO } }
        : r.detalhe
          ? { size: 9, color: { argb: CINZA_TEXTO } }
          : { size: 10, color: { argb: 'FF1F2937' } };

    const rot = row.getCell(1);
    rot.value = r.label;
    rot.font = fonte;
    rot.alignment = { indent: Math.min(r.nivel + (pct ? 1 : 0), 10), vertical: 'middle' };
    rot.border = { ...borda, right: { style: 'thin', color: { argb: LINHA } } };
    if (forte) rot.fill = preenche(FUNDO_FORTE);

    colunas.forEach((col, i) => {
      const c = row.getCell(i + 2);
      const v = r.valores[col.key];
      const num = typeof v === 'number' ? v : null;
      const f = num === null ? null : formulaDaCelula(r, porLabel, col.key, letraColuna(i + 2));
      if (f) {
        c.value = { formula: f, result: num };
        comFormula++;
      } else if (num !== null) {
        c.value = num;
      }
      c.numFmt = r.fmt === 'pct' ? FMT_PCT : FMT_MOEDA;
      c.font = fonte;
      c.alignment = { horizontal: 'right' };
      c.border = borda;
      if (forte) c.fill = preenche(FUNDO_FORTE);
      else if (col.tipo === 'forecast') c.fill = preenche(FUNDO_PREV);
    });

    if (r.nivel) row.outlineLevel = Math.min(r.nivel, 7);
    if (r.detalhe) row.hidden = true; // abre pelo + na lateral
  }
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, comFormula };
}
