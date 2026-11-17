// Cupom fiscal (bobina) e CUPOM DE TROCA de uma venda do PDV Crosby, a partir
// da nota — usado no resultado da venda e no detalhe da transação
// (HeadCoach › Transações). Yago, 17/11/2026.
import { API_BASE_URL } from '../config/constants';
import { imprimirDocumento, gerarHtmlCupomTroca, abrirImpressao } from './documentoFiscalHtml';

const diaRecife = (iso) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date(iso || Date.now()));

/** { nota (com o QR Code), venda (com itens e pagamentos), emitente } */
export async function carregarNotaCompleta(notaId) {
  const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/notas/${notaId}`);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.success) throw new Error(j?.message || 'Não consegui abrir a nota');
  return j.data;
}

/** Cria o cupom de troca da venda — ou devolve o que já existe (uma venda = um cupom). */
export async function criarCupomTroca(venda) {
  const r = await fetch(`${API_BASE_URL}/api/pdv-crosby/cupons-troca`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      empresa: venda.empresa,
      transacaoCode: venda.id,
      transacaoDate: diaRecife(venda.criado_em),
      total: venda.total,
      clienteCode: venda.cliente_code || null,
      clienteNome: venda.cliente_nome || null,
      vendedorCode: venda.vendedor_code || null,
      vendedorNome: venda.vendedor_nome || null,
      itens: (venda.itens || []).map((i) => ({ productCode: i.product_code, name: i.nome, quantity: i.quantidade })),
      por: venda.criado_por || null,
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.success) throw new Error(j?.message || 'Cupom de troca não gerado');
  return j.data;
}

export function imprimirCupomTroca(cupom, empresaNome) {
  abrirImpressao(gerarHtmlCupomTroca({ cupom, empresaNome: empresaNome || null }));
}

/** Imprime a nota como CUPOM (bobina de 80 mm), igual à hora da venda. */
export async function imprimirCupomFiscalDaNota(notaId) {
  imprimirDocumento(await carregarNotaCompleta(notaId));
}

/** Gera (se ainda não houver) e imprime o cupom de troca da venda dessa nota. */
export async function imprimirCupomTrocaDaNota(notaId) {
  const d = await carregarNotaCompleta(notaId);
  if (d.venda?.tipo_venda === 'troca') throw new Error('Troca não tem cupom de troca');
  if (d.nota?.status !== 'autorizada') throw new Error('O cupom de troca só sai com a nota autorizada');
  const cupom = await criarCupomTroca(d.venda);
  imprimirCupomTroca(cupom, d.emitente?.xFant || d.venda?.empresa_nome);
  return cupom;
}
