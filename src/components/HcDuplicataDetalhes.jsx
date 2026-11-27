// ============================================================================
// Detalhes de uma duplicata do Contas a Pagar HeadCoach — só leitura.
// Aberto pela Liberação de Pagamento ao clicar na duplicata (Yago, 27/11/2026):
// mostra a observação em destaque e, quando a duplicata nasceu de uma
// Solicitação Crosby, quem pediu, por quê, as aprovações e os anexos.
// API: GET /api/hc/contas-pagar/titulos/:id (services/hcContasPagar.js → detalheTitulo).
// Para alterar, baixar ou cancelar a duplicata o caminho continua sendo o Contas a Pagar.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { Spinner, X, Copy, Paperclip, ClipboardText, ArrowSquareOut } from '@phosphor-icons/react';
import { apiJson } from '../utils/apiAuth';
import { autorExibicao } from '../utils/autorExibicao';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const SITUACAO = {
  aberto: { rotulo: 'Em aberto', cor: 'bg-sky-50 text-sky-800 ring-sky-200' },
  vencido: { rotulo: 'Vencida', cor: 'bg-rose-50 text-rose-700 ring-rose-200' },
  pago: { rotulo: 'Paga', cor: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  cancelado: { rotulo: 'Cancelada', cor: 'bg-gray-100 text-gray-600 ring-gray-300' },
};
const ETAPA = { pendente: 'Pendente', previsao: 'Previsão', aprovado: 'Aprovado', incluido: 'Incluído no banco', pago: 'Pago', cancelado: 'Devolvida' };
const STATUS_SOLICITACAO = {
  pendente: 'Pendente',
  aprovado_gestor: 'Aprovada pelo gestor',
  aprovado_financeiro: 'Aprovada pelo financeiro',
  nota_fiscal: 'Aguardando nota fiscal',
  enviado_totvs: 'Enviada ao Contas a Pagar',
  aguardando_conciliacao: 'Aguardando conciliação',
  conciliado: 'Conciliada',
  pago: 'Paga',
  concluido: 'Concluída',
  rejeitado: 'Rejeitada',
};
const URGENCIA = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };

function Campo({ rotulo, children, largo }) {
  const vazio = children == null || children === '' || children === false;
  return (
    <div className={largo ? 'col-span-2 sm:col-span-4' : ''}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className={`whitespace-pre-wrap break-words text-sm ${vazio ? 'text-gray-300' : 'text-gray-900'}`}>{vazio ? '—' : children}</p>
    </div>
  );
}

