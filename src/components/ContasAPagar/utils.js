// Funções utilitárias compartilhadas entre componentes do ContasAPagar

// Função para criar Date object sem problemas de fuso horário
export const criarDataSemFusoHorario = (dataString) => {
  if (!dataString) return null;
  if (dataString.includes('T')) {
    const dataPart = dataString.split('T')[0];
    const [ano, mes, dia] = dataPart.split('-');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }
  if (dataString.includes('/')) {
    const [dia, mes, ano] = dataString.split('/');
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }
  return new Date(dataString);
};

// Função para formatar data
export const formatarData = (data) => {
  if (!data) return '';
  if (data.includes('T')) {
    const dataPart = data.split('T')[0];
    const [ano, mes, dia] = dataPart.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return data;
};

// Formatar CNPJ (14 dígitos) ou CPF (11 dígitos); outros tamanhos ficam como vieram
export const formatarCpfCnpj = (doc) => {
  const digitos = String(doc || '').replace(/\D/g, '');
  if (digitos.length === 14) {
    return digitos.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }
  if (digitos.length === 11) {
    return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return digitos;
};

// ─── Ocultar faturas de banco emitidas antes do corte ───
// Pedido do Yago (28/10/2026): o Contas a Pagar não deve mostrar nada ligado a
// banco (empréstimo, financiamento, cartão de crédito, juros financeiros,
// consórcio, FGI, capital de giro, nomes de bancos) com EMISSÃO anterior a
// 20/10/2026. É só ocultação de tela: nada é alterado/cancelado no TOTVS, e
// faturas de banco emitidas a partir do corte continuam aparecendo.
export const OCULTAR_BANCO_EMISSAO_ANTES = '2026-10-20';

const normalizarTexto = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Termos longos casam como substring (seguros contra falso positivo).
const BANCO_TERMOS = [
  'emprestimo',
  'financiamento',
  'cartao de credito',
  'cartao credito',
  'juros financeir',
  'consorcio',
  'capital de giro',
  'banco',
  'itau',
  'santander',
  'bradesco',
  'sicredi',
  'banco do nordeste',
  'caixa economica',
];
// Abreviações curtas só casam como palavra inteira (evita pegar "abbott" etc.).
const BANCO_PALAVRAS = /\b(bb|bnb|fgi)\b/;

// Identifica se a fatura é de banco/crédito pelo nome do fornecedor + despesa.
export const isFaturaBanco = (item) => {
  const texto = normalizarTexto(
    `${item?.nm_fornecedor || ''} ${item?.ds_despesaitem || ''} ${item?.nm_razaosocial_fornecedor || ''}`,
  );
  if (!texto.trim()) return false;
  if (BANCO_PALAVRAS.test(texto)) return true;
  return BANCO_TERMOS.some((t) => texto.includes(t));
};

// true = esconder o item (é de banco E emitido antes do corte).
export const deveOcultarFaturaBanco = (item) => {
  if (!isFaturaBanco(item)) return false;
  const emissao = item?.dt_emissao ? String(item.dt_emissao).split('T')[0] : '';
  if (!emissao) return false; // sem data de emissão: não oculta (conservador)
  return emissao < OCULTAR_BANCO_EMISSAO_ANTES;
};

// ─── Ocultar despesas de PRODUÇÃO (só na Consulta do Contas a Pagar) ───
// Pedido do Yago (29/10/2026): na tela Contas a Pagar - Consulta não mostrar as
// despesas de produção — 1001 AVIAMENTOS, 1002 COMPRA DE MATERIA PRIMA, 1003
// COMPRA DE PRODUTOS PRONTOS, 1005 SERVICO DE INDUSTRIALIZACAO, 1006 DEFEITOS DE
// PRODUCAO — EXCETO 1004 FRETE DE PRODUCAO, que continua aparecendo. Só tela:
// nada muda no TOTVS, e as Renegociações (tela própria) seguem mostrando tudo.
export const DESPESAS_PRODUCAO_OCULTAR = new Set(['1001', '1002', '1003', '1005', '1006']);

export const deveOcultarDespesaProducao = (item) => {
  const cod = String(item?.cd_despesaitem ?? '').replace(/\D/g, '');
  return DESPESAS_PRODUCAO_OCULTAR.has(cod);
};

// Determinar status da conta baseado nos dados
export const getStatusFromData = (item) => {
  // Conciliado como PAGO na Liberação de Pagamento, mesmo que o TOTVS ainda
  // não tenha a baixa (dt_liq vazio). Ver cruzamento em ContasAPagar.jsx.
  if (item._pagoLiberacao) {
    return 'Pago';
  }
  if (item.dt_liq) {
    return 'Pago';
  }
  if (item.dt_vencimento) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = criarDataSemFusoHorario(item.dt_vencimento);
    const diasParaVencer = Math.ceil(
      (vencimento - hoje) / (1000 * 60 * 60 * 24),
    );
    if (vencimento < hoje) return 'Vencido';
    if (diasParaVencer >= 0 && diasParaVencer <= 7) return 'Próxima a Vencer';
    return 'A Vencer';
  }
  if (item.tp_situacao) {
    switch (item.tp_situacao.toString()) {
      case '1':
      case 'P':
        return 'Pago';
      case '2':
      case 'V':
        return 'Vencido';
      case '3':
      case 'A':
        return 'A Vencer';
      default:
        return 'Pendente';
    }
  }
  return 'Pendente';
};

export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'pago':
    case 'liquidado':
      return 'bg-green-100 text-green-800';
    case 'vencido':
    case 'atrasado':
      return 'bg-red-100 text-red-800';
    case 'a vencer':
    case 'vencendo':
      return 'bg-yellow-100 text-yellow-800';
    case 'pendente':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusIcon = (status) => {
  // Returns icon class info - components will render the icon
  switch (status?.toLowerCase()) {
    case 'pago':
    case 'liquidado':
      return 'green';
    case 'vencido':
    case 'atrasado':
      return 'red';
    case 'a vencer':
    case 'vencendo':
      return 'yellow';
    case 'pendente':
      return 'blue';
    default:
      return 'gray';
  }
};

// Função para aplicar filtro mensal e por dia
export const aplicarFiltroMensal = (dados, filtro, diaFiltro = null) => {
  return dados.filter((item) => {
    const dataVencimento = item.dt_vencimento;
    if (!dataVencimento) return false;
    const data = criarDataSemFusoHorario(dataVencimento);
    if (!data) return false;
    const mes = data.getMonth() + 1;
    const dia = data.getDate();
    if (filtro === 'ANO') return true;
    const mesesMap = {
      JAN: 1,
      FEV: 2,
      MAR: 3,
      ABR: 4,
      MAI: 5,
      JUN: 6,
      JUL: 7,
      AGO: 8,
      SET: 9,
      OUT: 10,
      NOV: 11,
      DEZ: 12,
    };
    const mesDoFiltro = mesesMap[filtro];
    if (mesDoFiltro) {
      if (diaFiltro !== null) return mes === mesDoFiltro && dia === diaFiltro;
      return mes === mesDoFiltro;
    }
    return true;
  });
};

// Função para agrupar dados idênticos
export const agruparDadosIdenticos = (dados) => {
  const grupos = new Map();

  dados.forEach((item) => {
    const chave = `${item.cd_fornecedor}|${item.nm_fornecedor}|${item.nr_duplicata}|${item.nr_parcela}|${item.cd_empresa}|${item.dt_emissao}|${item.dt_vencimento}|${item.dt_entrada}|${item.dt_liq}|${item.tp_situacao}|${item.tp_previsaoreal}|${item.vl_duplicata}|${item.vl_juros}|${item.vl_acrescimo}|${item.vl_desconto}|${item.vl_pago}|${item.cd_despesaitem}|${item.cd_ccusto}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        item: item,
        observacoes: [],
        situacoes: [],
        datasEmissao: [],
        datasVencimento: [],
        datasEntrada: [],
        datasLiquidacao: [],
        rateios: [],
        quantidade: 0,
      });
    }

    const grupo = grupos.get(chave);
    grupo.quantidade += 1;

    if (item.vl_rateio && !grupo.rateios.includes(item.vl_rateio)) {
      grupo.rateios.push(item.vl_rateio);
    }
    if (item.ds_observacao && !grupo.observacoes.includes(item.ds_observacao)) {
      grupo.observacoes.push(item.ds_observacao);
    }
    if (item.tp_situacao && !grupo.situacoes.includes(item.tp_situacao)) {
      grupo.situacoes.push(item.tp_situacao);
    }
    if (item.tp_previsaoreal && !grupo.previsoes) {
      grupo.previsoes = [];
    }
    if (
      item.tp_previsaoreal &&
      !grupo.previsoes?.includes(item.tp_previsaoreal)
    ) {
      grupo.previsoes.push(item.tp_previsaoreal);
    }
    if (item.dt_emissao && !grupo.datasEmissao.includes(item.dt_emissao)) {
      grupo.datasEmissao.push(item.dt_emissao);
    }
    if (
      item.dt_vencimento &&
      !grupo.datasVencimento.includes(item.dt_vencimento)
    ) {
      grupo.datasVencimento.push(item.dt_vencimento);
    }
    if (item.dt_entrada && !grupo.datasEntrada.includes(item.dt_entrada)) {
      grupo.datasEntrada.push(item.dt_entrada);
    }
    if (item.dt_liq && !grupo.datasLiquidacao.includes(item.dt_liq)) {
      grupo.datasLiquidacao.push(item.dt_liq);
    }
  });

  return Array.from(grupos.values()).map((grupo) => {
    let situacaoFinal = grupo.item.tp_situacao;
    if (grupo.situacoes.length > 1) {
      if (grupo.situacoes.includes('C')) situacaoFinal = 'C';
      else if (grupo.situacoes.includes('N')) situacaoFinal = 'N';
    }

    let previsaoFinal = grupo.item.tp_previsaoreal;
    if (grupo.previsoes && grupo.previsoes.length > 1) {
      if (grupo.previsoes.includes('R')) previsaoFinal = 'R';
      else if (grupo.previsoes.includes('P')) previsaoFinal = 'P';
      else if (grupo.previsoes.includes('C')) previsaoFinal = 'C';
    }

    const sortDates = (arr) =>
      arr.length > 0 ? arr.sort((a, b) => new Date(b) - new Date(a))[0] : null;

    return {
      ...grupo,
      item: {
        ...grupo.item,
        tp_situacao: situacaoFinal,
        tp_previsaoreal: previsaoFinal,
        dt_emissao: sortDates(grupo.datasEmissao) || grupo.item.dt_emissao,
        dt_vencimento:
          sortDates(grupo.datasVencimento) || grupo.item.dt_vencimento,
        dt_entrada: sortDates(grupo.datasEntrada) || grupo.item.dt_entrada,
        dt_liq: sortDates(grupo.datasLiquidacao) || grupo.item.dt_liq,
      },
    };
  });
};

// Estilos Tailwind compartilhados para tabelas
export const TABLE_CLASSES =
  'w-full border-collapse [&_th]:border-r [&_th]:border-gray-100 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-100 [&_td:last-child]:border-r-0 [&_th]:break-words [&_th]:whitespace-normal [&_th]:text-[10px] [&_th]:leading-tight [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:break-words [&_td]:whitespace-normal [&_td]:text-[11px] [&_td]:leading-tight';

export const TABLE_HEADER_CLASSES = 'bg-[#000638] text-white';

export const getStickyColStyle = (
  isHeader = false,
  isSelected = false,
  isEven = false,
) => ({
  width: '30px',
  minWidth: '30px',
  position: 'sticky',
  left: 0,
  zIndex: isHeader ? 20 : 10,
  background: isHeader
    ? '#000638'
    : isSelected
      ? '#dbeafe'
      : isEven
        ? '#fafafa'
        : '#ffffff',
  borderRight: isHeader ? '2px solid #374151' : '2px solid #e5e7eb',
  boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
});
