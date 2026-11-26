// ============================================================================
// HEADCOACH › CONTAS A PAGAR (Yago, 18/11/2026) — duplicatas próprias do
// HeadCoach, sem o TOTVS, no molde do Contas a Receber do HeadCoach.
//   • Consulta com os filtros do contas a pagar do TOTVS (empresa, datas,
//     situação, fornecedor, duplicata, documento fiscal, despesa, centro de custo, portador, forma).
//   • Numeração: a duplicata é um número por empresa + fornecedor e cada lançamento
//     é uma parcela dela — "1/11" e "1/12" são a duplicata 1, parcelas 11 e 12 (conta
//     mensal: a parcela é o mês do vencimento). O documento fiscal é a nota do fornecedor.
//   • Inclusão manual: duplicata nova ou mais parcelas numa que o fornecedor já tem.
//   • Detalhe: alteração enquanto está em aberto, BAIXA (juros, multa,
//     desconto, senha — sem estorno) e cancelamento com motivo.
// API: /api/hc/contas-pagar (só owner, admin e financeiro) — services/hcContasPagar.js
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { autorExibicao } from '../utils/autorExibicao';
import { Receipt, MagnifyingGlass, Spinner, X, CheckCircle, Plus, Trash, Copy, FilePdf, PencilSimple, Prohibit, PaperPlaneTilt } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';

