// BlueCard no PDV Crosby — chave do modelo de venda (Yago, 26/11/2026).
//
// false (agora): o PDV vende em BlueCard como antes — sem consultar o limite do
//   cliente e sem pedir a aprovação no app. O vendedor escolhe as parcelas, a
//   venda fecha na hora e o contas a receber gera as parcelas mensais de sempre.
// true: modelo novo, que espera o Felipe terminar a parte do BlueCard — limite no
//   painel do cliente, pedido de aprovação pelo app (10 minutos) e as parcelas com
//   os vencimentos que o cliente aceitou. O código continua todo aí; para voltar,
//   troque para true e gere uma versão nova do PDV (.exe).
//
// No servidor (routes/pdvCrosby.routes.js) a trava só liga com a variável de
// ambiente BLUECARD_PDV_EXIGIR_APROVACAO=true: deixe desligada enquanto isto for false.
export const BLUECARD_APROVACAO_PELO_APP = false;
