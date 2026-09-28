// Regras de forma de pagamento dos títulos de contas a receber.
// Espelha o mapeamento de tp_documento do TOTVS usado no Dashboard de Contas
// a Receber, incluindo o desmembramento de "Fatura Banco Safra".

export const tiposDocumento = {
  1: 'Fatura',
  2: 'Cheque',
  3: 'Dinheiro',
  4: 'Cartão Crédito',
  5: 'Cartão Débito',
  6: 'Nota Débito',
  7: 'TEF',
  8: 'Cheque TEF',
  9: 'Troco',
  10: 'Adiantamento',
  13: 'Vale',
  14: 'Nota Promissória',
  15: 'Cheque Garantido',
  16: 'TED/DOC',
  17: 'Pré-Autorização TEF',
  18: 'Cheque Presente',
  19: 'TEF/TECBAN',
  20: 'CREDEV',
  21: 'Cartão Próprio',
  22: 'TEF/HYPERCARD',
  23: 'Bônus Desconto',
  25: 'Voucher',
  26: 'PIX',
  27: 'PicPay',
  28: 'Ame',
  29: 'Mercado Pago',
  30: 'Marketplace',
  31: 'Outro Documento',
};

export const converterTipoDocumento = (numero) =>
  tiposDocumento[numero] || numero || 'Não informado';

export const isBancoSafraPortador = (item) => {
  const portador = (item.nm_portador || '').toUpperCase();
  const codigoPortador = Number(item.cd_portador || 0);
  return codigoPortador === 422 || portador.includes('BANCO SAFRA');
};

// Fatura liquidada pelo Banco Safra: desconsiderada no Fluxo de Caixa.
export const ehFaturaBancoSafra = (item) =>
  Number(item.tp_documento) === 1 && isBancoSafraPortador(item);

// ---------------------------------------------------------------------------
// PIX que gera adiantamento
//
// O PIX (tp_documento 26) se divide em dois blocos pelo portador:
//   cd_portador 1020 "TITULO EM CARTEIRA" -> PIX puro
//   cd_portador 1010 "PIX"                -> gera um adiantamento (tp_documento
//                                            10) com o MESMO dinheiro
// O par tem vl_pago(adiantamento) = vl_pago(PIX) + 0,79 (a tarifa fixa do PIX,
// gravada como desconto em 100% dos títulos de PIX).
//
// Estudo de setembro/2026 (314 PIX, 123 adiantamentos): somar os dois blocos
// duplica R$ 43.087,48 — 30% do total das duas formas. Casar registro a
// registro não é confiável: o par cai em outra empresa (12 de 92), em outro
// dia (14 de 92), às vezes vários PIX viram um adiantamento ou o contrário, e
// nr_fatura/tp_baixa não discriminam. O portador discrimina: 1010 equivale
// exatamente a tp_faturamento 6 (368 de 368 títulos em ago-out/2026).
//
// Regra adotada: todo PIX fica na linha de PIX. O adiantamento que é eco de um
// PIX é que sai da linha de Adiantamento — ver parearPixComAdiantamento.
// ---------------------------------------------------------------------------
export const CD_PORTADOR_PIX_ADIANTAMENTO = 1010;
export const TARIFA_PIX = 0.79;

export const ehPixQueGerouAdiantamento = (item) =>
  Number(item.tp_documento) === 26 &&
  Number(item.cd_portador) === CD_PORTADOR_PIX_ADIANTAMENTO;

// Nota Promissória (14) é PIX pago por fora do TOTVS: conta como PIX.
export const getFormaPagamentoLabel = (item) => {
  const tp = Number(item.tp_documento);
  if (tp === 26 || tp === 14) return 'PIX';
  return converterTipoDocumento(item.tp_documento);
};

// Forma como o TOTVS classificou o título, sem os agrupamentos acima. Usada no
// detalhe, para não perder de vista o que é PIX e o que é promissória.
export const getFormaOriginalLabel = (item) =>
  converterTipoDocumento(item.tp_documento);

