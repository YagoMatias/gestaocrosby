import { supabase } from '../../lib/supabase';

// Pedido do Yago (28/10/2026): o TOTVS recebe a baixa com atraso, mas o
// pagamento já é conciliado na Liberação quase em D+1. Então, para cada título
// que o TOTVS ainda mostra em aberto (sem dt_liq), se ele estiver como PAGO na
// Liberação, marcamos como pago aqui também — com a data do pagamento e o
// rótulo "(PAGO - LIBERAÇÃO DE PAGAMENTO)" na coluna de status.
export const anotarPagosNaLiberacao = async (itens) => {
  const emAberto = itens.filter((i) => !i.dt_liq && i.nr_duplicata);
  if (emAberto.length === 0) return itens;

  const duplicatas = [...new Set(emAberto.map((i) => String(i.nr_duplicata)))];
  const pagos = [];
  const LOTE = 200;
  try {
    for (let i = 0; i < duplicatas.length; i += LOTE) {
      const fatia = duplicatas.slice(i, i + LOTE);
      const { data, error } = await supabase
        .from('pagamentos_liberacao')
        .select(
          'nr_duplicata, cd_empresa, nr_parcela, cd_fornecedor, dt_vencimento, vl_duplicata, dt_pagamento, pago_em',
        )
        .eq('status', 'PAGO')
        .in('nr_duplicata', fatia);
      if (error) throw error;
      pagos.push(...(data || []));
    }
  } catch (err) {
    // Se a Liberação não responder, segue sem o cruzamento (não quebra a tela).
    console.error('Cruzamento Liberação de Pagamento falhou:', err);
    return itens;
  }
  if (pagos.length === 0) return itens;

  const porDuplicata = new Map();
  for (const p of pagos) {
    const k = String(p.nr_duplicata);
    if (!porDuplicata.has(k)) porDuplicata.set(k, []);
    porDuplicata.get(k).push(p);
  }

  // null = campo ausente em um dos lados (compatível); true/false = igual/difere.
  const mesmo = (a, b) =>
    a == null || b == null || a === '' || b === ''
      ? null
      : String(a) === String(b);
  const casa = (item, p) => {
    if (mesmo(item.cd_empresa, p.cd_empresa) === false) return false;
    const forn = mesmo(item.cd_fornecedor, p.cd_fornecedor);
    const parc = mesmo(item.nr_parcela, p.nr_parcela);
    if (forn === false || parc === false) return false;
    // Precisa de ao menos um identificador forte igual; senão, confere o valor.
    if (forn === true || parc === true) return true;
    return (
      Math.abs(Number(item.vl_duplicata || 0) - Number(p.vl_duplicata || 0)) <
      0.005
    );
  };

  return itens.map((item) => {
    if (item.dt_liq || !item.nr_duplicata) return item;
    const candidatos = porDuplicata.get(String(item.nr_duplicata));
    if (!candidatos) return item;
    const match = candidatos.find((p) => casa(item, p));
    if (!match) return item;
    const dataPg = match.dt_pagamento
      ? String(match.dt_pagamento).split('T')[0]
      : match.pago_em
        ? String(match.pago_em).split('T')[0]
        : '';
    return { ...item, _pagoLiberacao: true, _pagoLiberacaoData: dataPg };
  });
};

// ─── PAGO VIA CONCILIAÇÃO (Yago, 09/11/2026) ───
// Saída do extrato conciliada com a duplicata na tela Conciliação → o título
// aparece PAGO aqui, com data de liquidação (= data da saída) e valor pago,
// mesmo que o TOTVS ainda não tenha baixado. Tabela derivada mantida pelo
// backend: contas_pagar_pagos_conciliacao (services/conciliacaoPropagacao.js).
export const anotarPagosNaConciliacao = async (itens) => {
  const emAberto = itens.filter((i) => !i.dt_liq && i.nr_duplicata);
  if (emAberto.length === 0) return itens;
  const duplicatas = [...new Set(emAberto.map((i) => String(i.nr_duplicata)))];
  const pagos = [];
  try {
    for (let i = 0; i < duplicatas.length; i += 200) {
      const { data, error } = await supabase
        .from('contas_pagar_pagos_conciliacao')
        .select('nr_duplicata, cd_empresa, nr_parcela, cd_fornecedor, dt_pagamento, vl_pago, banco')
        .in('nr_duplicata', duplicatas.slice(i, i + 200));
      if (error) throw error;
      pagos.push(...(data || []));
    }
  } catch (err) {
    console.error('Cruzamento com a Conciliação falhou:', err);
    return itens;
  }
  if (pagos.length === 0) return itens;
  const cmp = (a, b) =>
    a == null || b == null || a === '' || b === '' ? null : Number(a) === Number(b);
  const casa = (item, p) => {
    if (String(item.nr_duplicata) !== String(p.nr_duplicata)) return false;
    if (cmp(item.cd_empresa, p.cd_empresa) === false) return false;
    const parc = cmp(item.nr_parcela, p.nr_parcela);
    const forn = cmp(item.cd_fornecedor, p.cd_fornecedor);
    if (parc === false || forn === false) return false;
    return parc === true || forn === true;
  };
  const porDup = new Map();
  for (const p of pagos) {
    const k = String(p.nr_duplicata);
    if (!porDup.has(k)) porDup.set(k, []);
    porDup.get(k).push(p);
  }
  return itens.map((item) => {
    if (item.dt_liq || !item.nr_duplicata) return item;
    const lista = (porDup.get(String(item.nr_duplicata)) || []).filter((p) => casa(item, p));
    if (!lista.length) return item;
    const valor = lista.reduce((s, p) => s + Number(p.vl_pago || 0), 0);
    // formato do TOTVS (com 'T'), que é o que formatarData e os filtros esperam
    const data = `${lista.map((p) => String(p.dt_pagamento).slice(0, 10)).sort().pop()}T00:00:00`;
    return {
      ...item,
      dt_liq: data,
      vl_pago: Math.round(valor * 100) / 100,
      _pagoConciliacao: true,
      _pagoConciliacaoData: data,
      _pagoConciliacaoBanco: lista[0].banco || null,
    };
  });
};

