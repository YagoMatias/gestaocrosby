// Geração do HTML de impressão dos documentos fiscais emitidos pelo PDV Crosby:
//  - DANFE NFC-e (cupom 80mm, com QR Code)
//  - DANFE NF-e simplificado (A4)
// Abre em nova janela e dispara window.print().

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const fmtCnpj = (c) =>
  String(c || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtCpf = (c) =>
  String(c || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const fmtChave = (k) => String(k || '').replace(/(\d{4})(?=\d)/g, '$1 ');
const fmtData = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('pt-BR', { timeZone: 'America/Recife' });
};

const FORMAS = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  credito_loja: 'Crédito loja',
  vale_troca: 'Vale troca',
};

function homologacaoBanner(nota) {
  return Number(nota.ambiente) === 2
    ? '<div class="hom">EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL</div>'
    : '';
}

export function gerarHtmlCupomNFCe({ nota, venda, emitente }) {
  const itens = venda.itens || [];
  const pags = venda.pagamentos || [];
  const troco = pags.reduce((s, p) => s + Number(p.troco || 0), 0);
  const end = emitente?.endereco || {};
  const linhasItens = itens
    .map(
      (i, idx) => `
      <tr>
        <td class="n">${idx + 1}</td>
        <td colspan="4" class="desc">${esc(i.nome)}<br/><span class="cod">cód. ${esc(i.product_code)}${i.sku ? ' · ' + esc(i.sku) : ''}</span></td>
      </tr>
      <tr class="vals">
        <td></td>
        <td class="r">${Number(i.quantidade)} ${esc(i.unidade || 'UN')}</td>
        <td class="r">x ${fmtBRL(i.valor_unit)}</td>
        <td class="r">${Number(i.desconto_unit) > 0 ? '-' + fmtBRL(Number(i.desconto_unit) * Number(i.quantidade)) : ''}</td>
        <td class="r b">${fmtBRL(i.total)}</td>
      </tr>`,
    )
    .join('');
  const linhasPag = pags
    .map(
      (p) => `<div class="row"><span>${esc(FORMAS[p.forma] || p.forma)}${p.parcelas > 1 ? ` ${p.parcelas}x` : ''}${p.nsu ? ` NSU ${esc(p.nsu)}` : ''}${p.autorizacao ? ` AUT ${esc(p.autorizacao)}` : ''}</span><span>${fmtBRL(p.valor)}</span></div>`,
    )
    .join('');
  const consumidor = venda.cliente_cpf_cnpj
    ? `${venda.cliente_cpf_cnpj.length === 14 ? 'CNPJ ' + fmtCnpj(venda.cliente_cpf_cnpj) : 'CPF ' + fmtCpf(venda.cliente_cpf_cnpj)}${venda.cliente_nome ? ' — ' + esc(venda.cliente_nome) : ''}`
    : 'CONSUMIDOR NÃO IDENTIFICADO';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>NFC-e ${nota.numero}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: "Courier New", monospace; font-size: 11px; width: 74mm; margin: 0 auto; color: #000; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
  h1 { font-size: 13px; margin: 0; } .small { font-size: 9.5px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
  td.n { width: 14px; } td.desc { font-size: 10.5px; } .cod { font-size: 9px; color: #333; } tr.vals td { font-size: 10.5px; }
  .row { display: flex; justify-content: space-between; }
  .tot { font-size: 14px; }
  .hom { border: 2px solid #000; padding: 3px; text-align: center; font-weight: bold; margin: 4px 0; font-size: 10px; }
  .chave { font-size: 10px; word-break: break-all; }
  img.qr { width: 42mm; height: 42mm; display: block; margin: 4px auto; }
  @media screen { body { padding: 10px; } }
</style></head><body>
  <div class="c">
    <h1>${esc(emitente?.xFant || venda.empresa_nome || 'CROSBY')}</h1>
    <div class="small">${esc(emitente?.xNome || '')}</div>
    <div class="small">CNPJ ${fmtCnpj(emitente?.cnpj || nota.cnpj_emitente)} · IE ${esc(emitente?.ie || '')}</div>
    <div class="small">${esc([end.xLgr, end.nro, end.xCpl].filter(Boolean).join(', '))}</div>
    <div class="small">${esc([end.xBairro, end.xMun, end.UF].filter(Boolean).join(' - '))}${end.CEP ? ' · CEP ' + esc(end.CEP) : ''}</div>
  </div>
  <hr/>
  <div class="c b">DANFE NFC-e — Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>
  ${homologacaoBanner(nota)}
  <hr/>
  <table>
    <tr class="b small"><td>#</td><td colspan="4">DESCRIÇÃO · QTD · UN · VL UNIT · DESC · VL TOTAL</td></tr>
    ${linhasItens}
  </table>
  <hr/>
  <div class="row"><span>Qtd. total de itens</span><span>${venda.qtd_pecas}</span></div>
  <div class="row"><span>Subtotal</span><span>${fmtBRL(venda.subtotal)}</span></div>
  ${Number(venda.desconto) > 0 ? `<div class="row"><span>Descontos</span><span>-${fmtBRL(venda.desconto)}</span></div>` : ''}
  ${Number(venda.cashback_usado) > 0 ? `<div class="row"><span>Cashback utilizado (incluso nos descontos)</span><span>${fmtBRL(venda.cashback_usado)}</span></div>` : ''}
  <div class="row b tot"><span>VALOR A PAGAR</span><span>${fmtBRL(venda.total)}</span></div>
  <hr/>
  <div class="b">FORMA DE PAGAMENTO</div>
  ${linhasPag}
  ${troco > 0 ? `<div class="row"><span>Troco</span><span>${fmtBRL(troco)}</span></div>` : ''}
  <hr/>
  <div class="c small">Consulte pela chave de acesso em</div>
  <div class="c small b">${esc(nota.url_chave || 'www.nfe.fazenda.gov.br/portal')}</div>
  <div class="c chave">${fmtChave(nota.chave)}</div>
  <hr/>
  <div class="c small">${consumidor}</div>
  <div class="c small b">NFC-e nº ${nota.numero} · Série ${nota.serie} · ${fmtData(nota.dh_emissao)}</div>
  ${nota.protocolo ? `<div class="c small">Protocolo de autorização: ${esc(nota.protocolo)}<br/>${fmtData(nota.dh_autorizacao)}</div>` : ''}
  ${nota.qrDataUrl ? `<img class="qr" src="${nota.qrDataUrl}" alt="QR Code"/>` : ''}
  ${venda.vendedor_nome ? `<div class="c small">Vendedor: ${esc(venda.vendedor_nome)}</div>` : ''}
  <div class="c small">Venda HeadCoach #${venda.id}</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
</body></html>`;
}

export function gerarHtmlDanfeNFe({ nota, venda, emitente }) {
  const itens = venda.itens || [];
  const pags = venda.pagamentos || [];
  const end = emitente?.endereco || {};
  const devolucao = venda.tipo_venda === 'troca';
  const linhas = itens
    .map(
      (i) => `<tr>
        <td>${esc(i.product_code)}</td><td>${esc(i.nome)}</td><td class="c">${esc(i.ncm || '')}</td>
        <td class="c">${devolucao ? '1202' : '5102'}</td><td class="c">${esc(i.unidade || 'UN')}</td>
        <td class="r">${Number(i.quantidade)}</td><td class="r">${fmtBRL(i.valor_unit)}</td>
        <td class="r">${Number(i.desconto_unit) > 0 ? fmtBRL(Number(i.desconto_unit) * Number(i.quantidade)) : '-'}</td>
        <td class="r">${fmtBRL(i.total)}</td></tr>`,
    )
    .join('');
  const linhasPag = pags
    .map((p) => `<div>${esc(FORMAS[p.forma] || p.forma)}${p.parcelas > 1 ? ` ${p.parcelas}x` : ''}: <b>${fmtBRL(p.valor)}</b>${p.nsu ? ` · NSU ${esc(p.nsu)}` : ''}${p.autorizacao ? ` · Aut. ${esc(p.autorizacao)}` : ''}</div>`)
    .join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>NF-e ${nota.numero}</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; margin: 0; }
  .box { border: 1px solid #000; padding: 4px 6px; margin-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .title { font-size: 16px; font-weight: bold; }
  .lbl { font-size: 8px; text-transform: uppercase; color: #333; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #000; padding: 2px 4px; } th { background: #eee; }
  .c { text-align: center; } .r { text-align: right; }
  .hom { border: 2px solid #000; padding: 4px; text-align: center; font-weight: bold; margin: 4px 0; }
  .chave { font-family: "Courier New", monospace; font-size: 12px; letter-spacing: 1px; }
</style></head><body>
  ${homologacaoBanner(nota)}
  <div class="box grid">
    <div>
      <div class="title">${esc(emitente?.xNome || venda.empresa_nome || '')}</div>
      <div>${esc([end.xLgr, end.nro, end.xCpl].filter(Boolean).join(', '))}</div>
      <div>${esc([end.xBairro, end.xMun, end.UF].filter(Boolean).join(' - '))} · CEP ${esc(end.CEP || '')}${end.fone ? ' · Fone ' + esc(end.fone) : ''}</div>
      <div>CNPJ ${fmtCnpj(emitente?.cnpj || nota.cnpj_emitente)} · IE ${esc(emitente?.ie || '')}</div>
    </div>
    <div>
      <div class="title">DANFE</div>
      <div>Documento Auxiliar da Nota Fiscal Eletrônica</div>
      <div><b>${devolucao ? '0 - ENTRADA' : '1 - SAÍDA'}</b></div>
      <div>Nº <b>${String(nota.numero).padStart(9, '0')}</b> · Série <b>${nota.serie}</b></div>
      <div class="lbl">Chave de acesso</div>
      <div class="chave">${fmtChave(nota.chave)}</div>
      <div class="lbl">Protocolo de autorização</div>
      <div>${esc(nota.protocolo || '—')} ${nota.protocolo ? '· ' + fmtData(nota.dh_autorizacao) : ''}</div>
    </div>
  </div>
  <div class="box">
    <div class="lbl">Natureza da operação</div>
    <div>${devolucao ? 'DEVOLUÇÃO DE VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS' : 'VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS'}</div>
    <div class="grid" style="margin-top:4px">
      <div><div class="lbl">Data de emissão</div><div>${fmtData(nota.dh_emissao)}</div></div>
      <div><div class="lbl">Ambiente</div><div>${Number(nota.ambiente) === 1 ? 'Produção' : 'Homologação'}</div></div>
    </div>
  </div>
  <div class="box">
    <div class="lbl">Destinatário / Remetente</div>
    <div><b>${esc(venda.cliente_nome || '')}</b> · ${venda.cliente_cpf_cnpj?.length === 14 ? 'CNPJ ' + fmtCnpj(venda.cliente_cpf_cnpj) : 'CPF ' + fmtCpf(venda.cliente_cpf_cnpj)}</div>
    ${venda.nf_referenciada ? `<div class="lbl" style="margin-top:3px">NF-e referenciada</div><div class="chave">${fmtChave(venda.nf_referenciada)}</div>` : ''}
  </div>
  <div class="box">
    <div class="lbl">Dados dos produtos</div>
    <table>
      <thead><tr><th>Código</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th>UN</th><th>Qtd</th><th>Vl. unit.</th><th>Desconto</th><th>Vl. total</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>
  <div class="box grid">
    <div>
      <div class="lbl">Totais</div>
      <div>Produtos: <b>${fmtBRL(venda.subtotal)}</b> · Descontos: <b>${fmtBRL(venda.desconto)}</b> · Total da nota: <b>${fmtBRL(venda.total)}</b></div>
    </div>
    <div>
      <div class="lbl">Pagamento</div>
      ${devolucao ? '<div>Sem pagamento (devolução)</div>' : linhasPag}
    </div>
  </div>
  <div class="box">
    <div class="lbl">Informações complementares</div>
    <div>Venda HeadCoach #${venda.id}${venda.vendedor_nome ? ' · Vendedor ' + esc(venda.vendedor_nome) : ''}. DANFE simplificado gerado pelo HeadCoach — o XML autorizado está disponível para download no PDV Crosby.</div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
</body></html>`;
}

export function abrirImpressao(html) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('O navegador bloqueou a janela de impressão. Libere pop-ups para este site.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function imprimirDocumento({ nota, venda, emitente }) {
  const html =
    Number(nota.modelo) === 65
      ? gerarHtmlCupomNFCe({ nota, venda, emitente })
      : gerarHtmlDanfeNFe({ nota, venda, emitente });
  abrirImpressao(html);
}
