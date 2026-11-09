// DANFE em HTML a partir do XML da NF-e (nfeProc / NFe), para visualizar e
// imprimir/salvar em PDF. Usado na Manifestação do Destinatário (notas
// recebidas — pedido da Niziany, 27/10/2026) e no Faturamento da expedição
// (notas emitidas pelo HeadCoach). Abre com abrirImpressao() de documentoFiscalHtml.
//
// Layout (09/11/2026, pedido do Yago): canhoto, cabeçalho com o logo da Crosby
// (só quando o emitente é do grupo), código de barras Code 128-C da chave,
// blocos em grade, total em destaque, pagamento, DIFAL e marca d'água de
// CANCELADA / HOMOLOGAÇÃO.

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const txt = (el, tag) => {
  if (!el) return '';
  const n = el.getElementsByTagName(tag)[0];
  return n && n.textContent != null ? String(n.textContent).trim() : '';
};
const first = (el, tag) => (el ? el.getElementsByTagName(tag)[0] || null : null);

const brl = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const brl0 = (v) => brl(v) || '0,00';
const qtd = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};
const peso = (v) => {
  const n = parseFloat(v);
  return isNaN(n) || n === 0 ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};
const partesData = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return { data: iso || '', hora: '' };
  return { data: `${m[3]}/${m[2]}/${m[1]}`, hora: m[4] ? `${m[4]}:${m[5]}${m[6] ? `:${m[6]}` : ''}` : '' };
};
const dataBR = (iso) => {
  const p = partesData(iso);
  return `${p.data}${p.hora ? ` ${p.hora}` : ''}`;
};
const cnpjFmt = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return v || '';
};
const cepFmt = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : v || '';
};
const foneFmt = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v || '';
};
const chaveFmt = (c) => String(c || '').replace(/(\d{4})(?=\d)/g, '$1 ');
const nfFmt = (n) => String(n || '').padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');

const endereco = (ender) => {
  if (!ender) return { linha1: '', bairro: '', mun: '', uf: '', cep: '', fone: '' };
  const l1 = [txt(ender, 'xLgr'), txt(ender, 'nro')].filter(Boolean).join(', ');
  const compl = txt(ender, 'xCpl');
  return {
    linha1: compl ? `${l1} - ${compl}` : l1,
    bairro: txt(ender, 'xBairro'),
    mun: txt(ender, 'xMun'),
    uf: txt(ender, 'UF'),
    cep: txt(ender, 'CEP'),
    fone: txt(ender, 'fone'),
  };
};

const MOD_FRETE = {
  0: '0 - Por conta do remetente (CIF)',
  1: '1 - Por conta do destinatário (FOB)',
  2: '2 - Por conta de terceiros',
  3: '3 - Próprio, por conta do remetente',
  4: '4 - Próprio, por conta do destinatário',
  9: '9 - Sem frete',
};
const TPAG = {
  '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de crédito', '04': 'Cartão de débito', '05': 'Crédito loja',
  10: 'Vale alimentação', 11: 'Vale refeição', 12: 'Vale presente', 13: 'Vale combustível', 14: 'Duplicata mercantil',
  15: 'Boleto bancário', 16: 'Depósito bancário', 17: 'Pix', 18: 'Transferência / carteira digital',
  19: 'Fidelidade / cashback', 20: 'Pix estático', 21: 'Crédito em loja', 90: 'Sem pagamento', 99: 'Outros',
};

// Raízes de CNPJ do grupo Crosby: só essas notas levam o logo
const RAIZES_CROSBY = ['17177680', '27728810', '33592092', '53661116', '36569459'];

