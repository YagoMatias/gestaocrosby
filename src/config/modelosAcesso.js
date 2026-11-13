// ============================================================================
// Modelos de acesso por perfil/setor (Yago, 13/11/2026) — páginas que cada
// perfil recebe já configuradas. Usado no Gerenciador de Acessos (botões
// "Modelo") e no script da API scripts/aplicar-modelos-setores.mjs (mesma
// lista: se mudar aqui, mude lá).
// As empresas que cada um enxerga nas páginas do HeadCoach vêm da regra única
// da API (utils/empresasUsuario.js): REVENDA, MULTIMARCAS e EXPEDIÇÃO = 99 e
// 990; VAREJO = a loja vinculada no Painel Admin.
// ============================================================================

const BASE = ['/home', '/user-panel', '/headcoach/transacoes'];
const CAIXA = ['/headcoach/caixa/abertura', '/headcoach/caixa/contagem', '/headcoach/caixa/fechamento'];

export const MODELOS_ACESSO = [
  {
    id: 'revenda_multimarcas',
    nome: 'Revenda / Multimarcas / Franquia',
    setores: ['REVENDA', 'MULTIMARCAS'],
    paginas: [
      ...BASE,
      '/headcoach/saldos-clientes',
      // aba Multimarcas completa
      '/forecast-canal/multimarcas',
      '/crm-vendas',
      '/inadimplentes-multimarcas',
      '/minhas-solicitacoes-baixa',
      '/titulos-clientes',
      '/clientes-mtm',
      '/analise-credito-mtm',
      // aba Revenda completa
      '/forecast-canal/revenda',
      '/inadimplentes-revenda',
      // aba Franquias completa
      '/forecast-canal/franquias',
      '/ranking-compras-franquias',
      '/inadimplentes-franquias',
      '/estoque/expedicao-showroom',
    ],
  },
  {
    id: 'varejo',
    nome: 'Varejo',
    setores: ['VAREJO'],
    paginas: [
      ...BASE,
      ...CAIXA,
      // HeadCoach › Estoque (Recebimento de Transferência, Balanço RFID, Estoque)
      '/varejo/recebimento-mercadoria',
      '/balanco-rfid/arquivos',
      '/headcoach/estoque',
      // HeadCoach › Varejo
      '/tecnologia/pdv-crosby',
      '/ranking-faturamento',
    ],
  },
  {
    id: 'expedicao',
    nome: 'Expedição',
    setores: ['EXPEDICAO'],
    paginas: [
      ...BASE,
      '/headcoach/saldos-clientes',
      ...CAIXA,
      // HeadCoach › Expedição
      '/expedicao/pedidos-venda',
      '/expedicao/faturamento',
      '/transferencias-mercadoria',
      // Expedição Brejinho
      '/expedicao/brejinho/pedidos',
      '/expedicao/brejinho/faturamento',
    ],
  },
].map((m) => ({ ...m, paginas: [...new Set(m.paginas)] }));

const normSetor = (n) =>
  String(n || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();

/** Modelos que combinam com os setores do usuário (nomes dos setores). */
export function modelosDosSetores(nomesSetores = []) {
  const s = new Set(nomesSetores.map(normSetor));
  return MODELOS_ACESSO.filter((m) => m.setores.some((x) => s.has(x)));
}
