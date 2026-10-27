// DANFE em HTML a partir do XML da NF-e (nfeProc / NFe), para visualizar e
// imprimir/salvar em PDF a nota recebida (Manifestação do Destinatário).
// Pedido da Niziany, 27/10/2026. Abre com abrirImpressao() de documentoFiscalHtml.

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
  return isNaN(n)
    ? ''
    : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const qtd = (v) => {
  const n = parseFloat(v);
  return isNaN(n)
    ? ''
    : n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};
const dataBR = (iso) => {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}`;
};
const cnpjFmt = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return v || '';
};
const chaveFmt = (c) => String(c || '').replace(/(\d{4})(?=\d)/g, '$1 ');

const endereco = (ender) => {
  if (!ender) return { linha1: '', linha2: '', mun: '', uf: '', cep: '', fone: '' };
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
  0: '0 - Emitente',
  1: '1 - Destinatário',
  2: '2 - Terceiros',
  3: '3 - Próprio (remetente)',
  4: '4 - Próprio (destinatário)',
  9: '9 - Sem frete',
};

export function gerarHtmlDanfeDeXml(xmlString) {
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

  const chave =
    txt(prot, 'chNFe') || String(infNFe.getAttribute('Id') || '').replace(/^NFe/, '');
  const nNF = txt(ide, 'nNF');
  const serie = txt(ide, 'serie');
  const tpNF = txt(ide, 'tpNF');
  const dhEmi = txt(ide, 'dhEmi') || txt(ide, 'dEmi');
  const dhSaiEnt = txt(ide, 'dhSaiEnt') || txt(ide, 'dSaiEnt');
  const natOp = txt(ide, 'natOp');
  const tpAmb = txt(ide, 'tpAmb');

  const eEnd = endereco(first(emit, 'enderEmit'));
  const dEnd = endereco(first(dest, 'enderDest'));

  const itens = Array.from(infNFe.getElementsByTagName('det')).map((det) => {
    const prod = first(det, 'prod');
    const imposto = first(det, 'imposto');
    const icms = first(imposto, 'ICMS');
    const ipi = first(imposto, 'IPI');
    return {
      n: det.getAttribute('nItem') || '',
      cProd: txt(prod, 'cProd'),
      xProd: txt(prod, 'xProd'),
      ncm: txt(prod, 'NCM'),
      cst: txt(icms, 'CST') || txt(icms, 'CSOSN'),
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

  const duplicatas = Array.from(cobr ? cobr.getElementsByTagName('dup') : []).map((d) => ({
    n: txt(d, 'nDup'),
    venc: txt(d, 'dVenc'),
    v: txt(d, 'vDup'),
  }));

  const transportadora = first(transp, 'transporta');
  const vol = first(transp, 'vol');
  const modFrete = txt(transp, 'modFrete');

  const cStat = txt(prot, 'cStat');
  const protocolo = txt(prot, 'nProt');
  const dhRecbto = txt(prot, 'dhRecbto');
  const xMotivo = txt(prot, 'xMotivo');

  const linhasItens = itens
    .map(
      (i) => `<tr>
        <td class="c">${esc(i.cProd)}</td>
        <td>${esc(i.xProd)}</td>
        <td class="c">${esc(i.ncm)}</td>
        <td class="c">${esc(i.cst)}</td>
        <td class="c">${esc(i.cfop)}</td>
        <td class="c">${esc(i.un)}</td>
        <td class="r">${qtd(i.q)}</td>
        <td class="r">${brl(i.vUn)}</td>
        <td class="r">${brl(i.vProd)}</td>
        <td class="r">${brl(i.vBC)}</td>
        <td class="r">${brl(i.vICMS)}</td>
        <td class="r">${brl(i.vIPI)}</td>
        <td class="r">${i.pICMS ? brl(i.pICMS) : ''}</td>
        <td class="r">${i.pIPI ? brl(i.pIPI) : ''}</td>
      </tr>`,
    )
    .join('');

  const linhasDup = duplicatas.length
    ? `<div class="box"><div class="t">FATURA / DUPLICATAS</div><div class="dups">${duplicatas
        .map((d) => `<span>${esc(d.n)} · ${dataBR(d.venc)} · R$ ${brl(d.v)}</span>`)
        .join('')}</div></div>`
    : '';

  const titulo = `DANFE NF-e ${nNF}${serie ? ` / ${serie}` : ''} — ${txt(emit, 'xNome')}`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; margin: 0; padding: 12px; background: #f3f4f6; }
  .page { background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 8mm; box-shadow: 0 2px 12px rgba(0,0,0,.15); }
  .bar { display: flex; justify-content: space-between; align-items: center; width: 210mm; margin: 0 auto 8px; }
  .bar button { background: #000638; color: #fff; border: 0; border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
  .bar .amb { color: #b91c1c; font-weight: 700; }
  .box { border: 1px solid #000; padding: 3px 5px; margin-top: 3px; }
  .t { font-size: 7px; text-transform: uppercase; color: #333; margin-bottom: 1px; }
  .v { font-size: 10px; font-weight: 700; }
  .grid { display: grid; gap: 3px; }
  .g2 { grid-template-columns: 1fr 1fr; }
  .g3 { grid-template-columns: 1fr 1fr 1fr; }
  .g4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .g5 { grid-template-columns: repeat(5, 1fr); }
  .head { display: grid; grid-template-columns: 1.4fr 0.8fr 1.4fr; gap: 4px; }
  .head .emit { font-size: 12px; font-weight: 700; }
  .danfe { text-align: center; }
  .danfe .big { font-size: 16px; font-weight: 800; letter-spacing: 1px; }
  .danfe .sub { font-size: 7px; }
  .danfe .tipo { display: inline-block; border: 1px solid #000; padding: 1px 8px; margin: 3px 0; font-weight: 700; }
  .chave { font-family: 'Courier New', monospace; font-size: 10px; font-weight: 700; letter-spacing: .5px; }
  h3 { font-size: 9px; margin: 8px 0 2px; text-transform: uppercase; }
  table.itens { width: 100%; border-collapse: collapse; margin-top: 2px; }
  table.itens th, table.itens td { border: 1px solid #000; padding: 2px 3px; font-size: 8px; vertical-align: top; }
  table.itens th { background: #eee; font-weight: 700; text-transform: uppercase; font-size: 7px; }
  .c { text-align: center; } .r { text-align: right; white-space: nowrap; }
  .dups span { display: inline-block; margin: 2px 8px 2px 0; font-size: 9px; }
  .adic { white-space: pre-wrap; font-size: 8px; min-height: 40px; }
  .rodape { margin-top: 8px; font-size: 7px; color: #555; text-align: center; }
  @media print { body { background: #fff; padding: 0; } .page { box-shadow: none; width: auto; min-height: auto; margin: 0; padding: 6mm; } .bar { display: none; } }
</style></head>
<body>
  <div class="bar">
    <span>${esc(titulo)}${tpAmb === '2' ? ' <span class="amb">· HOMOLOGAÇÃO — SEM VALOR FISCAL</span>' : ''}</span>
    <button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>
  <div class="page">
    <div class="head">
      <div class="box">
        <div class="emit">${esc(txt(emit, 'xNome'))}</div>
        <div>${esc(txt(emit, 'xFant'))}</div>
        <div>${esc(eEnd.linha1)}${eEnd.bairro ? ` - ${esc(eEnd.bairro)}` : ''}</div>
        <div>${esc(eEnd.mun)}${eEnd.uf ? ` - ${esc(eEnd.uf)}` : ''}${eEnd.cep ? ` · CEP ${esc(eEnd.cep)}` : ''}${eEnd.fone ? ` · Fone ${esc(eEnd.fone)}` : ''}</div>
        <div>CNPJ ${esc(cnpjFmt(txt(emit, 'CNPJ') || txt(emit, 'CPF')))} · IE ${esc(txt(emit, 'IE'))}</div>
      </div>
      <div class="box danfe">
        <div class="big">DANFE</div>
        <div class="sub">Documento Auxiliar da Nota Fiscal Eletrônica</div>
        <div class="tipo">${tpNF === '0' ? '0 - ENTRADA' : '1 - SAÍDA'}</div>
        <div class="v">Nº ${esc(nNF)}</div>
        <div class="v">SÉRIE ${esc(serie)}</div>
      </div>
      <div class="box">
        <div class="t">Chave de acesso</div>
        <div class="chave">${esc(chaveFmt(chave))}</div>
        <div class="t" style="margin-top:4px">Protocolo de autorização</div>
        <div class="v">${esc(protocolo)}${dhRecbto ? ` · ${esc(dataBR(dhRecbto))}` : ''}</div>
        ${cStat ? `<div class="t">${esc(cStat)} — ${esc(xMotivo)}</div>` : ''}
        <div class="t" style="margin-top:4px">Consulta de autenticidade: www.nfe.fazenda.gov.br/portal</div>
      </div>
    </div>
    <div class="grid g3">
      <div class="box"><div class="t">Natureza da operação</div><div class="v">${esc(natOp)}</div></div>
      <div class="box"><div class="t">Data de emissão</div><div class="v">${esc(dataBR(dhEmi))}</div></div>
      <div class="box"><div class="t">Data de saída/entrada</div><div class="v">${esc(dataBR(dhSaiEnt))}</div></div>
    </div>

    <h3>Destinatário / Remetente</h3>
    <div class="grid g3">
      <div class="box" style="grid-column: span 2"><div class="t">Nome / Razão social</div><div class="v">${esc(txt(dest, 'xNome'))}</div></div>
      <div class="box"><div class="t">CNPJ / CPF</div><div class="v">${esc(cnpjFmt(txt(dest, 'CNPJ') || txt(dest, 'CPF')))}</div></div>
      <div class="box" style="grid-column: span 2"><div class="t">Endereço</div><div class="v">${esc(dEnd.linha1)}${dEnd.bairro ? ` - ${esc(dEnd.bairro)}` : ''}</div></div>
      <div class="box"><div class="t">Inscrição estadual</div><div class="v">${esc(txt(dest, 'IE'))}</div></div>
      <div class="box"><div class="t">Município</div><div class="v">${esc(dEnd.mun)}</div></div>
      <div class="box"><div class="t">UF</div><div class="v">${esc(dEnd.uf)}</div></div>
      <div class="box"><div class="t">CEP / Fone</div><div class="v">${esc(dEnd.cep)}${dEnd.fone ? ` · ${esc(dEnd.fone)}` : ''}</div></div>
    </div>

    ${linhasDup}

    <h3>Cálculo do imposto</h3>
    <div class="grid g5">
      <div class="box"><div class="t">Base de cálculo do ICMS</div><div class="v">${brl(txt(total, 'vBC'))}</div></div>
      <div class="box"><div class="t">Valor do ICMS</div><div class="v">${brl(txt(total, 'vICMS'))}</div></div>
      <div class="box"><div class="t">BC ICMS ST</div><div class="v">${brl(txt(total, 'vBCST'))}</div></div>
      <div class="box"><div class="t">Valor ICMS ST</div><div class="v">${brl(txt(total, 'vST'))}</div></div>
      <div class="box"><div class="t">Valor total dos produtos</div><div class="v">${brl(txt(total, 'vProd'))}</div></div>
      <div class="box"><div class="t">Frete</div><div class="v">${brl(txt(total, 'vFrete'))}</div></div>
      <div class="box"><div class="t">Seguro</div><div class="v">${brl(txt(total, 'vSeg'))}</div></div>
      <div class="box"><div class="t">Desconto</div><div class="v">${brl(txt(total, 'vDesc'))}</div></div>
      <div class="box"><div class="t">Outras despesas</div><div class="v">${brl(txt(total, 'vOutro'))}</div></div>
      <div class="box"><div class="t">Valor do IPI</div><div class="v">${brl(txt(total, 'vIPI'))}</div></div>
      <div class="box" style="grid-column: span 5; background:#f7f7f7"><div class="t">Valor total da nota</div><div class="v" style="font-size:13px">R$ ${brl(txt(total, 'vNF'))}</div></div>
    </div>

    <h3>Transportador / Volumes</h3>
    <div class="grid g4">
      <div class="box" style="grid-column: span 2"><div class="t">Nome / Razão social</div><div class="v">${esc(txt(transportadora, 'xNome'))}</div></div>
      <div class="box"><div class="t">Frete por conta</div><div class="v">${esc(MOD_FRETE[modFrete] || modFrete || '')}</div></div>
      <div class="box"><div class="t">CNPJ / CPF</div><div class="v">${esc(cnpjFmt(txt(transportadora, 'CNPJ') || txt(transportadora, 'CPF')))}</div></div>
      <div class="box"><div class="t">Quantidade</div><div class="v">${esc(txt(vol, 'qVol'))}</div></div>
      <div class="box"><div class="t">Espécie</div><div class="v">${esc(txt(vol, 'esp'))}</div></div>
      <div class="box"><div class="t">Peso bruto</div><div class="v">${esc(txt(vol, 'pesoB'))}</div></div>
      <div class="box"><div class="t">Peso líquido</div><div class="v">${esc(txt(vol, 'pesoL'))}</div></div>
    </div>

    <h3>Dados dos produtos / serviços (${itens.length})</h3>
    <table class="itens">
      <thead><tr>
        <th>Código</th><th>Descrição</th><th>NCM</th><th>CST</th><th>CFOP</th><th>Un</th><th>Qtd</th><th>V. unit.</th><th>V. total</th><th>BC ICMS</th><th>V. ICMS</th><th>V. IPI</th><th>% ICMS</th><th>% IPI</th>
      </tr></thead>
      <tbody>${linhasItens}</tbody>
    </table>

    <h3>Dados adicionais</h3>
    <div class="box"><div class="t">Informações complementares</div><div class="adic">${esc(txt(infAdic, 'infCpl'))}${txt(infAdic, 'infAdFisco') ? `\n${esc(txt(infAdic, 'infAdFisco'))}` : ''}</div></div>
    <div class="rodape">DANFE gerado pelo HeadCoach a partir do XML autorizado da NF-e. Chave: ${esc(chave)}</div>
  </div>
</body></html>`;
}

export default { gerarHtmlDanfeDeXml };