// ─── Código de barras Code 128-C (44 dígitos da chave) em SVG ───────────────
const C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
function barcodeSvg(digitos) {
  const d = String(digitos || '').replace(/\D/g, '');
  if (!d || d.length % 2) return '';
  const codigos = [105]; // START C
  for (let i = 0; i < d.length; i += 2) codigos.push(parseInt(d.slice(i, i + 2), 10));
  const check = codigos.reduce((s, c, i) => s + c * (i === 0 ? 1 : i), 0) % 103;
  codigos.push(check, 106); // checksum + STOP
  let x = 0;
  let rects = '';
  for (const c of codigos) {
    const pat = C128[c];
    for (let i = 0; i < pat.length; i++) {
      const w = Number(pat[i]);
      if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="40"/>`;
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 40" preserveAspectRatio="none" class="barcode" shape-rendering="crispEdges">${rects}</svg>`;
}

// célula de campo: rótulo pequeno + valor
const campo = (rotulo, valor, { span = 1, cls = '', forte = false } = {}) =>
  `<div class="f${cls ? ` ${cls}` : ''}" style="grid-column: span ${span}"><span class="l">${esc(rotulo)}</span><span class="v${forte ? ' forte' : ''}">${valor || '&nbsp;'}</span></div>`;

// opcoes: { logoUrl, cancelada }
export function gerarHtmlDanfeDeXml(xmlString, opcoes = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(xmlString || ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('XML da nota inválido');
  }
  const infNFe = first(doc, 'infNFe');
  if (!infNFe) throw new Error('XML sem infNFe');
  const ide = first(infNFe, 'ide');
  const emit = first(infNFe, 'emit');
  const dest = first(infNFe, 'dest');
  const total = first(first(infNFe, 'total'), 'ICMSTot');
  const transp = first(infNFe, 'transp');
  const prot = first(doc, 'infProt');
  const infAdic = first(infNFe, 'infAdic');
  const cobr = first(infNFe, 'cobr');
  const pag = first(infNFe, 'pag');

  const chave = txt(prot, 'chNFe') || String(infNFe.getAttribute('Id') || '').replace(/^NFe/, '');
  const nNF = txt(ide, 'nNF');
  const serie = txt(ide, 'serie');
  const tpNF = txt(ide, 'tpNF');
  const emi = partesData(txt(ide, 'dhEmi') || txt(ide, 'dEmi'));
  const sai = partesData(txt(ide, 'dhSaiEnt') || txt(ide, 'dSaiEnt'));
  const natOp = txt(ide, 'natOp');
  const tpAmb = txt(ide, 'tpAmb');

  const eEnd = endereco(first(emit, 'enderEmit'));
  const dEnd = endereco(first(dest, 'enderDest'));
  const emitCnpj = txt(emit, 'CNPJ') || txt(emit, 'CPF');
  const ehCrosby = RAIZES_CROSBY.includes(String(emitCnpj).replace(/\D/g, '').slice(0, 8));
  const origem = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const logoUrl = opcoes.logoUrl || (ehCrosby ? `${origem}/crosbyazul.png` : '');

  const itens = Array.from(infNFe.getElementsByTagName('det')).map((det) => {
    const prod = first(det, 'prod');
    const imposto = first(det, 'imposto');
    const icms = first(imposto, 'ICMS');
    const ipi = first(imposto, 'IPI');
    return {
      cProd: txt(prod, 'cProd'),
      xProd: txt(prod, 'xProd'),
      ncm: txt(prod, 'NCM'),
      cst: `${txt(icms, 'orig')}${txt(icms, 'CST') || txt(icms, 'CSOSN')}`,
      cfop: txt(prod, 'CFOP'),
      un: txt(prod, 'uCom'),
      q: txt(prod, 'qCom'),
      vUn: txt(prod, 'vUnCom'),
      vProd: txt(prod, 'vProd'),
      vDesc: txt(prod, 'vDesc'),
      vBC: txt(icms, 'vBC'),
      vICMS: txt(icms, 'vICMS'),
      pICMS: txt(icms, 'pICMS'),
      vIPI: txt(ipi, 'vIPI'),
      pIPI: txt(ipi, 'pIPI'),
    };
  });
  const temDesc = itens.some((i) => parseFloat(i.vDesc) > 0);
  const temIpi = itens.some((i) => parseFloat(i.vIPI) > 0);

  const duplicatas = Array.from(cobr ? cobr.getElementsByTagName('dup') : []).map((d) => ({
    n: txt(d, 'nDup'),
    venc: txt(d, 'dVenc'),
    v: txt(d, 'vDup'),
  }));
  const pagamentos = Array.from(pag ? pag.getElementsByTagName('detPag') : []).map((d) => ({
    t: txt(d, 'tPag'),
    v: txt(d, 'vPag'),
  }));

  const transportadora = first(transp, 'transporta');
  const vol = first(transp, 'vol');
  const modFrete = txt(transp, 'modFrete');

  const cStat = txt(prot, 'cStat');
  const protocolo = txt(prot, 'nProt');
  const dhRecbto = txt(prot, 'dhRecbto');
  const vDifal = parseFloat(txt(total, 'vICMSUFDest')) || 0;

  const linhasItens = itens
    .map(
      (i) => `<tr>
        <td class="c mono">${esc(i.cProd)}</td>
        <td>${esc(i.xProd)}</td>
        <td class="c">${esc(i.ncm)}</td>
        <td class="c">${esc(i.cst)}</td>
        <td class="c">${esc(i.cfop)}</td>
        <td class="c">${esc(i.un)}</td>
        <td class="r">${qtd(i.q)}</td>
        <td class="r">${brl(i.vUn)}</td>
        ${temDesc ? `<td class="r">${parseFloat(i.vDesc) > 0 ? brl(i.vDesc) : ''}</td>` : ''}
        <td class="r b">${brl(i.vProd)}</td>
        <td class="r">${brl(i.vBC)}</td>
        <td class="r">${brl(i.vICMS)}</td>
        <td class="r">${i.pICMS ? brl(i.pICMS) : ''}</td>
        ${temIpi ? `<td class="r">${brl(i.vIPI)}</td><td class="r">${i.pIPI ? brl(i.pIPI) : ''}</td>` : ''}
      </tr>`,
    )
    .join('');

  const blocoFatura =
    duplicatas.length || pagamentos.length
      ? `<h3>Fatura / pagamento</h3>
    <div class="fatura">
      ${duplicatas.map((d) => `<div class="dup"><span class="l">Duplicata ${esc(d.n)}</span><span class="v">${esc(partesData(d.venc).data)}</span><span class="v forte">R$ ${brl(d.v)}</span></div>`).join('')}
      ${pagamentos.map((p) => `<div class="dup"><span class="l">Forma de pagamento</span><span class="v">${esc(TPAG[p.t] || p.t)}</span><span class="v forte">R$ ${brl(p.v)}</span></div>`).join('')}
    </div>`
      : '';

  const titulo = `DANFE NF-e ${nNF}${serie ? ` / ${serie}` : ''} — ${txt(emit, 'xNome')}`;
  const marca = opcoes.cancelada ? 'CANCELADA' : tpAmb === '2' ? 'SEM VALOR FISCAL' : '';
  const emitNome = txt(emit, 'xNome');

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Segoe UI', Roboto, Arial, Helvetica, sans-serif; font-size: 9px; color: #111827; margin: 0; padding: 14px; background: #eef0f4; }
  .bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 210mm; margin: 0 auto 10px; font-size: 12px; color: #000638; font-weight: 600; }
  .bar button { background: #000638; color: #fff; border: 0; border-radius: 10px; padding: 9px 16px; font-weight: 700; cursor: pointer; font-size: 12px; }
  .bar .amb { color: #b91c1c; }
  .page { position: relative; background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 7mm; box-shadow: 0 4px 22px rgba(0,6,56,.16); border-radius: 4px; overflow: hidden; }
  .marca { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-28deg); font-size: 82px; font-weight: 900; letter-spacing: 6px; color: rgba(185, 28, 28, .13); white-space: nowrap; pointer-events: none; z-index: 5; }

  /* grade de campos: bordas finas, sem linha dupla */
  .g { display: grid; border-top: .6px solid #1f2937; border-left: .6px solid #1f2937; }
  .f { border-right: .6px solid #1f2937; border-bottom: .6px solid #1f2937; padding: 2px 4px 3px; min-height: 22px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
  .l { font-size: 5.8px; text-transform: uppercase; letter-spacing: .25px; color: #4b5563; line-height: 1.2; }
  .v { font-size: 9px; font-weight: 600; line-height: 1.25; word-break: break-word; }
  .v.forte { font-weight: 800; }
  .dir .v { text-align: right; font-variant-numeric: tabular-nums; }
  .c2 { grid-template-columns: repeat(2, 1fr); } .c3 { grid-template-columns: repeat(3, 1fr); }
  .c4 { grid-template-columns: repeat(4, 1fr); } .c5 { grid-template-columns: repeat(5, 1fr); }
  .c6 { grid-template-columns: repeat(6, 1fr); } .c12 { grid-template-columns: repeat(12, 1fr); }
  h3 { font-size: 6.8px; margin: 5px 0 1.5px; text-transform: uppercase; letter-spacing: .6px; color: #000638; font-weight: 800; display: flex; align-items: center; gap: 4px; }
  h3::before { content: ''; width: 3px; height: 8px; background: #000638; border-radius: 1px; display: inline-block; }

  /* canhoto */
  .canhoto { display: grid; grid-template-columns: 1fr 34mm; border: .6px solid #1f2937; }
  .canhoto .txt { padding: 3px 5px; font-size: 6.5px; text-transform: uppercase; border-bottom: .6px solid #1f2937; grid-column: 1; }
  .canhoto .ass { display: grid; grid-template-columns: 38mm 1fr; grid-column: 1; }
  .canhoto .ass > div { padding: 2px 5px; min-height: 22px; }
  .canhoto .ass > div + div { border-left: .6px solid #1f2937; }
  .canhoto .nf { grid-column: 2; grid-row: 1 / span 2; border-left: .6px solid #1f2937; text-align: center; display: flex; flex-direction: column; justify-content: center; padding: 3px; }
  .canhoto .nf b { font-size: 13px; color: #000638; }
  .corte { border-top: 1px dashed #9ca3af; margin: 4px 0 5px; }

  /* cabeçalho */
  .head { display: grid; grid-template-columns: 76mm 32mm 1fr; border: .6px solid #1f2937; }
  .head > div + div { border-left: .6px solid #1f2937; }
  .emit { padding: 5px 6px; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
  .emit img { max-width: 52mm; max-height: 13mm; object-fit: contain; align-self: center; margin-bottom: 3px; }
  .emit .nome { font-size: 10.5px; font-weight: 800; color: #000638; text-align: center; line-height: 1.2; }
  .emit .end { font-size: 7.6px; text-align: center; color: #1f2937; line-height: 1.35; }
  .danfe { text-align: center; padding: 4px 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
  .danfe .big { font-size: 17px; font-weight: 900; letter-spacing: 1.5px; color: #000638; line-height: 1; }
  .danfe .sub { font-size: 6px; line-height: 1.25; color: #374151; }
  .danfe .es { display: flex; align-items: center; gap: 5px; font-size: 7px; text-align: left; margin: 2px 0; }
  .danfe .es .q { border: .8px solid #000638; width: 16px; height: 18px; display: grid; place-items: center; font-size: 13px; font-weight: 900; color: #000638; }
  .danfe .num { font-size: 10px; font-weight: 800; }
  .chv { padding: 4px 6px; display: flex; flex-direction: column; gap: 2px; justify-content: center; }
  .barcode { width: 100%; height: 11mm; display: block; }
  .chave { font-family: 'Consolas', 'Courier New', monospace; font-size: 9.6px; font-weight: 700; letter-spacing: .2px; text-align: center; }
  .cons { font-size: 6.5px; text-align: center; color: #374151; line-height: 1.3; }

  .total { background: #000638; }
  .total .l { color: #c7cbe6; } .total .v { color: #fff; font-size: 12px; font-weight: 800; }

  .fatura { display: flex; flex-wrap: wrap; gap: 3px; }
  .dup { border: .6px solid #1f2937; border-radius: 3px; padding: 2px 6px; display: flex; flex-direction: column; min-width: 30mm; }
  .dup .v { font-variant-numeric: tabular-nums; }

  table.itens { width: 100%; border-collapse: collapse; }
  table.itens th, table.itens td { border: .6px solid #1f2937; padding: 1.8px 3px; font-size: 7.6px; vertical-align: top; }
  table.itens th { background: #eef0f7; color: #000638; font-weight: 800; text-transform: uppercase; font-size: 5.8px; letter-spacing: .2px; }
  table.itens tbody tr:nth-child(even) td { background: #fafbfd; }
  .c { text-align: center; } .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; } .b { font-weight: 700; }
  .mono { font-family: 'Consolas', 'Courier New', monospace; }
  .adic { white-space: pre-wrap; font-size: 7.6px; font-weight: 500; min-height: 22mm; line-height: 1.35; }
  .rodape { margin-top: 5px; font-size: 6.2px; color: #6b7280; display: flex; justify-content: space-between; }
  @page { size: A4; margin: 6mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; width: auto; min-height: auto; margin: 0; padding: 0; border-radius: 0; overflow: visible; }
    .bar { display: none; }
    table.itens thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style></head>
<body>
  <div class="bar">
    <span>${esc(titulo)}${tpAmb === '2' ? ' <span class="amb">· HOMOLOGAÇÃO — SEM VALOR FISCAL</span>' : ''}${opcoes.cancelada ? ' <span class="amb">· CANCELADA</span>' : ''}</span>
    <button onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>
  <div class="page">
    ${marca ? `<div class="marca">${marca}</div>` : ''}

    <div class="canhoto">
      <div class="txt">Recebemos de <b>${esc(emitNome)}</b> os produtos e/ou serviços constantes da nota fiscal eletrônica indicada ao lado. Destinatário: ${esc(txt(dest, 'xNome'))} · Valor total: R$ ${brl(txt(total, 'vNF'))}</div>
      <div class="ass">
        <div><span class="l">Data de recebimento</span></div>
        <div><span class="l">Identificação e assinatura do recebedor</span></div>
      </div>
      <div class="nf"><span class="l">NF-e</span><b>Nº ${esc(nfFmt(nNF))}</b><span class="v">Série ${esc(serie)}</span></div>
    </div>
    <div class="corte"></div>

    <div class="head">
      <div class="emit">
        ${logoUrl ? `<img src="${esc(logoUrl)}" alt="" onerror="this.style.display='none'">` : ''}
        <div class="nome">${esc(emitNome)}</div>
        <div class="end">
          ${esc(eEnd.linha1)}${eEnd.bairro ? ` · ${esc(eEnd.bairro)}` : ''}<br>
          ${esc(eEnd.mun)}${eEnd.uf ? `/${esc(eEnd.uf)}` : ''}${eEnd.cep ? ` · CEP ${esc(cepFmt(eEnd.cep))}` : ''}${eEnd.fone ? ` · ${esc(foneFmt(eEnd.fone))}` : ''}
        </div>
      </div>
      <div class="danfe">
        <div class="big">DANFE</div>
        <div class="sub">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
        <div class="es"><span>0 - Entrada<br>1 - Saída</span><span class="q">${tpNF === '0' ? '0' : '1'}</span></div>
        <div class="num">Nº ${esc(nfFmt(nNF))}</div>
        <div class="num">Série ${esc(serie)}</div>
        <div class="sub">Folha 1/1</div>
      </div>
      <div class="chv">
        ${barcodeSvg(chave)}
        <span class="l" style="text-align:center">Chave de acesso</span>
        <div class="chave">${esc(chaveFmt(chave))}</div>
        <div class="cons">Consulta de autenticidade no portal nacional da NF-e<br><b>www.nfe.fazenda.gov.br/portal</b> ou no site da SEFAZ autorizadora</div>
      </div>
    </div>
    <div class="g c12" style="border-top:0">
      ${campo('Natureza da operação', esc(natOp), { span: 7 })}
      ${campo('Protocolo de autorização de uso', `${esc(protocolo)}${dhRecbto ? ` · ${esc(dataBR(dhRecbto))}` : ''}${cStat && cStat !== '100' ? ` · ${esc(cStat)}` : ''}`, { span: 5 })}
      ${campo('Inscrição estadual', esc(txt(emit, 'IE')), { span: 4 })}
      ${campo('Inscrição estadual do subst. tributário', esc(txt(emit, 'IEST')), { span: 4 })}
      ${campo('CNPJ', esc(cnpjFmt(emitCnpj)), { span: 4 })}
    </div>

    <h3>Destinatário / remetente</h3>
    <div class="g c12">
      ${campo('Nome / razão social', esc(txt(dest, 'xNome')), { span: 7, forte: true })}
      ${campo('CNPJ / CPF', esc(cnpjFmt(txt(dest, 'CNPJ') || txt(dest, 'CPF'))), { span: 3 })}
      ${campo('Data da emissão', esc(emi.data), { span: 2 })}
      ${campo('Endereço', esc(dEnd.linha1), { span: 6 })}
      ${campo('Bairro / distrito', esc(dEnd.bairro), { span: 3 })}
      ${campo('CEP', esc(cepFmt(dEnd.cep)), { span: 1 })}
      ${campo('Data da saída/entrada', esc(sai.data), { span: 2 })}
      ${campo('Município', esc(dEnd.mun), { span: 5 })}
      ${campo('UF', esc(dEnd.uf), { span: 1 })}
      ${campo('Fone', esc(foneFmt(dEnd.fone)), { span: 2 })}
      ${campo('Inscrição estadual', esc(txt(dest, 'IE')), { span: 2 })}
      ${campo('Hora da saída', esc(sai.hora), { span: 2 })}
    </div>

    ${blocoFatura}

    <h3>Cálculo do imposto</h3>
    <div class="g c6">
      ${campo('Base de cálculo do ICMS', brl0(txt(total, 'vBC')), { cls: 'dir' })}
      ${campo('Valor do ICMS', brl0(txt(total, 'vICMS')), { cls: 'dir' })}
      ${campo('Base de cálc. ICMS ST', brl0(txt(total, 'vBCST')), { cls: 'dir' })}
      ${campo('Valor do ICMS ST', brl0(txt(total, 'vST')), { cls: 'dir' })}
      ${campo(vDifal > 0 ? 'ICMS UF destino (DIFAL)' : 'Valor do IPI', vDifal > 0 ? brl0(vDifal) : brl0(txt(total, 'vIPI')), { cls: 'dir' })}
      ${campo('Valor total dos produtos', brl0(txt(total, 'vProd')), { cls: 'dir', forte: true })}
      ${campo('Valor do frete', brl0(txt(total, 'vFrete')), { cls: 'dir' })}
      ${campo('Valor do seguro', brl0(txt(total, 'vSeg')), { cls: 'dir' })}
      ${campo('Desconto', brl0(txt(total, 'vDesc')), { cls: 'dir' })}
      ${campo('Outras despesas', brl0(txt(total, 'vOutro')), { cls: 'dir' })}
      ${campo(vDifal > 0 ? 'Valor do IPI' : 'PIS + COFINS', vDifal > 0 ? brl0(txt(total, 'vIPI')) : brl0((parseFloat(txt(total, 'vPIS')) || 0) + (parseFloat(txt(total, 'vCOFINS')) || 0)), { cls: 'dir' })}
      ${campo('Valor total da nota', `R$ ${brl0(txt(total, 'vNF'))}`, { cls: 'dir total' })}
    </div>

    <h3>Transportador / volumes transportados</h3>
    <div class="g c12">
      ${campo('Nome / razão social', esc(txt(transportadora, 'xNome')), { span: 5 })}
      ${campo('Frete por conta', esc(MOD_FRETE[modFrete] || modFrete || ''), { span: 3 })}
      ${campo('CNPJ / CPF', esc(cnpjFmt(txt(transportadora, 'CNPJ') || txt(transportadora, 'CPF'))), { span: 2 })}
      ${campo('Inscrição estadual', esc(txt(transportadora, 'IE')), { span: 2 })}
      ${campo('Endereço', esc(txt(transportadora, 'xEnder')), { span: 5 })}
      ${campo('Município', esc(txt(transportadora, 'xMun')), { span: 3 })}
      ${campo('UF', esc(txt(transportadora, 'UF')), { span: 1 })}
      ${campo('Quantidade', esc(txt(vol, 'qVol')), { span: 1 })}
      ${campo('Espécie', esc(txt(vol, 'esp')), { span: 2 })}
      ${campo('Marca', esc(txt(vol, 'marca')), { span: 3 })}
      ${campo('Numeração', esc(txt(vol, 'nVol')), { span: 3 })}
      ${campo('Peso bruto (kg)', peso(txt(vol, 'pesoB')), { span: 3, cls: 'dir' })}
      ${campo('Peso líquido (kg)', peso(txt(vol, 'pesoL')), { span: 3, cls: 'dir' })}
    </div>

    <h3>Dados dos produtos / serviços · ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}</h3>
    <table class="itens">
      <thead><tr>
        <th>Código</th><th>Descrição do produto / serviço</th><th>NCM</th><th>CST</th><th>CFOP</th><th>Un</th><th>Qtd</th><th>V. unit.</th>${temDesc ? '<th>Desc.</th>' : ''}<th>V. total</th><th>BC ICMS</th><th>V. ICMS</th><th>% ICMS</th>${temIpi ? '<th>V. IPI</th><th>% IPI</th>' : ''}
      </tr></thead>
      <tbody>${linhasItens}</tbody>
    </table>

    <h3>Dados adicionais</h3>
    <div class="g" style="grid-template-columns: 2fr 1fr">
      <div class="f"><span class="l">Informações complementares</span><div class="adic">${esc(txt(infAdic, 'infCpl'))}</div></div>
      <div class="f"><span class="l">Reservado ao fisco</span><div class="adic">${esc(txt(infAdic, 'infAdFisco'))}</div></div>
    </div>
    <div class="rodape"><span>DANFE gerado pelo HeadCoach a partir do XML autorizado da NF-e</span><span>Emissão ${esc(emi.data)}${emi.hora ? ` ${esc(emi.hora)}` : ''}</span></div>
  </div>
</body></html>`;
}

export default { gerarHtmlDanfeDeXml };
