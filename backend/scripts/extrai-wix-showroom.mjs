import 'dotenv/config';
import supabase from '../config/supabase.js';
import * as XLSX from 'xlsx';

const INI = process.argv[2] || '2026-07-01T00:00:00Z';
const FIM = process.argv[3] || '2026-07-17T00:00:00Z';
const OUT = process.argv[4] || 'C:/Users/teccr/Downloads/showroom-pedidos-01a16-07-2026.xlsx';

// 1) Pedidos no período (UTC, igual à tela)
const { data: pedidos, error } = await supabase
  .from('wix_pedidos')
  .select('*')
  .gte('criado_em', INI)
  .lt('criado_em', FIM)
  .order('numero', { ascending: false });
if (error) { console.log('ERRO pedidos:', error.message); process.exit(1); }

// 2) Itens por pedido (peças = soma qtd, produtos = nº linhas)
const ids = pedidos.map((p) => p.id);
const itensMap = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const { data: its } = await supabase
    .from('wix_pedido_items')
    .select('pedido_id, quantidade')
    .in('pedido_id', chunk);
  for (const it of its || []) {
    const cur = itensMap.get(it.pedido_id) || { pecas: 0, produtos: 0 };
    cur.pecas += Number(it.quantidade) || 0;
    cur.produtos += 1;
    itensMap.set(it.pedido_id, cur);
  }
}

const PAG = { PAID: 'Pago', NOT_PAID: 'Não pago', PARTIALLY_PAID: 'Parcial', PENDING: 'Pendente', REFUNDED: 'Estornado' };
const ST = { APPROVED: 'Aprovado', INITIALIZED: 'Iniciado', CANCELED: 'Cancelado', PENDING: 'Pendente' };
const fmtData = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

// 3) Monta linhas
const linhas = pedidos.map((p) => {
  const it = itensMap.get(p.id) || { pecas: 0, produtos: 0 };
  const nome = [p.buyer_nome, p.buyer_sobrenome].filter(Boolean).join(' ');
  return {
    Pedido: `#${p.numero}`,
    Cliente: nome,
    'E-mail': p.buyer_email || '',
    Telefone: p.buyer_telefone || '',
    CPF: p.buyer_cpf || '',
    Status: ST[p.status] || p.status || '',
    Pagamento: PAG[p.payment_status] || p.payment_status || '',
    Vendedor: p.vendedor || '',
    'Cliente TOTVS': p.cliente_totvs_nome
      ? `${p.cliente_totvs_code || ''} ${p.cliente_totvs_nome}`.trim()
      : 'Não vinculado',
    Classificação: p.cliente_classificacao || '',
    Data: fmtData(p.criado_em),
    Peças: it.pecas,
    Produtos: it.produtos,
    Total: Number(p.total) || 0,
    Subtotal: Number(p.subtotal) || 0,
    Desconto: Number(p.desconto) || 0,
    Frete: Number(p.frete) || 0,
  };
});

const totalGeral = linhas.reduce((a, l) => a + l.Total, 0);
const totalPecas = linhas.reduce((a, l) => a + l.Peças, 0);
const ticket = linhas.length ? totalGeral / linhas.length : 0;

// 4) Excel
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Pedidos Showroom');
const resumo = [
  { Métrica: 'Pedidos', Valor: linhas.length },
  { Métrica: 'Faturamento', Valor: Number(totalGeral.toFixed(2)) },
  { Métrica: 'Ticket médio', Valor: Number(ticket.toFixed(2)) },
  { Métrica: 'Total de peças', Valor: totalPecas },
  { Métrica: 'Período', Valor: `${INI} a ${FIM} (UTC)` },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo');
XLSX.writeFile(wb, OUT);

console.log(`Pedidos: ${linhas.length} | Faturamento: R$ ${totalGeral.toFixed(2)} | Ticket médio: R$ ${ticket.toFixed(2)} | Peças: ${totalPecas}`);
console.log(`Excel: ${OUT}`);
