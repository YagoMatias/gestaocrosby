// Quem incluiu / baixou / conciliou, como aparece na tela (pedido da Titia e
// decisão do Yago, 24/11/2026): o que foi feito por IA, robô, rotina ou importação
// aparece só como "AUTOMAÇÃO" — sem apelidos. O valor original continua gravado
// no banco (rastro de auditoria) e fica no "title" do elemento.
const PADROES = [
  /^(theo|claude|jojo|bruce|veveto)\b/i, // agentes de IA
  /^bot\b/i, // robôs das contas fixas (Bot Cosern (WhatsApp)…)
  /^e-?mail\b/i, // leitores de e-mail (E-mail Alares…)
  /^importa[cç][aã]o\b/i, // Importação TOTVS
  /^concilia[cç][aã]o\b/i, // Conciliação HeadCoach / de aprovados / do extrato / pelo CSV…
  /\(concilia[cç][aã]o\)$/i, // baixa automática disparada por uma conciliação
  /^libera[cç][aã]o pago/i, // Liberação PAGO → conciliação
  /^automa[cç][aã]o\b/i,
  /\bjob\b/i,
];

export const ehAutomacao = (valor) => {
  const s = String(valor || '').trim();
  return !!s && PADROES.some((re) => re.test(s));
};

/** Texto de exibição: "AUTOMAÇÃO" para IA/robô/rotina; o nome da pessoa nos demais. */
export const autorExibicao = (valor) => (ehAutomacao(valor) ? 'AUTOMAÇÃO' : valor);