// ---------------------------------------------------------------------------
// Pareamento PIX -> Adiantamento
//
// Casa cada PIX de portador 1010 com o adiantamento que ele gerou, usando a
// única relação que se confirmou nos dados: mesmo cliente e
//   vl_pago(adiantamento) == vl_pago(PIX) + 0,79
// Entre os candidatos, vence o de data de liquidação mais próxima. O par pode
// estar em outra empresa e alguns dias depois, por isso nem empresa nem data
// entram no critério.
//
// O adiantamento pareado é o eco do PIX: sai da planilha, para o mesmo
// dinheiro não contar duas vezes. PIX sem par não remove nada.
// ---------------------------------------------------------------------------
export const parearPixComAdiantamento = (itens) => {
  const adiantamentoDoPix = new Map(); // item PIX -> item adiantamento
  const ecoDePix = new Map(); // item adiantamento -> item PIX

  const porCliente = new Map();
  itens.forEach((i) => {
    if (Number(i.tp_documento) !== 10) return;
    const k = String(i.cd_cliente);
    if (!porCliente.has(k)) porCliente.set(k, []);
    porCliente.get(k).push(i);
  });

  const emMs = (v) => {
    const d = parseDateNoTZ(v);
    return d ? d.getTime() : 0;
  };
  const usados = new Set();

  itens
    .filter(ehPixQueGerouAdiantamento)
    .sort((a, b) => emMs(a.dt_liq) - emMs(b.dt_liq))
    .forEach((pix) => {
      const alvo = (parseFloat(pix.vl_pago) || 0) + TARIFA_PIX;
      const candidatos = (porCliente.get(String(pix.cd_cliente)) || [])
        .filter(
          (a) =>
            !usados.has(a) &&
            Math.abs((parseFloat(a.vl_pago) || 0) - alvo) < 0.011,
        )
        .sort(
          (x, y) =>
            Math.abs(emMs(x.dt_liq) - emMs(pix.dt_liq)) -
            Math.abs(emMs(y.dt_liq) - emMs(pix.dt_liq)),
        );
      if (!candidatos.length) return;
      usados.add(candidatos[0]);
      adiantamentoDoPix.set(pix, candidatos[0]);
      ecoDePix.set(candidatos[0], pix);
    });

  return { adiantamentoDoPix, ecoDePix };
};

// Lista estática para o <FiltroFormaPagamento />, disponível antes da busca.
export const listaFormasPagamento = () =>
  Object.entries(tiposDocumento).map(([codigo, descricao]) => ({
    codigo,
    descricao,
  }));

export const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

// statusList do TOTVS, conforme o filtro de situação da rota
// /accounts-receivable/filter no backend.
export const situacoesTitulo = {
  1: 'Normal',
  2: 'Devolvido',
  3: 'Cancelado',
  4: 'Quebrada',
};

export const rotuloSituacao = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '-';
  return situacoesTitulo[Number(valor)] || String(valor);
};

// dischargeType. Não existe tabela completa nem no TOTVS exposto nem aqui —
// só estes três códigos aparecem nomeados no restante do sistema. Os demais
// são mostrados pelo número, em vez de receberem um rótulo inventado.
export const tiposBaixa = {
  0: 'Em aberto',
  9: 'Renegociação',
  14: 'Operadora de crédito',
};

export const rotuloTipoBaixa = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '-';
  const n = Number(valor);
  if (Number.isNaN(n)) return String(valor);
  return tiposBaixa[n] ? `${n} — ${tiposBaixa[n]}` : String(n);
};

// Datas do TOTVS chegam como 'YYYY-MM-DD...' — parse local para não deslocar
// o dia por fuso horário.
export const parseDateNoTZ = (isoDate) => {
  if (!isoDate) return null;
  try {
    const str = String(isoDate).substring(0, 10);
    const [y, m, d] = str.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  } catch {
    return null;
  }
};