const API = '/api/hc/contas-pagar';
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
// "1/11": duplicata 1, parcela 11
const rotuloDup = (t) => `${t.duplicata}/${t.parcela}`;
// cor da parcela pela situação: paga, cancelada, vencida ou em aberto
const parcial = (p) => p.situacao === 'aberto' && Number(p.valor_pago || 0) > 0; // paga em parte: continua em aberto pelo que falta
// quitada sem dinheiro (acordo, mercadoria…): baixa só com desconto do valor todo — aparece como ABATIMENTO (Titia, 24/11/2026)
const abatimento = (p) => p.situacao === 'pago' && Number(p.valor_pago || 0) < 0.005 && Number(p.desconto || 0) >= Number(p.valor || 0) - 0.005;
const corParcela = (p) => (abatimento(p) ? 'text-sky-700 ring-sky-300' : p.situacao === 'pago' ? 'text-emerald-700 ring-emerald-300' : parcial(p) ? 'text-amber-700 ring-amber-300' : p.situacao === 'cancelado' ? 'text-gray-400 ring-gray-200 line-through' : String(p.vencimento).slice(0, 10) < hojeIso() ? 'text-rose-700 ring-rose-300' : 'text-[#000638] ring-gray-300');
// parcela sugerida: o mês do vencimento (11 para novembro)
const parcelaDoMes = (vencimento) => (vencimento ? Number(String(vencimento).slice(5, 7)) : '');
const hojeIso = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date());
const inicioMes = () => `${hojeIso().slice(0, 8)}01`;
const fimMes = () => {
  const [a, m] = hojeIso().split('-').map(Number);
  return `${hojeIso().slice(0, 8)}${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
};
// mesmo dia do mês, n meses depois (31/01 + 1 mês = 28 ou 29/02)
const maisMeses = (iso, n) => {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1, 12));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0, 12)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
};
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
const btnPri = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#000638] px-4 text-sm font-bold text-white hover:bg-[#000638]/90 disabled:opacity-40';
const btnSec = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40';
const PERFIS_FINANCEIRO = ['owner', 'admin', 'user'];

const CAMPOS_DATA = [
  { k: 'vencimento', label: 'Vencimento' },
  { k: 'emissao', label: 'Emissão' },
  { k: 'entrada', label: 'Entrada' },
  { k: 'pagamento', label: 'Pagamento' },
];

const faltaDepois = (b) => Math.max(0, round2(Number(b.valor_titulo || 0) - (Number(b.valor_pago || 0) - Number(b.juros || 0) - Number(b.multa || 0) + Number(b.desconto || 0))));

function Situacao({ t }) {
  if (t.situacao === 'cancelado') return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">CANCELADA</span>;
  if (abatimento(t)) return <span title={`Abatimento de ${fmtBRL(t.desconto)} em ${fmtData(t.data_pagamento)}`} className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200">ABATIMENTO</span>;
  if (t.situacao === 'pago') return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">PAGA</span>;
  const dias = t.tela?.diasAtraso || 0;
  if (parcial(t))
    return (
      <span title={`Pago ${fmtBRL(t.valor_pago)} · falta ${fmtBRL(t.tela?.saldo)}`} className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-300">
        PAGA PARCIAL{dias > 0 ? ` · VENCIDA ${dias}d` : ''}
      </span>
    );
  return dias > 0 ? (
    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">VENCIDA {dias}d</span>
  ) : (
    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200">EM ABERTO</span>
  );
}

function Card({ rotulo, valor, sub, cls = 'text-[#000638]' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className={`text-lg font-bold tabular-nums ${cls}`}>{valor}</p>
      {sub && <p className="text-[10.5px] text-gray-400">{sub}</p>}
    </div>
  );
}

function Campo({ rotulo, children, largo }) {
  return (
    <div className={`min-w-0 ${largo ? 'col-span-2' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className={`text-xs font-semibold text-gray-800 ${largo ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>{children ?? '—'}</p>
    </div>
  );
}

function Opcoes({ lista, vazio }) {
  return (
    <>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {lista.map((o) => (
        <option key={o.code} value={o.code}>
          {o.code} — {o.nome || 'sem nome'}
        </option>
      ))}
    </>
  );
}

// centros de custo separados em Empresas (filiais) e Setores
function OpcoesCentro({ centros, vazio }) {
  const grupos = [
    ['Empresas', centros.filter((c) => c.tipo === 'empresa')],
    ['Setores', centros.filter((c) => c.tipo === 'setor')],
    ['Outros', centros.filter((c) => c.tipo === 'outro')],
  ];
  return (
    <>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {grupos.map(
        ([nome, lista]) =>
          lista.length > 0 && (
            <optgroup key={nome} label={nome}>
              {lista.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.nome}
                </option>
              ))}
            </optgroup>
          ),
      )}
    </>
  );
}

const RATEIO_VAZIO = { despesaCode: '', centroCustoCode: '', percentual: '100' };
const somaPct = (linhas) => Math.round(linhas.reduce((s, l) => s + num(l.percentual), 0) * 10000) / 10000;
const rateioOk = (linhas) => linhas.length > 0 && linhas.every((l) => l.despesaCode && l.centroCustoCode && num(l.percentual) > 0) && Math.abs(somaPct(linhas) - 100) <= 0.01;

// Rateio no modelo das Solicitações de RH: despesa + centro de custo + % ↔ R$ por linha; a soma fecha 100%.
function EditorRateio({ linhas, onChange, op, valorBase }) {
  const mudar = (i, k, v) => onChange(linhas.map((l, n) => (n === i ? { ...l, [k]: v } : l)));
  const base = Number(valorBase) || 0;
  const total = somaPct(linhas);
  const fecha = Math.abs(total - 100) <= 0.01;
  return (
    <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-sm font-bold text-[#000638]">Despesas / centros de custo</p>
        <button type="button" onClick={() => onChange([...linhas, { ...RATEIO_VAZIO, despesaCode: linhas.at(-1)?.despesaCode || '', percentual: fecha ? '' : String(Math.max(0, Math.round((100 - total) * 10000) / 10000)).replace('.', ',') }])} className={btnSec}>
          <Plus size={13} weight="bold" /> Centro de custo
        </button>
      </div>
      {linhas.map((l, i) => (
        <div key={i} className="mb-1.5 grid grid-cols-2 items-end gap-2 sm:grid-cols-[1.3fr_1.3fr_90px_120px_auto]">
          <div>
            {i === 0 && <label className={labelCls}>Despesa</label>}
            <select value={l.despesaCode} onChange={(e) => mudar(i, 'despesaCode', e.target.value)} className={inputCls}>
              <Opcoes lista={op.despesas} vazio="Escolha" />
            </select>
          </div>
          <div>
            {i === 0 && <label className={labelCls}>Centro de custo</label>}
            <select value={l.centroCustoCode} onChange={(e) => mudar(i, 'centroCustoCode', e.target.value)} className={inputCls}>
              <OpcoesCentro centros={op.centrosCusto} vazio="Escolha" />
            </select>
          </div>
          <div>
            {i === 0 && <label className={labelCls}>%</label>}
            <input inputMode="decimal" value={l.percentual} onChange={(e) => mudar(i, 'percentual', e.target.value)} className={inputCls} />
          </div>
          <div>
            {i === 0 && <label className={labelCls}>Valor (R$)</label>}
            <input
              inputMode="decimal"
              disabled={!(base > 0)}
              value={base > 0 && num(l.percentual) > 0 ? round2((base * num(l.percentual)) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
              onChange={(e) => mudar(i, 'percentual', String(Math.round((num(e.target.value) / base) * 1000000) / 10000).replace('.', ','))}
              placeholder={base > 0 ? '0,00' : 'informe o valor'}
              className={inputCls}
            />
          </div>
          <button type="button" onClick={() => onChange(linhas.filter((_, n) => n !== i))} disabled={linhas.length === 1} className="mb-0.5 rounded-lg p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-30" title="Tirar linha">
            <Trash size={15} />
          </button>
        </div>
      ))}
      <p className={`mt-1 text-right text-xs font-bold tabular-nums ${fecha ? 'text-emerald-700' : 'text-amber-700'}`}>
        Total do rateio: {String(total).replace('.', ',')}% {fecha ? '✓' : '— precisa fechar 100%'}
        {base > 0 ? ` · ${fmtBRL(base)}` : ''}
      </p>
    </div>
  );
}

// Liberação de Pagamento: a duplicata em aberto é liberada e segue pendente → previsão → aprovado → incluído → pago
const ETAPAS_LIBERACAO = { pendente: 'PENDENTE', previsao: 'PREVISÃO', aprovado: 'APROVADA', incluido: 'INCLUÍDA', pago: 'PAGA', cancelado: 'DEVOLVIDA' };
const podeLiberar = (t) => t.situacao === 'aberto' && !t.liberacao;
function SeloLiberacao({ l }) {
  if (!l) return null;
  return (
    <span title={`Na Liberação de Pagamento: ${fmtBRL(l.valor)}${l.data_prevista ? ` · previsto para ${fmtData(l.data_prevista)}` : ''}${l.banco ? ` · ${l.banco}` : ''}`} className="ml-1 whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
      LIBERAÇÃO · {ETAPAS_LIBERACAO[l.status] || l.status}
    </span>
  );
}

// Escrituração da nota fiscal: a duplicata de solicitação com nota fiscal entra aqui mesmo antes de a nota
// ser escriturada. O selo mostra o status; clicar nele (ou os botões do detalhe) troca.
const ESCRITURACAO = { pendente: 'NÃO ESCRITURADA', escriturada: 'ESCRITURADA' };
function SeloEscrituracao({ t, onTrocar, ocupado }) {
  if (!t?.escrituracao) return null;
  const pendente = t.escrituracao === 'pendente';
  const cls = `ml-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${pendente ? 'bg-orange-50 text-orange-700 ring-orange-300' : 'bg-teal-50 text-teal-700 ring-teal-200'}`;
  const dica = `Nota fiscal ${pendente ? 'ainda não escriturada' : 'escriturada'}${t.escrituracao_em ? ` · ${t.escrituracao_por ? autorExibicao(t.escrituracao_por) : 'veio da solicitação'} em ${fmtDataHora(t.escrituracao_em)}` : ''}${onTrocar ? ` · clique para marcar como ${pendente ? 'ESCRITURADA' : 'NÃO ESCRITURADA'}` : ''}`;
  if (!onTrocar)
    return (
      <span title={dica} className={cls}>
        {ESCRITURACAO[t.escrituracao]}
      </span>
    );
  return (
    <button
      type="button"
      disabled={ocupado}
      title={dica}
      onClick={(e) => {
        e.stopPropagation();
        onTrocar(t, pendente ? 'escriturada' : 'pendente');
      }}
      className={`${cls} hover:brightness-95 disabled:opacity-50`}
    >
      {ESCRITURACAO[t.escrituracao]}
    </button>
  );
}

const POR_PAGINA = 50; // linhas da tabela por página (mil linhas de uma vez travavam a tela)

// Página 1, 2, 3… da tabela. Mostra a primeira, a última e as vizinhas da atual.
function Paginacao({ pagina, total, qtd, onIr }) {
  if (total <= 1) return null;
  const nums = [...new Set([1, 2, pagina - 1, pagina, pagina + 1, total - 1, total])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold ring-1 ring-gray-200 disabled:opacity-40';
  const de = (pagina - 1) * POR_PAGINA + 1;
  const ate = Math.min(pagina * POR_PAGINA, qtd);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-600">
      <span>
        Mostrando <b>{de}</b>–<b>{ate}</b> de <b>{qtd}</b> duplicatas · página {pagina} de {total}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => onIr(pagina - 1)} disabled={pagina <= 1} className={`${btn} bg-white text-[#000638] hover:bg-gray-50`}>
          ‹ Anterior
        </button>
        {nums.map((n, i) => (
          <React.Fragment key={n}>
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-gray-400">…</span>}
            <button type="button" onClick={() => onIr(n)} className={`${btn} ${n === pagina ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-white text-[#000638] hover:bg-gray-50'}`}>
              {n}
            </button>
          </React.Fragment>
        ))}
        <button type="button" onClick={() => onIr(pagina + 1)} disabled={pagina >= total} className={`${btn} bg-white text-[#000638] hover:bg-gray-50`}>
          Próxima ›
        </button>
      </div>
    </div>
  );
}

// duplicata que veio do contas a pagar do TOTVS (já paga lá, na conciliação ou na Liberação)
function MarcaTotvs() {
  return (
    <span title="Importada do contas a pagar do TOTVS" className="ml-1.5 inline-block rounded-full bg-amber-50 px-1.5 py-0.5 align-middle text-[9px] font-bold tracking-wide text-amber-700 no-underline ring-1 ring-amber-300">
      TOTVS
    </span>
  );
}

export default function HcContasPagar() {
  const { user } = useAuth();
  const podeFinanceiro = PERFIS_FINANCEIRO.includes(user?.role);
  const [op, setOp] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [f, setF] = useState({ empresa: '', campoData: 'vencimento', de: inicioMes(), ate: fimMes(), situacao: '', fornecedor: '', duplicata: '', documentoFiscal: '', despesa: '', centroCusto: '', portador: '', forma: '', origem: '', escrituracao: '', valor: '' });
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(null); // id da duplicata no detalhe
  const [pagina, setPagina] = useState(1); // a tabela mostra POR_PAGINA duplicatas por vez
  const [selecionadas, setSelecionadas] = useState(() => new Set()); // duplicatas marcadas para LIBERAR PARA PAGAMENTO
  const [liberando, setLiberando] = useState(false);
  const [escriturando, setEscriturando] = useState(false);
  const [incluindo, setIncluindo] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const avisar = useCallback((tipo, msg) => {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 6000);
  }, []);

  const buscar = useCallback(async (filtros) => {
    setCarregando(true);
    setErro('');
    try {
      const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v != null)).toString();
      const j = await apiJson(`${API}/titulos?${qs}`);
      setDados(j.data);
    } catch (e) {
      setErro(e.message);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!podeFinanceiro) return;
    apiJson(`${API}/opcoes`)
      .then((j) => setOp(j.data))
      .catch((e) => setErro(e.message));
    buscar(f);
  }, [podeFinanceiro]); // eslint-disable-line react-hooks/exhaustive-deps

  const tot = dados?.totais || {};
  const todasDuplicatas = dados?.titulos || [];
  const totalPaginas = Math.max(1, Math.ceil(todasDuplicatas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = todasDuplicatas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  // seleção: só duplicata em aberto que ainda não está na Liberação de Pagamento
  const liberaveis = todasDuplicatas.filter(podeLiberar);
  const liberaveisDaPagina = daPagina.filter(podeLiberar);
  const marcadas = liberaveis.filter((t) => selecionadas.has(t.id));
  const valorMarcado = marcadas.reduce((soma, t) => soma + Number(t.tela?.saldo ?? t.valor), 0);
  const paginaToda = liberaveisDaPagina.length > 0 && liberaveisDaPagina.every((t) => selecionadas.has(t.id));
  const marcar = (ids, sim) =>
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      ids.forEach((id) => (sim ? novo.add(id) : novo.delete(id)));
      return novo;
    });
  const liberarParaPagamento = async () => {
    if (!marcadas.length) return;
    setLiberando(true);
    try {
      const j = await apiJson(`${API}/liberacoes`, { method: 'POST', body: { ids: marcadas.map((t) => t.id) } });
      setSelecionadas(new Set());
      avisar('ok', j?.message || 'Duplicatas liberadas para pagamento');
      buscar(f);
    } catch (e) {
      avisar('erro', e.message);
    } finally {
      setLiberando(false);
    }
  };
  // escrituração: troca o status direto na linha (pede confirmação)
  const naoEscrituradas = todasDuplicatas.filter((t) => t.escrituracao === 'pendente' && t.situacao !== 'cancelado');
  const trocarEscrituracao = async (t, novo) => {
    if (!window.confirm(`Marcar a duplicata ${rotuloDup(t)} de ${t.fornecedor_nome} como ${ESCRITURACAO[novo]}?`)) return;
    setEscriturando(true);
    try {
      const j = await apiJson(`${API}/titulos/escrituracao`, { method: 'POST', body: { ids: [t.id], escrituracao: novo } });
      avisar('ok', j?.message || 'Escrituração atualizada');
      buscar(f);
    } catch (e) {
      avisar('erro', e.message);
    } finally {
      setEscriturando(false);
    }
  };
  const verNaoEscrituradas = () => {
    const novo = { ...f, escrituracao: 'pendente' };
    setF(novo);
    setPagina(1);
    buscar(novo);
  };
  const empresas = op?.empresas || [];
  const formas = op?.formas || {};
  const nomeEmpresa = useMemo(() => Object.fromEntries(empresas.map((e) => [e.code, e.nome])), [empresas]);

  if (!podeFinanceiro) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
        <div className="mx-auto max-w-7xl">
          <PageTitle title="Contas a Pagar" subtitle="Duplicatas do HeadCoach" icon={Receipt} />
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">O contas a pagar é só para owner, admin e financeiro.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-7xl">
        <PageTitle title="Contas a Pagar" subtitle="Duplicatas do HeadCoach — uma por fornecedor e empresa, com as parcelas (1/11, 1/12), documento fiscal, portador, despesa e rateio por centro de custo; baixa com juros e desconto, sem o TOTVS" icon={Receipt} />
        {aviso && <p className={`mb-3 rounded-xl px-3 py-2 text-sm ring-1 ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{aviso.msg}</p>}
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPagina(1);
              buscar(f);
            }}
            className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-4 lg:grid-cols-8"
          >
            <div className="col-span-2">
              <label className={labelCls}>Empresa</label>
              <select value={f.empresa} onChange={set('empresa')} className={inputCls}>
                <option value="">Todas</option>
                {empresas.map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.code} — {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Data de</label>
              <select value={f.campoData} onChange={set('campoData')} className={inputCls}>
                {CAMPOS_DATA.map((c) => (
                  <option key={c.k} value={c.k}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>De</label>
              <input type="date" value={f.de} onChange={set('de')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Até</label>
              <input type="date" value={f.ate} onChange={set('ate')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Situação</label>
              <select value={f.situacao} onChange={set('situacao')} className={inputCls}>
                <option value="">Todas</option>
                <option value="aberto">Em aberto</option>
                <option value="vencido">Vencidas</option>
                <option value="a_vencer">A vencer</option>
                <option value="parcial">Pagas parcial</option>
                <option value="pago">Pagas (com o já pago das parciais)</option>
                <option value="cancelado">Canceladas</option>
              </select>
            </div>
            <div>
              <label className={labelCls} title="Duplicata de solicitação com nota fiscal: mostra se a nota já foi escriturada">
                Escrituração
              </label>
              <select value={f.escrituracao} onChange={set('escrituracao')} className={inputCls}>
                <option value="">Todas</option>
                <option value="pendente">Não escrituradas</option>
                <option value="escriturada">Escrituradas</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Forma</label>
              <select value={f.forma} onChange={set('forma')} className={inputCls}>
                <option value="">Todas</option>
                {Object.entries(formas).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Duplicata</label>
              <input value={f.duplicata} onChange={set('duplicata')} placeholder="ex.: 1 ou 1/12" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Documento fiscal</label>
              <input value={f.documentoFiscal} onChange={set('documentoFiscal')} className={inputCls} />
            </div>
            <div className="col-span-2 lg:col-span-3">
              <label className={labelCls}>Fornecedor (código, nome ou CPF/CNPJ)</label>
              <input value={f.fornecedor} onChange={set('fornecedor')} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Despesa</label>
              <select value={f.despesa} onChange={set('despesa')} className={inputCls}>
                <Opcoes lista={op?.despesas || []} vazio="Todas" />
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Centro de custo</label>
              <select value={f.centroCusto} onChange={set('centroCusto')} className={inputCls}>
                <OpcoesCentro centros={op?.centrosCusto || []} vazio="Todos" />
              </select>
            </div>
            <div className="col-span-2 lg:col-span-1">
              <label className={labelCls}>Portador</label>
              <select value={f.portador} onChange={set('portador')} className={inputCls}>
                <Opcoes lista={op?.portadores || []} vazio="Todos" />
              </select>
            </div>
            <div className="col-span-2 lg:col-span-1">
              <label className={labelCls}>Origem</label>
              <select value={f.origem} onChange={set('origem')} className={inputCls}>
                <option value="">Todas</option>
                <option value="headcoach">HeadCoach</option>
                <option value="totvs">TOTVS</option>
              </select>
            </div>
            <div className="col-span-2 lg:col-span-1">
              <label className={labelCls}>Valor (R$)</label>
              <input value={f.valor} onChange={set('valor')} placeholder="ex.: 1.234,56" inputMode="decimal" className={inputCls} />
            </div>
            <div className="col-span-2 flex items-end gap-2 lg:col-span-6 lg:justify-end">
              <button type="submit" disabled={carregando} className={`${btnPri} flex-1 lg:w-48 lg:flex-none`}>
                {carregando ? <Spinner size={15} className="animate-spin" /> : <MagnifyingGlass size={15} weight="bold" />} BUSCAR
              </button>
              <button type="button" onClick={() => setIncluindo(true)} disabled={!op} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 lg:w-48 lg:flex-none text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                <Plus size={15} weight="bold" /> NOVA DUPLICATA
              </button>
            </div>
          </form>

          {erro && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}

          {dados && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Card rotulo="Em aberto" valor={fmtBRL(tot.aberto)} cls="text-sky-700" />
                <Card rotulo="Vencido" valor={fmtBRL(tot.vencido)} cls={tot.vencido > 0 ? 'text-rose-700' : 'text-[#000638]'} />
                <Card rotulo="Vence hoje" valor={fmtBRL(tot.venceHoje)} cls={tot.venceHoje > 0 ? 'text-amber-700' : 'text-[#000638]'} />
                <Card rotulo="Pago" valor={fmtBRL(tot.valorPago)} cls="text-emerald-700" />
                <Card rotulo="Juros + multa pagos" valor={fmtBRL(tot.encargos)} />
                <Card rotulo="Descontos" valor={fmtBRL(tot.desconto)} />
              </div>
              {naoEscrituradas.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-200 bg-orange-50/70 px-3 py-2 text-xs text-orange-900">
                  <span>
                    <b>{naoEscrituradas.length}</b> duplicata(s) com nota fiscal ainda <b>NÃO ESCRITURADA</b> · <b>{fmtBRL(naoEscrituradas.reduce((soma, t) => soma + Number(t.valor || 0), 0))}</b>
                  </span>
                  <span className="text-orange-700">Clique no selo da linha para trocar o status.</span>
                  {f.escrituracao !== 'pendente' && (
                    <button type="button" onClick={verNaoEscrituradas} className="ml-auto font-semibold text-orange-800 underline">
                      ver só elas
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs text-[#000638]">
                {marcadas.length > 0 ? (
                  <span>
                    <b>{marcadas.length}</b> duplicata(s) selecionada(s) · <b>{fmtBRL(valorMarcado)}</b> a pagar
                  </span>
                ) : (
                  <span className="text-gray-600">Marque as duplicatas em aberto e clique em LIBERAR PARA PAGAMENTO.</span>
                )}
                {liberaveis.length > marcadas.length && (
                  <button type="button" onClick={() => marcar(liberaveis.map((t) => t.id), true)} className="font-semibold text-indigo-700 underline">
                    selecionar as {liberaveis.length} em aberto da consulta
                  </button>
                )}
                {marcadas.length > 0 && (
                  <button type="button" onClick={() => setSelecionadas(new Set())} className="font-semibold text-gray-600 underline">
                    limpar
                  </button>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Link to="/headcoach/liberacao-pagamento" className="font-semibold text-indigo-700 underline">
                    Abrir a Liberação de Pagamento
                  </Link>
                  <button type="button" onClick={liberarParaPagamento} disabled={liberando || marcadas.length === 0} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white hover:bg-indigo-900 disabled:opacity-40">
                    {liberando ? <Spinner size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} weight="bold" />} LIBERAR PARA PAGAMENTO
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full min-w-[1220px] text-xs">
                  <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="w-8 px-2 py-2">
                        <input
                          type="checkbox"
                          title="Selecionar as duplicatas em aberto desta página"
                          checked={paginaToda}
                          disabled={liberaveisDaPagina.length === 0}
                          onChange={(e) => marcar(liberaveisDaPagina.map((t) => t.id), e.target.checked)}
                        />
                      </th>
                      <th className="px-2 py-2">Empresa</th>
                      <th className="px-2 py-2">Fornecedor</th>
                      <th className="px-2 py-2" title="Número da duplicata / parcela">Dup. / parc.</th>
                      <th className="px-2 py-2">Doc. fiscal</th>
                      <th className="px-2 py-2">Despesa</th>
                      <th className="px-2 py-2">Forma</th>
                      <th className="px-2 py-2">Emissão</th>
                      <th className="px-2 py-2">Vencimento</th>
                      <th className="px-2 py-2 text-right">Valor</th>
                      <th className="px-2 py-2 text-right">Pago</th>
                      <th className="px-2 py-2 text-right" title="O que ainda falta pagar da duplicata em aberto">
                        Falta pagar
                      </th>
                      <th className="px-2 py-2">Pagamento</th>
                      <th className="px-2 py-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dados.titulos.length === 0 && (
                      <tr>
                        <td colSpan={14} className="px-2 py-10 text-center text-gray-400">
                          Nenhuma duplicata com esses filtros.
                        </td>
                      </tr>
                    )}
                    {daPagina.map((t) => (
                      <tr key={t.id} onClick={() => setAberto(t.id)} className={`cursor-pointer hover:bg-indigo-50/50 ${t.situacao === 'cancelado' ? 'text-gray-400 line-through' : ''}`}>
                        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                          {podeLiberar(t) && <input type="checkbox" checked={selecionadas.has(t.id)} onChange={(e) => marcar([t.id], e.target.checked)} />}
                        </td>
                        <td className="px-2 py-1.5" title={nomeEmpresa[t.empresa]}>
                          {t.empresa}
                        </td>
                        <td className="max-w-[240px] truncate px-2 py-1.5" title={t.fornecedor_nome}>
                          {t.fornecedor_code} · {t.fornecedor_nome}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 font-semibold tabular-nums text-[#000638]">
                          {rotuloDup(t)}
                          {t.origem === 'totvs' && <MarcaTotvs />}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{t.documento_fiscal || '—'}</td>
                        <td className="max-w-[170px] truncate px-2 py-1.5" title={t.despesa_nome || ''}>
                          {t.despesa_code ? `${t.despesa_code} · ${t.despesa_nome}` : '—'}
                        </td>
                        <td className="px-2 py-1.5">{formas[t.forma_pagamento] || '—'}</td>
                        <td className="px-2 py-1.5 tabular-nums">{fmtData(t.emissao)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{fmtData(t.vencimento)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtBRL(t.valor)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{t.situacao === 'pago' || parcial(t) ? fmtBRL(t.valor_pago) : '—'}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${parcial(t) ? 'font-semibold text-amber-700' : ''}`}>{t.situacao === 'aberto' ? fmtBRL(t.tela?.saldo ?? t.valor) : '—'}</td>
                        <td className="px-2 py-1.5 tabular-nums">{fmtData(t.data_pagamento)}</td>
                        <td className="px-2 py-1.5">
                          <Situacao t={t} />
                          <SeloLiberacao l={t.liberacao} />
                          <SeloEscrituracao t={t} onTrocar={trocarEscrituracao} ocupado={escriturando} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {dados.titulos.length > 0 && (
                    <tfoot className="bg-gray-50 text-xs font-bold">
                      <tr>
                        <td className="px-2 py-2" colSpan={9}>
                          {tot.qtd} duplicata(s){totalPaginas > 1 ? ' · totais da consulta inteira' : ''}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(tot.valor)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(tot.valorPago)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(tot.aberto)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <Paginacao
                pagina={paginaAtual}
                total={totalPaginas}
                qtd={todasDuplicatas.length}
                onIr={(n) => setPagina(Math.min(Math.max(1, n), totalPaginas))}
              />
            </>
          )}
        </div>
        {aberto && op && (
          <Detalhe
            id={aberto}
            op={op}
            onFechar={() => setAberto(null)}
            onMudou={(msg) => {
              avisar('ok', msg);
              buscar(f);
            }}
          />
        )}
        {incluindo && op && (
          <NovaDuplicata
            op={op}
            onFechar={() => setIncluindo(false)}
            onSalvou={(msg) => {
              setIncluindo(false);
              avisar('ok', msg);
              buscar(f);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── busca de fornecedor no cadastro local ───────────────────────────────────
function BuscaFornecedor({ valor, onEscolher }) {
  const [termo, setTermo] = useState('');
  const [lista, setLista] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const buscar = async () => {
    if (termo.trim().length < 2) return;
    setBusy(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/fornecedores?q=${encodeURIComponent(termo.trim())}`);
      setLista(j.data.fornecedores || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (valor) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm">
        <span className="min-w-0 flex-1 truncate font-semibold text-gray-800">
          {valor.code} · {valor.nome}
        </span>
        <button type="button" onClick={() => onEscolher(null)} className="text-xs font-semibold text-[#000638] underline">
          trocar
        </button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              buscar();
            }
          }}
          placeholder="código, nome ou CPF/CNPJ"
          className={inputCls}
        />
        <button type="button" onClick={buscar} disabled={busy || termo.trim().length < 2} className={btnSec}>
          {busy ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} Buscar
        </button>
      </div>
      {erro && <p className="mt-1 text-xs text-rose-700">{erro}</p>}
      {lista && (
        <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white">
          {lista.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">Nenhum fornecedor encontrado.</p>}
          {lista.map((p) => (
            <button type="button" key={p.code} onClick={() => onEscolher(p)} className="block w-full truncate px-2 py-1.5 text-left text-xs hover:bg-indigo-50">
              <b>{p.code}</b> · {p.nome}
              {p.cpf_cnpj ? <span className="text-gray-400"> · {p.cpf_cnpj}</span> : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── inclusão ────────────────────────────────────────────────────────────────
function NovaDuplicata({ op, onFechar, onSalvou }) {
  const [d, setD] = useState({ empresa: '', documentoFiscal: '', tipoDocumento: 'duplicata', portadorCode: '', formaPagamento: '', chavePix: '', codigoBarras: '', previsao: 'real', emissao: hojeIso(), entrada: hojeIso(), referencia: '', observacao: '' });
  const [fornecedor, setFornecedor] = useState(null);
  const [parcelas, setParcelas] = useState([{ numero: '', vencimento: '', valor: '' }]);
  // duplicatas que o fornecedor já tem na empresa: '' = abrir uma nova
  const [existentes, setExistentes] = useState([]);
  const [duplicata, setDuplicata] = useState('');
  useEffect(() => {
    setDuplicata('');
    setExistentes([]);
    if (!d.empresa || !fornecedor?.code) return undefined;
    let vivo = true;
    apiJson(`${API}/duplicatas?empresa=${d.empresa}&fornecedor=${fornecedor.code}`)
      .then((j) => vivo && setExistentes(j?.data?.duplicatas || j?.duplicatas || []))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [d.empresa, fornecedor?.code]);
  const proxima = existentes.reduce((m, x) => Math.max(m, x.duplicata), 0) + 1;
  const numeroDup = duplicata || proxima;
  // parcela de cada linha: o que foi digitado ou, em branco, o mês do vencimento
  const numeroDa = (linha) => (String(linha.numero).trim() ? Number(linha.numero) : parcelaDoMes(linha.vencimento));
  const [rateio, setRateio] = useState([{ ...RATEIO_VAZIO }]);
  const [gerar, setGerar] = useState({ qtd: 2, total: '' });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const setParcela = (i, k) => (e) => setParcelas((ps) => ps.map((p, n) => (n === i ? { ...p, [k]: e.target.value } : p)));
  const total = round2(parcelas.reduce((s, p) => s + num(p.valor), 0));
  // divide o total em N parcelas mensais a partir do primeiro vencimento (a diferença de centavos fica na última)
  const gerarParcelas = () => {
    const n = Math.max(1, Math.min(60, Number(gerar.qtd) || 1));
    const tudo = num(gerar.total);
    const primeiro = parcelas[0]?.vencimento;
    if (!(tudo > 0) || !primeiro) {
      setErro('Para gerar as parcelas, informe o valor total e o vencimento da primeira.');
      return;
    }
    setErro('');
    const cada = Math.floor((tudo / n) * 100) / 100;
    setParcelas(Array.from({ length: n }, (_, i) => ({ numero: '', vencimento: maisMeses(primeiro, i), valor: String(i === n - 1 ? round2(tudo - cada * (n - 1)) : cada).replace('.', ',') })));
  };
  const salvar = async () => {
    setBusy(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/titulos`, {
        method: 'POST',
        body: { ...d, fornecedorCode: fornecedor?.code, rateio: rateio.map((l) => ({ despesaCode: l.despesaCode, centroCustoCode: l.centroCustoCode, percentual: num(l.percentual) })), duplicata: duplicata || undefined, parcelas: parcelas.map((p) => ({ parcela: numeroDa(p) || undefined, vencimento: p.vencimento, valor: num(p.valor) })) },
      });
      onSalvou(j.message || 'Duplicata incluída');
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="my-6 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          <h3 className="flex-1 text-lg font-bold text-[#000638]">Nova duplicata</h3>
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {erro && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="col-span-2">
            <label className={labelCls}>Empresa</label>
            <select value={d.empresa} onChange={set('empresa')} className={inputCls}>
              <option value="">Escolha</option>
              {op.empresas.map((e) => (
                <option key={e.code} value={e.code}>
                  {e.code} — {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Fornecedor</label>
            <BuscaFornecedor valor={fornecedor} onEscolher={setFornecedor} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Duplicata</label>
            <select value={duplicata} onChange={(e) => setDuplicata(e.target.value)} disabled={!d.empresa || !fornecedor} className={inputCls}>
              <option value="">Nova — duplicata {proxima}</option>
              {existentes.map((x) => (
                <option key={x.duplicata} value={x.duplicata}>
                  Duplicata {x.duplicata} — já tem a(s) parcela(s) {x.parcelas.join(', ')}
                  {x.despesa ? ` · ${x.despesa}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Documento fiscal</label>
            <input value={d.documentoFiscal} onChange={set('documentoFiscal')} maxLength={40} placeholder="nº da nota / fatura" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tipo de documento</label>
            <select value={d.tipoDocumento} onChange={set('tipoDocumento')} className={inputCls}>
              {Object.entries(op.tiposDocumento).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Emissão</label>
            <input type="date" value={d.emissao} onChange={set('emissao')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Entrada</label>
            <input type="date" value={d.entrada} onChange={set('entrada')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Previsão</label>
            <select value={d.previsao} onChange={set('previsao')} className={inputCls}>
              <option value="real">Real</option>
              <option value="previsao">Previsão</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Portador</label>
            <select value={d.portadorCode} onChange={set('portadorCode')} className={inputCls}>
              <Opcoes lista={op.portadores} vazio="—" />
            </select>
          </div>
          <div>
            <label className={labelCls}>Forma de pagamento</label>
            <select value={d.formaPagamento} onChange={set('formaPagamento')} className={inputCls}>
              <option value="">—</option>
              {Object.entries(op.formas).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Competência</label>
            <input value={d.referencia} onChange={set('referencia')} placeholder="ex.: 11/2026" maxLength={20} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Chave Pix / copia e cola</label>
            <input value={d.chavePix} onChange={set('chavePix')} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Código de barras</label>
            <input value={d.codigoBarras} onChange={set('codigoBarras')} className={inputCls} />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className={labelCls}>Observação</label>
            <textarea value={d.observacao} onChange={set('observacao')} rows={2} className={`${inputCls} h-auto py-1.5`} />
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <p className="flex-1 text-sm font-bold text-[#000638]">Parcelas</p>
            <div className="w-28">
              <label className={labelCls}>Valor total</label>
              <input inputMode="decimal" value={gerar.total} onChange={(e) => setGerar((g) => ({ ...g, total: e.target.value }))} placeholder="0,00" className={inputCls} />
            </div>
            <div className="w-16">
              <label className={labelCls}>Vezes</label>
              <input inputMode="numeric" value={gerar.qtd} onChange={(e) => setGerar((g) => ({ ...g, qtd: e.target.value }))} className={inputCls} />
            </div>
            <button type="button" onClick={gerarParcelas} className={btnSec}>
              Dividir em parcelas mensais
            </button>
          </div>
          {parcelas.map((p, i) => (
            <div key={i} className="mb-1.5 flex items-end gap-2">
              <div className="w-24">
                {i === 0 && <label className={labelCls}>Parcela</label>}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold tabular-nums text-gray-500">{numeroDup}/</span>
                  <input inputMode="numeric" value={p.numero} onChange={setParcela(i, 'numero')} placeholder={String(parcelaDoMes(p.vencimento) || 'mês')} title="Em branco, a parcela é o mês do vencimento" className={inputCls} />
                </div>
              </div>
              <div className="flex-1">
                {i === 0 && <label className={labelCls}>Vencimento</label>}
                <input type="date" value={p.vencimento} onChange={setParcela(i, 'vencimento')} className={inputCls} />
              </div>
              <div className="flex-1">
                {i === 0 && <label className={labelCls}>Valor</label>}
                <input inputMode="decimal" value={p.valor} onChange={setParcela(i, 'valor')} placeholder="0,00" className={inputCls} />
              </div>
              <button type="button" onClick={() => setParcelas((ps) => (ps.length > 1 ? ps.filter((_, n) => n !== i) : ps))} disabled={parcelas.length === 1} className="mb-0.5 rounded-lg p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-30" title="Tirar parcela">
                <Trash size={15} />
              </button>
            </div>
          ))}
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => setParcelas((ps) => [...ps, { numero: '', vencimento: ps.at(-1)?.vencimento ? maisMeses(ps.at(-1).vencimento, 1) : '', valor: '' }])} className={btnSec}>
              <Plus size={13} weight="bold" /> Parcela
            </button>
            <p className="flex-1 text-right text-sm font-bold tabular-nums text-[#000638]">
              {parcelas.length} parcela(s) · {fmtBRL(total)}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <EditorRateio linhas={rateio} onChange={setRateio} op={op} valorBase={total} />
          {parcelas.length > 1 && <p className="mt-1 text-[10.5px] text-gray-500">O mesmo rateio vale para todas as parcelas; o valor de cada linha é calculado em cada parcela.</p>}
        </div>

        <p className="mt-3 text-[10.5px] text-gray-500">
          A duplicata é uma só por fornecedor e empresa; cada lançamento é uma parcela dela. Em branco, a parcela é o mês do vencimento (1/11 = duplicata 1, novembro; 1/12 = dezembro). Conta que vem todo mês: escolha a duplicata que já existe.
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <button onClick={onFechar} disabled={busy} className={`${btnSec} h-10`}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={busy || !fornecedor || !d.empresa || !rateioOk(rateio) || !(total > 0)} className={btnPri}>
            {busy ? <Spinner size={15} className="animate-spin" /> : <CheckCircle size={15} weight="bold" />} INCLUIR DUPLICATA
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── detalhe: alterar, baixar, cancelar ──────────────────────────────────────
function Detalhe({ id: idInicial, op, onFechar, onMudou }) {
  const [id, setId] = useState(idInicial); // muda ao clicar no número de outra parcela
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState(null); // 'editar' | 'baixar' | 'cancelar'
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState('');
  const carregar = useCallback(async () => {
    try {
      const j = await apiJson(`${API}/titulos/${id}`);
      setD(j.data);
    } catch (e) {
      setErro(e.message);
    }
  }, [id]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const t = d?.titulo;
  const irParaParcela = (outroId) => {
    if (outroId === id) return;
    setModo(null);
    setErro('');
    setD(null);
    setId(outroId);
  };
  const setCampo = (k) => (e) => setForm((x) => ({ ...x, [k]: e.target.value }));
  // escrituração da nota fiscal: pendente | escriturada | null (tira a marca) — vale também para a duplicata já paga
  const escriturar = async (novo) => {
    setBusy(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/titulos/escrituracao`, { method: 'POST', body: { ids: [t.id], escrituracao: novo } });
      await carregar();
      onMudou(j?.message || 'Escrituração atualizada');
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  const copiar = async (rotulo, valor) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(rotulo);
      setTimeout(() => setCopiado(''), 2500);
    } catch {
      setErro('Não consegui copiar; selecione o texto e copie à mão.');
    }
  };
  const abrir = (m) => {
    setErro('');
    if (m === 'editar') setForm({ vencimento: String(t.vencimento).slice(0, 10), valor: String(t.valor).replace('.', ','), formaPagamento: t.forma_pagamento || '', portadorCode: t.portador_code || '', rateio: (t.rateio?.length ? t.rateio : [{ despesa_code: t.despesa_code, centro_custo_code: t.centro_custo_code, percentual: 100 }]).map((r) => ({ despesaCode: r.despesa_code || '', centroCustoCode: r.centro_custo_code || '', percentual: String(r.percentual).replace('.', ',') })), chavePix: t.chave_pix || '', codigoBarras: t.codigo_barras || '', referencia: t.referencia || '', documentoFiscal: t.documento_fiscal || '', observacao: t.observacao || '', previsao: t.previsao });
    if (m === 'baixar') setForm({ data: hojeIso(), valorPago: '', juros: '', multa: '', desconto: '', forma: t.forma_pagamento || 'pix', conta: '', obs: '', senha: '' });
    if (m === 'cancelar') setForm({ motivo: '', senha: '' });
    setModo(m);
  };
  // baixa: "Valor pago" em branco paga tudo o que falta; menor que isso é baixa parcial
  const saldo = t ? Number(t.tela?.saldo ?? t.valor) : 0;
  const cheio = modo === 'baixar' ? round2(saldo + num(form.juros) + num(form.multa) - num(form.desconto)) : 0;
  const pago = modo === 'baixar' ? (String(form.valorPago || '').trim() ? round2(num(form.valorPago)) : cheio) : 0;
  const resta = modo === 'baixar' ? round2(saldo - (pago - num(form.juros) - num(form.multa) + num(form.desconto))) : 0;
  const baixaParcial = resta > 0.005;
  const baixaInvalida = pago < 0 || pago > cheio + 0.005 || resta > saldo + 0.005 || (baixaParcial && !(pago > 0));
  const enviar = async () => {
    setBusy(true);
    setErro('');
    try {
      let j;
      if (modo === 'editar') j = await apiJson(`${API}/titulos/${t.id}`, { method: 'PUT', body: { ...form, valor: num(form.valor), rateio: form.rateio.map((l) => ({ despesaCode: l.despesaCode, centroCustoCode: l.centroCustoCode, percentual: num(l.percentual) })) } });
      if (modo === 'baixar') j = await apiJson(`${API}/titulos/${t.id}/baixar`, { method: 'POST', body: { dataPagamento: form.data, valorPago: String(form.valorPago || '').trim() ? num(form.valorPago) : null, juros: num(form.juros), multa: num(form.multa), desconto: num(form.desconto), formaPagamento: form.forma, conta: form.conta, observacao: form.obs, senha: form.senha } });
      if (modo === 'cancelar') j = await apiJson(`${API}/titulos/${t.id}/cancelar`, { method: 'POST', body: { motivo: form.motivo, senha: form.senha } });
      setModo(null);
      await carregar();
      onMudou(j?.message || 'Duplicata atualizada');
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="my-6 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-[#000638]">{t ? `Duplicata ${t.duplicata} · parcela ${t.parcela}${t.documento_fiscal ? ` · documento fiscal ${t.documento_fiscal}` : ''}` : 'Duplicata'}</h3>
            {t && (
              <p className="truncate text-xs text-gray-500">
                {t.fornecedor_code} · {t.fornecedor_nome} · empresa {t.empresa}
                {t.origem === 'totvs' ? ' · importada do TOTVS' : t.origem !== 'manual' ? ` · incluída por ${t.origem}` : ''}
              </p>
            )}
          </div>
          {t?.origem === 'totvs' && <MarcaTotvs />}
          {t && <Situacao t={t} />}
          {t?.liberacao && <SeloLiberacao l={t.liberacao} />}
          {t && <SeloEscrituracao t={t} />}
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {erro && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        {!d ? (
          !erro && (
            <div className="py-10 text-center text-gray-400">
              <Spinner size={20} className="mx-auto animate-spin" />
            </div>
          )
        ) : (
          <div className="space-y-3">
            {/* todas as parcelas da duplicata: os números trocam a parcela aberta e a lista mostra todas de uma vez */}
            <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="mr-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Parcelas da duplicata {t.duplicata}</p>
                {d.parcelas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => irParaParcela(p.id)}
                    title={`Parcela ${p.parcela} · ${fmtBRL(p.valor)} · ${abatimento(p) ? 'abatimento' : p.situacao === 'pago' ? `paga em ${fmtData(p.data_pagamento)}` : parcial(p) ? `paga em parte (${fmtBRL(p.valor_pago)}), vence em ${fmtData(p.vencimento)}` : p.situacao === 'cancelado' ? 'cancelada' : `vence em ${fmtData(p.vencimento)}`}`}
                    className={`h-8 min-w-[2rem] rounded-lg px-2 text-xs font-bold ring-1 ${p.id === t.id ? 'bg-[#000638] text-white ring-[#000638]' : `bg-white hover:bg-gray-50 ${corParcela(p)}`}`}
                  >
                    {p.parcela}
                  </button>
                ))}
                <p className="ml-auto text-[11px] font-semibold tabular-nums text-gray-500">
                  {d.parcelas.length} parcela(s) · {fmtBRL(d.parcelas.filter((p) => p.situacao !== 'cancelado').reduce((s, p) => s + Number(p.valor), 0))}
                </p>
              </div>
              {d.parcelas.length > 1 && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        <th className="px-2 py-1">Parcela</th>
                        <th className="px-2 py-1">Doc. fiscal</th>
                        <th className="px-2 py-1">Competência</th>
                        <th className="px-2 py-1">Vencimento</th>
                        <th className="px-2 py-1 text-right">Valor</th>
                        <th className="px-2 py-1">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.parcelas.map((p) => (
                        <tr key={p.id} onClick={() => irParaParcela(p.id)} className={`cursor-pointer border-t border-gray-100 ${p.id === t.id ? 'bg-indigo-50 font-semibold' : 'hover:bg-gray-50'}`}>
                          <td className="px-2 py-1 tabular-nums text-[#000638]">{rotuloDup(p)}</td>
                          <td className="px-2 py-1 tabular-nums">{p.documento_fiscal || '—'}</td>
                          <td className="px-2 py-1 tabular-nums">{p.referencia || '—'}</td>
                          <td className="px-2 py-1 tabular-nums">{fmtData(p.vencimento)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(p.valor)}</td>
                          <td className={`px-2 py-1 ${corParcela(p).split(' ')[0]}`}>{abatimento(p) ? 'Abatimento' : p.situacao === 'pago' ? `Paga em ${fmtData(p.data_pagamento)}` : parcial(p) ? `Paga parcial (${fmtBRL(p.valor_pago)})` : p.situacao === 'cancelado' ? 'Cancelada' : String(p.vencimento).slice(0, 10) < hojeIso() ? 'Vencida' : 'Em aberto'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200 sm:grid-cols-4">
              <Campo rotulo="Fornecedor">{t.fornecedor_nome}</Campo>
              <Campo rotulo="Código">{t.fornecedor_code}</Campo>
              <Campo rotulo="CPF/CNPJ">{t.fornecedor_cpf_cnpj}</Campo>
              <Campo rotulo="Duplicata / parcela">{rotuloDup(t)}</Campo>
              <Campo rotulo="Documento fiscal">{t.documento_fiscal}</Campo>
              <Campo rotulo="Tipo de documento">{op.tiposDocumento[t.tipo_documento] || t.tipo_documento}</Campo>
              <Campo rotulo="Portador">{t.portador_code ? `${t.portador_code} · ${t.portador_nome}` : null}</Campo>
              <Campo rotulo="Forma de pagamento">{op.formas[t.forma_pagamento]}</Campo>
              <Campo rotulo="Emissão">{fmtData(t.emissao)}</Campo>
              <Campo rotulo="Entrada">{fmtData(t.entrada)}</Campo>
              <Campo rotulo="Vencimento">{fmtData(t.vencimento)}</Campo>
              <Campo rotulo="Competência">{t.referencia}</Campo>
              <Campo rotulo="Valor">{fmtBRL(t.valor)}</Campo>
              <Campo rotulo="Juros / multa">{`${fmtBRL(t.juros)} / ${fmtBRL(t.multa)}`}</Campo>
              <Campo rotulo="Desconto">{fmtBRL(t.desconto)}</Campo>
              <Campo rotulo="Valor pago">{t.situacao === 'pago' || parcial(t) ? fmtBRL(t.valor_pago) : null}</Campo>
              {t.situacao === 'aberto' && <Campo rotulo="Falta pagar">{fmtBRL(t.tela?.saldo ?? t.valor)}</Campo>}
              <Campo rotulo="Pagamento">{fmtData(t.data_pagamento)}</Campo>
              <Campo rotulo="Conta do pagamento">{t.conta_pagamento}</Campo>
              <Campo rotulo="Previsão">{t.previsao === 'previsao' ? 'Previsão' : 'Real'}</Campo>
              <Campo rotulo="Incluída por">{`${autorExibicao(t.criado_por) || '—'} · ${fmtDataHora(t.criado_em)}`}</Campo>
              {t.baixado_por && <Campo rotulo="Baixada por">{`${autorExibicao(t.baixado_por)} · ${fmtDataHora(t.baixado_em)}`}</Campo>}
              {t.situacao === 'cancelado' && (
                <Campo rotulo="Cancelada" largo>
                  {`${t.cancelado_por || ''} · ${fmtDataHora(t.cancelado_em)} · ${t.cancelado_motivo || ''}`}
                </Campo>
              )}
              {t.observacao && (
                <Campo rotulo="Observação" largo>
                  {t.observacao}
                </Campo>
              )}
            </div>

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
                  {(t.rateio?.length ? t.rateio : [{ despesa_code: t.despesa_code, despesa_nome: t.despesa_nome, centro_custo_code: t.centro_custo_code, centro_custo_nome: t.centro_custo_nome, percentual: 100, valor: t.valor }]).map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">{r.despesa_code ? `${r.despesa_code} · ${r.despesa_nome}` : '—'}</td>
                      <td className="px-2 py-1.5">{r.centro_custo_code ? `${r.centro_custo_code} · ${r.centro_custo_nome || ''}` : <span className="text-amber-700">sem centro de custo</span>}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{String(r.percentual).replace('.', ',')}%</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtBRL(r.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(t.chave_pix || t.codigo_barras || d.anexoUrl) && (
              <div className="flex flex-wrap gap-2">
                {t.chave_pix && (
                  <button onClick={() => copiar('pix', t.chave_pix)} className={btnSec} title={t.chave_pix}>
                    <Copy size={13} weight="bold" /> {copiado === 'pix' ? 'Pix copiado' : 'Copiar Pix'}
                  </button>
                )}
                {t.codigo_barras && (
                  <button onClick={() => copiar('barras', t.codigo_barras)} className={btnSec} title={t.codigo_barras}>
                    <Copy size={13} weight="bold" /> {copiado === 'barras' ? 'Código copiado' : 'Copiar código de barras'}
                  </button>
                )}
                {d.anexoUrl && (
                  <a href={d.anexoUrl} target="_blank" rel="noreferrer" className={btnSec}>
                    <FilePdf size={13} weight="bold" /> Abrir documento (PDF)
                  </a>
                )}
              </div>
            )}

            {d.baixas.length > 0 && (
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">{d.baixas.length > 1 ? `Baixas (${d.baixas.length} pagamentos)` : 'Baixa'}</p>
                {d.baixas.map((b) => (
                  <p key={b.id} className="text-xs text-gray-700">
                    {fmtData(b.data_pagamento)} · pago <b>{fmtBRL(b.valor_pago)}</b> (em aberto {fmtBRL(b.valor_titulo)} + juros {fmtBRL(b.juros)} + multa {fmtBRL(b.multa)} − desconto {fmtBRL(b.desconto)})
                    {faltaDepois(b) > 0.005 && <span className="font-semibold text-amber-700"> · ficou faltando {fmtBRL(faltaDepois(b))}</span>} · {op.formas[b.forma_pagamento] || '—'}
                    {b.conta ? ` · ${b.conta}` : ''} · {autorExibicao(b.por)} em {fmtDataHora(b.em)}
                    {b.observacao ? ` · ${b.observacao}` : ''}
                  </p>
                ))}
              </div>
            )}

            {t.situacao !== 'cancelado' && !modo && (
              <div className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs ring-1 ${t.escrituracao === 'pendente' ? 'bg-orange-50/70 ring-orange-200' : 'bg-gray-50 ring-gray-200'}`}>
                <span className="font-bold text-[#000638]">Escrituração da nota fiscal</span>
                {t.escrituracao ? <SeloEscrituracao t={t} /> : <span className="text-gray-500">sem marca (não se aplica)</span>}
                {t.escrituracao && t.escrituracao_em && (
                  <span className="text-gray-500">
                    {t.escrituracao_por ? autorExibicao(t.escrituracao_por) : 'veio da solicitação'} · {fmtDataHora(t.escrituracao_em)}
                  </span>
                )}
                {t.escrituracao === 'pendente' && !t.escrituracao_em && <span className="text-gray-500">veio da solicitação com nota fiscal</span>}
                <div className="ml-auto flex flex-wrap gap-2">
                  {t.escrituracao !== 'escriturada' && (
                    <button onClick={() => escriturar('escriturada')} disabled={busy} className={`${btnSec} h-8 text-teal-700`}>
                      Marcar ESCRITURADA
                    </button>
                  )}
                  {t.escrituracao !== 'pendente' && (
                    <button onClick={() => escriturar('pendente')} disabled={busy} className={`${btnSec} h-8 text-orange-700`}>
                      Marcar NÃO ESCRITURADA
                    </button>
                  )}
                  {t.escrituracao && (
                    <button onClick={() => escriturar(null)} disabled={busy} className={`${btnSec} h-8 text-gray-600`}>
                      Tirar a marca
                    </button>
                  )}
                </div>
              </div>
            )}

            {t.situacao === 'aberto' && !modo && (
              <div className="flex flex-wrap justify-end gap-2">
                {!parcial(t) && (
                  <button onClick={() => abrir('cancelar')} className={`${btnSec} h-10 text-rose-700`}>
                    <Prohibit size={14} weight="bold" /> Cancelar duplicata
                  </button>
                )}
                <button onClick={() => abrir('editar')} className={`${btnSec} h-10`}>
                  <PencilSimple size={14} weight="bold" /> Alterar
                </button>
                <button onClick={() => abrir('baixar')} className={btnPri}>
                  <CheckCircle size={15} weight="bold" /> {parcial(t) ? 'BAIXAR O QUE FALTA' : 'BAIXAR DUPLICATA'}
                </button>
              </div>
            )}

            {modo === 'editar' && (
              <div className="rounded-xl bg-indigo-50/50 p-3 ring-1 ring-indigo-200">
                <p className="mb-2 text-sm font-bold text-[#000638]">Alterar duplicata</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className={labelCls}>Vencimento</label>
                    <input type="date" value={form.vencimento} onChange={setCampo('vencimento')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Valor</label>
                    <input inputMode="decimal" value={form.valor} onChange={setCampo('valor')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Forma de pagamento</label>
                    <select value={form.formaPagamento} onChange={setCampo('formaPagamento')} className={inputCls}>
                      <option value="">—</option>
                      {Object.entries(op.formas).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Previsão</label>
                    <select value={form.previsao} onChange={setCampo('previsao')} className={inputCls}>
                      <option value="real">Real</option>
                      <option value="previsao">Previsão</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Portador</label>
                    <select value={form.portadorCode} onChange={setCampo('portadorCode')} className={inputCls}>
                      <Opcoes lista={op.portadores} vazio="—" />
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Documento fiscal</label>
                    <input value={form.documentoFiscal} onChange={setCampo('documentoFiscal')} maxLength={40} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Competência</label>
                    <input value={form.referencia} onChange={setCampo('referencia')} maxLength={20} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Chave Pix / copia e cola</label>
                    <input value={form.chavePix} onChange={setCampo('chavePix')} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Código de barras</label>
                    <input value={form.codigoBarras} onChange={setCampo('codigoBarras')} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Observação</label>
                    <input value={form.observacao} onChange={setCampo('observacao')} className={inputCls} />
                  </div>
                </div>
                <div className="mt-2">
                  <EditorRateio linhas={form.rateio} onChange={(r) => setForm((x) => ({ ...x, rateio: r }))} op={op} valorBase={num(form.valor)} />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={() => setModo(null)} disabled={busy} className={`${btnSec} h-10`}>
                    Voltar
                  </button>
                  <button onClick={enviar} disabled={busy || !rateioOk(form.rateio)} className={btnPri}>
                    {busy ? <Spinner size={15} className="animate-spin" /> : <CheckCircle size={15} weight="bold" />} SALVAR
                  </button>
                </div>
              </div>
            )}

            {modo === 'baixar' && (
              <div className="rounded-xl bg-emerald-50/60 p-3 ring-1 ring-emerald-200">
                <p className="mb-2 text-sm font-bold text-emerald-900">Baixa da duplicata{parcial(t) ? ` — falta pagar ${fmtBRL(saldo)} de ${fmtBRL(t.valor)}` : ''}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className={labelCls}>Data do pagamento</label>
                    <input type="date" value={form.data} max={hojeIso()} onChange={setCampo('data')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls} title="Em branco = paga tudo o que falta. Menor = baixa parcial: a duplicata continua em aberto pelo restante.">
                      Valor pago
                    </label>
                    <input inputMode="decimal" value={form.valorPago} onChange={setCampo('valorPago')} placeholder={fmtBRL(cheio)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Juros</label>
                    <input inputMode="decimal" value={form.juros} onChange={setCampo('juros')} placeholder="0,00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Multa</label>
                    <input inputMode="decimal" value={form.multa} onChange={setCampo('multa')} placeholder="0,00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Desconto</label>
                    <input inputMode="decimal" value={form.desconto} onChange={setCampo('desconto')} placeholder="0,00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Pago por</label>
                    <select value={form.forma} onChange={setCampo('forma')} className={inputCls}>
                      {Object.entries(op.formas).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Conta / banco</label>
                    <input value={form.conta} onChange={setCampo('conta')} placeholder="ex.: Stone 0549" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Observação</label>
                    <input value={form.obs} onChange={setCampo('obs')} className={inputCls} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="flex-1">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">Valor pago</p>
                    <p className="text-xl font-bold tabular-nums text-emerald-800">{fmtBRL(pago)}</p>
                    {baixaParcial && !baixaInvalida && (
                      <p className="text-xs font-bold text-amber-700">
                        Baixa parcial: continua em aberto {fmtBRL(resta)} de {fmtBRL(saldo)}
                      </p>
                    )}
                    {pago > cheio + 0.005 && <p className="text-xs font-bold text-rose-700">O valor pago é maior que o que falta pagar ({fmtBRL(cheio)}).</p>}
                    <p className="text-[10.5px] text-gray-500">A baixa não tem estorno. Para pagar só uma parte, preencha o valor pago.</p>
                  </div>
                  <div className="w-48">
                    <label className={labelCls}>Sua senha do HeadCoach</label>
                    <input type="password" autoComplete="off" value={form.senha} onChange={setCampo('senha')} className={inputCls} />
                  </div>
                  <button onClick={() => setModo(null)} disabled={busy} className={`${btnSec} h-10`}>
                    Voltar
                  </button>
                  <button onClick={enviar} disabled={busy || !form.senha || baixaInvalida} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                    {busy ? <Spinner size={15} className="animate-spin" /> : <CheckCircle size={15} weight="bold" />} {baixaParcial ? 'CONFIRMAR BAIXA PARCIAL' : 'CONFIRMAR BAIXA'}
                  </button>
                </div>
              </div>
            )}

            {modo === 'cancelar' && (
              <div className="rounded-xl bg-rose-50/60 p-3 ring-1 ring-rose-200">
                <p className="mb-2 text-sm font-bold text-rose-900">Cancelar duplicata</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <label className={labelCls}>Motivo</label>
                    <input value={form.motivo} onChange={setCampo('motivo')} className={inputCls} />
                  </div>
                  <div className="w-48">
                    <label className={labelCls}>Sua senha do HeadCoach</label>
                    <input type="password" autoComplete="off" value={form.senha} onChange={setCampo('senha')} className={inputCls} />
                  </div>
                  <button onClick={() => setModo(null)} disabled={busy} className={`${btnSec} h-10`}>
                    Voltar
                  </button>
                  <button onClick={enviar} disabled={busy || !form.senha || form.motivo.trim().length < 5} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-40">
                    {busy ? <Spinner size={15} className="animate-spin" /> : <Prohibit size={15} weight="bold" />} CONFIRMAR CANCELAMENTO
                  </button>
                </div>
                <p className="mt-1 text-[10.5px] text-gray-500">A duplicata continua na consulta, marcada como cancelada.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