function Copiavel({ rotulo, valor }) {
  const [ok, setOk] = useState(false);
  if (!valor) return null;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o texto continua selecionável */
    }
  };
  return (
    <div className="col-span-2 sm:col-span-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{rotulo}</p>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all font-mono text-xs text-gray-900">{valor}</p>
        <button type="button" onClick={copiar} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-[#000638] ring-1 ring-gray-200 hover:bg-gray-50">
          <Copy size={12} /> {ok ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

export default function HcDuplicataDetalhes({ tituloId, liberacao = null, formas = {}, nomeEmpresa = {}, onFechar }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    setD(null);
    setErro('');
    apiJson(`/api/hc/contas-pagar/titulos/${tituloId}`)
      .then((j) => vivo && setD(j.data))
      .catch((e) => vivo && setErro(e.message || 'Não consegui abrir a duplicata.'));
    return () => {
      vivo = false;
    };
  }, [tituloId]);

  useEffect(() => {
    const fechar = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onFechar]);

  const t = d?.titulo;
  const s = d?.solicitacao;
  const sit = t ? SITUACAO[t.tela?.situacao || t.situacao] || { rotulo: t.situacao, cor: 'bg-gray-100 text-gray-600 ring-gray-300' } : null;
  const rotuloDup = t ? `${t.duplicata}/${t.parcela}` : '';
  const forma = (k) => formas[k] || k;
  const rateio = t ? (t.rateio?.length ? t.rateio : [{ despesa_code: t.despesa_code, despesa_nome: t.despesa_nome, centro_custo_code: t.centro_custo_code, centro_custo_nome: t.centro_custo_nome, percentual: 100, valor: t.valor }]) : [];
  // a observação da duplicata que veio de solicitação repete "Solicitação Crosby · fulano (SETOR) · descrição":
  // mostra só quando acrescenta algo ao que o bloco da solicitação já diz
  const obsDuplicata = t?.observacao && !(s?.descricao && String(t.observacao).includes(s.descricao) && /^Solicita[çc][ãa]o Crosby/i.test(t.observacao)) ? t.observacao : null;
  const obsLiberacao = liberacao?.observacao || t?.liberacao?.observacao || null;

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-4" onClick={onFechar}>
      <div className="my-6 w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-[#000638]">{t ? `${t.fornecedor_nome} · ${rotuloDup}` : 'Duplicata'}</h3>
            {t && (
              <p className="truncate text-xs text-gray-500">
                {t.fornecedor_code} · empresa {t.empresa}
                {nomeEmpresa[t.empresa] ? ` (${nomeEmpresa[t.empresa]})` : ''}
                {s ? ' · veio de Solicitação Crosby' : t.origem === 'totvs' ? ' · importada do TOTVS' : t.origem && t.origem !== 'manual' ? ` · incluída por ${t.origem}` : ''}
              </p>
            )}
          </div>
          {sit && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${sit.cor}`}>{sit.rotulo}</span>}
          {t?.escrituracao === 'pendente' && <span className="whitespace-nowrap rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-orange-300">NÃO ESCRITURADA</span>}
          <button type="button" onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" title="Fechar">
            <X size={18} />
          </button>
        </div>

        {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {!d && !erro && (
          <div className="py-12 text-center text-gray-400">
            <Spinner size={22} className="mx-auto animate-spin" />
          </div>
        )}

        {d && (
          <div className="space-y-3">
            {/* o porquê do pagamento vem primeiro */}
            {s && (
              <div className="rounded-xl bg-indigo-50/60 p-3 ring-1 ring-indigo-200">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ClipboardText size={16} className="text-indigo-700" />
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">Solicitação Crosby</p>
                  {s.status && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-800 ring-1 ring-indigo-200">{STATUS_SOLICITACAO[s.status] || s.status}</span>}
                  {s.urgencia && s.urgencia !== 'normal' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-300">Urgência {URGENCIA[s.urgencia] || s.urgencia}</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Campo rotulo="Quem pediu">{s.solicitante}</Campo>
                  <Campo rotulo="Setor">{s.setor}</Campo>
                  <Campo rotulo="Pedido em">{fmtDataHora(s.dataSolicitacao)}</Campo>
                  <Campo rotulo="Forma pedida">{s.formaPagamento ? forma(s.formaPagamento) : null}</Campo>
                  <Campo rotulo="Descrição do pedido" largo>
                    {s.descricao}
                  </Campo>
                  {s.observacao && (
                    <Campo rotulo="Observação de quem pediu" largo>
                      {s.observacao}
                    </Campo>
                  )}
                  {s.marcaModelo && <Campo rotulo="Marca / modelo">{s.marcaModelo}</Campo>}
                  {s.produtoServico && <Campo rotulo="Produto ou serviço">{s.produtoServico}</Campo>}
                  {s.patrimonio && <Campo rotulo="Patrimônio">{s.patrimonio}</Campo>}
                  {s.recomendacaoFornecedores && (
                    <Campo rotulo="Fornecedores recomendados" largo>
                      {s.recomendacaoFornecedores}
                    </Campo>
                  )}
                  {s.contatos?.length > 0 && (
                    <Campo rotulo="Contatos de prestadores" largo>
                      {s.contatos.join('\n')}
                    </Campo>
                  )}
                  <Campo rotulo="Aprovação do gestor">{s.aprovadoGestor ? `${s.aprovadoGestor.por || '—'} · ${fmtDataHora(s.aprovadoGestor.em)}` : null}</Campo>
                  <Campo rotulo="Aprovação do financeiro">{s.aprovadoFinanceiro ? `${s.aprovadoFinanceiro.por || '—'} · ${fmtDataHora(s.aprovadoFinanceiro.em)}` : null}</Campo>
                  <Campo rotulo="Nota fiscal">{s.temNotaFiscal ? (s.nfEscrituradaEm ? `Escriturada em ${fmtData(s.nfEscrituradaEm)}` : `Com nota${s.nfChamadoDryland ? ` · chamado ${s.nfChamadoDryland}` : ''}`) : 'Sem nota fiscal'}</Campo>
                  {s.observacaoConclusao && (
                    <Campo rotulo="Observação da conclusão" largo>
                      {s.observacaoConclusao}
                    </Campo>
                  )}
                </div>
                {s.anexos?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.anexos.map((a) => (
                      <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-50">
                        <Paperclip size={12} /> {a.rotulo} <ArrowSquareOut size={11} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(obsDuplicata || obsLiberacao) && (
              <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
                {obsDuplicata && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Observação da duplicata</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-900">{obsDuplicata}</p>
                  </>
                )}
                {obsLiberacao && (
                  <div className={obsDuplicata ? 'mt-2' : ''}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Observação da liberação</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-900">{obsLiberacao}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200 sm:grid-cols-4">
              <Campo rotulo="Fornecedor">{t.fornecedor_nome}</Campo>
              <Campo rotulo="CPF/CNPJ">{t.fornecedor_cpf_cnpj}</Campo>
              <Campo rotulo="Duplicata / parcela">{rotuloDup}</Campo>
              <Campo rotulo="Documento fiscal">{t.documento_fiscal}</Campo>
              <Campo rotulo="Emissão">{fmtData(t.emissao)}</Campo>
              <Campo rotulo="Vencimento">{fmtData(t.vencimento)}</Campo>
              <Campo rotulo="Competência">{t.referencia}</Campo>
              <Campo rotulo="Previsão">{t.previsao === 'previsao' ? 'Previsão' : 'Real'}</Campo>
              <Campo rotulo="Valor">{fmtBRL(t.valor)}</Campo>
              <Campo rotulo="Falta pagar">{t.situacao === 'aberto' ? fmtBRL(t.tela?.saldo ?? t.valor) : fmtBRL(0)}</Campo>
              <Campo rotulo="Juros / multa">{`${fmtBRL(t.juros)} / ${fmtBRL(t.multa)}`}</Campo>
              <Campo rotulo="Desconto">{fmtBRL(t.desconto)}</Campo>
              <Campo rotulo="Forma de pagamento">{t.forma_pagamento ? forma(t.forma_pagamento) : null}</Campo>
              <Campo rotulo="Portador">{t.portador_code ? `${t.portador_code} · ${t.portador_nome || ''}` : null}</Campo>
              <Campo rotulo="Pago em">{t.data_pagamento ? fmtData(t.data_pagamento) : null}</Campo>
              <Campo rotulo="Conta do pagamento">{t.conta_pagamento}</Campo>
              <Copiavel rotulo="Chave Pix / Pix copia e cola" valor={t.chave_pix} />
              <Copiavel rotulo="Código de barras do boleto" valor={t.codigo_barras} />
              <Campo rotulo="Incluída por">{`${autorExibicao(t.criado_por) || '—'} · ${fmtDataHora(t.criado_em)}`}</Campo>
              {t.baixado_por && <Campo rotulo="Baixada por">{`${autorExibicao(t.baixado_por)} · ${fmtDataHora(t.baixado_em)}`}</Campo>}
              {t.situacao === 'cancelado' && (
                <Campo rotulo="Cancelada" largo>
                  {`${t.cancelado_por || ''} · ${fmtDataHora(t.cancelado_em)} · ${t.cancelado_motivo || ''}`}
                </Campo>
              )}
            </div>

            {d.anexoUrl && (
              <a href={d.anexoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-bold text-[#000638] ring-1 ring-gray-200 hover:bg-gray-50">
                <Paperclip size={13} /> Anexo da duplicata <ArrowSquareOut size={12} />
              </a>
            )}

            <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5">Despesa</th>
                    <th className="px-2 py-1.5">Centro de custo</th>
                    <th className="px-2 py-1.5 text-right">%</th>
                    <th className="px-2 py-1.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rateio.map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">{r.despesa_code ? `${r.despesa_code} · ${r.despesa_nome || ''}` : '—'}</td>
                      <td className="px-2 py-1.5">{r.centro_custo_code ? `${r.centro_custo_code} · ${r.centro_custo_nome || ''}` : <span className="text-amber-700">sem centro de custo</span>}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{String(r.percentual ?? 100).replace('.', ',')}%</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtBRL(r.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {d.parcelas?.length > 1 && (
              <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
                <p className="bg-gray-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Parcelas da duplicata {t.duplicata}</p>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-100">
                    {d.parcelas.map((p) => (
                      <tr key={p.id} className={p.id === t.id ? 'bg-indigo-50 font-semibold' : ''}>
                        <td className="px-2 py-1.5 tabular-nums">
                          {p.duplicata}/{p.parcela}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">vence {fmtData(p.vencimento)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL(p.valor)}</td>
                        <td className="px-2 py-1.5">{p.situacao === 'pago' ? `Paga em ${fmtData(p.data_pagamento)}` : p.situacao === 'cancelado' ? 'Cancelada' : Number(p.valor_pago) > 0 ? `Paga em parte (${fmtBRL(p.valor_pago)})` : 'Em aberto'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {d.liberacoes?.length > 0 && (
              <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
                <p className="bg-gray-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Liberação de pagamento</p>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-100">
                    {d.liberacoes.map((l) => (
                      <tr key={l.id} className="align-top">
                        <td className="px-2 py-1.5 font-bold">{ETAPA[l.status] || l.status}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL(l.valor)}</td>
                        <td className="px-2 py-1.5">{[l.banco, l.forma_pagamento ? forma(l.forma_pagamento) : null, l.data_prevista ? `previsto ${fmtData(l.data_prevista)}` : null].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-2 py-1.5 text-gray-600">
                          <div>liberada por {autorExibicao(l.liberado_por) || '—'} · {fmtDataHora(l.liberado_em)}</div>
                          {l.aprovado_por && <div>aprovada por {autorExibicao(l.aprovado_por)} · {fmtDataHora(l.aprovado_em)}</div>}
                          {l.pago_por && <div>paga por {autorExibicao(l.pago_por)} · {fmtData(l.data_pagamento)}</div>}
                          {l.cancelado_por && <div>devolvida por {autorExibicao(l.cancelado_por)}{l.cancelado_motivo ? ` · ${l.cancelado_motivo}` : ''}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {d.baixas?.length > 0 && (
              <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
                <p className="bg-gray-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Baixas</p>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-100">
                    {d.baixas.map((b) => (
                      <tr key={b.id} className="align-top">
                        <td className="px-2 py-1.5 tabular-nums">{fmtData(b.data_pagamento)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtBRL(b.valor_pago)}</td>
                        <td className="px-2 py-1.5">{[b.forma_pagamento ? forma(b.forma_pagamento) : null, b.conta].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-2 py-1.5 text-gray-600">
                          {autorExibicao(b.por) || '—'}
                          {b.observacao ? ` · ${b.observacao}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
