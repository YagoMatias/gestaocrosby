// ============================================================================
// HEADCOACH › FINANCEIRO › LIBERAÇÃO DE PAGAMENTO (Yago, 23/11/2026)
// Versão simplificada da Liberação de Pagamento antiga, só com as duplicatas do
// Contas a Pagar do HeadCoach (nada do TOTVS). No Contas a Pagar o financeiro
// marca as duplicatas e clica em LIBERAR PARA PAGAMENTO; aqui elas seguem
//     PENDENTE → PREVISÃO → APROVADO → INCLUÍDO → PAGO
//   • entre as quatro primeiras etapas vai e volta à vontade;
//   • PAGAR grava a baixa na duplicata (sem estorno) — pede a senha;
//   • DEVOLVER tira da liberação (a duplicata continua em aberto no contas a pagar);
//   • o valor da liberação pode ser menor que o que falta (pagamento parcial).
// API: /api/hc/contas-pagar/liberacoes (services/hcCpLiberacao.js).
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { autorExibicao } from '../utils/autorExibicao';
import { Link } from 'react-router-dom';
import { CurrencyDollar, Clock, CalendarCheck, CheckCircle, Bank, Receipt, Spinner, MagnifyingGlass, X, Copy, PencilSimple, ArrowUUpLeft, ArrowsClockwise, Lightning, Wallet, CaretDown, ListBullets, Kanban, Warning, ArrowsLeftRight, Robot } from '@phosphor-icons/react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, LabelList } from 'recharts';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';
import { useAoAtivarAba } from '../components/AppTabs/TabContext';
import StoneEntreContasModal from '../components/StoneEntreContasModal';

const API = '/api/hc/contas-pagar/liberacoes';
const PERFIS_FINANCEIRO = ['owner', 'admin', 'user'];
const POR_PAGINA = 50;
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const hojeIso = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date());
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500';
const celCls = 'h-7 w-full rounded border border-gray-200 bg-white px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#000638]/40';

// etapas do fluxo, na ordem
const ETAPAS = [
  { k: 'pendente', label: 'Pendentes', um: 'Pendente', acao: 'PENDENTE', cor: 'border-yellow-200 text-yellow-700', selo: 'bg-yellow-100 text-yellow-800 border-yellow-300', Icon: Clock },
  { k: 'previsao', label: 'Previsão', um: 'Previsão', acao: 'PREVISÃO', cor: 'border-orange-200 text-orange-700', selo: 'bg-orange-100 text-orange-800 border-orange-300', Icon: CalendarCheck },
  { k: 'aprovado', label: 'Aprovados', um: 'Aprovado', acao: 'APROVAR', cor: 'border-blue-200 text-blue-700', selo: 'bg-blue-100 text-blue-800 border-blue-300', Icon: CheckCircle },
  { k: 'incluido', label: 'Incluídos', um: 'Incluído', acao: 'INCLUÍDO', cor: 'border-violet-200 text-violet-700', selo: 'bg-violet-100 text-violet-800 border-violet-300', Icon: Bank },
  { k: 'pago', label: 'Pagos', um: 'Pago', acao: 'PAGAR', cor: 'border-green-200 text-green-700', selo: 'bg-green-100 text-green-800 border-green-300', Icon: CheckCircle },
];
const ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.k, e]));
const EM_ANDAMENTO = ['pendente', 'previsao', 'aprovado', 'incluido'];

function CardEtapa({ etapa, dados, ativo, onClick }) {
  const { Icon } = etapa;
  return (
    <button type="button" onClick={onClick} className={`min-w-[140px] flex-1 rounded-xl border bg-white p-3 text-left shadow transition-shadow hover:shadow-md ${etapa.cor} ${ativo ? 'ring-2 ring-[#000638]' : ''}`}>
      <div className="mb-1 flex items-center gap-2">
        <Icon size={16} weight="bold" />
        <span className="text-[10px] font-bold uppercase tracking-wide">{etapa.label}</span>
      </div>
      <div className="text-xl font-bold">{dados?.qtd || 0}</div>
      <div className="text-[11px] font-semibold opacity-80">{fmtBRL(dados?.valor)}</div>
    </button>
  );
}

// "24/11 às 14:02" (horário de Recife)
const fmtQuando = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = d.toLocaleDateString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Recife', hour: '2-digit', minute: '2-digit' });
  return `${dia} às ${hora}`;
};

/**
 * SALDO BANCÁRIO: o total (Stone com o antecipável + Pagar.me disponível + os
 * bancos informados à mão), um chip por banco e QUANDO o saldo foi atualizado
 * pela última vez (o bot consulta de hora em hora, de segunda a sexta, 9h–20h).
 * Clicar em STONE ou PAGARME abre as contas.
 */
function CardSaldos({ saldos, carregando, erro, onAtualizar, onEntreContas }) {
  const [aberto, setAberto] = useState(null); // 'STONE' | 'PAGARME'
  const s = saldos || {};
  const bancos = s.bancos || [];
  const comSaldo = bancos.filter((b) => Number(b.valor) > 0).length;
  // mais de 90 min sem atualizar em horário de consulta: avisa que o número pode estar velho
  const minutos = s.atualizadoEm ? Math.round((Date.now() - new Date(s.atualizadoEm).getTime()) / 60000) : null;
  const velho = minutos != null && minutos > 90;
  const contas = aberto === 'STONE' ? s.stone || [] : aberto === 'PAGARME' ? s.pagarme || [] : [];
  return (
    <div className="mb-4 rounded-xl border border-teal-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
          <Wallet size={20} weight="bold" />
        </div>
        <div className="min-w-[180px]">
          <div className="text-[10px] font-bold uppercase tracking-wide text-teal-700">
            Saldo bancário <span className="font-normal normal-case tracking-normal text-gray-400">· {comSaldo} banco(s)</span>
          </div>
          <div className="text-2xl font-extrabold leading-tight text-gray-900">{saldos ? fmtBRL(s.total) : carregando ? '…' : '—'}</div>
          <div className={`text-[11px] ${velho ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
            {saldos ? (
              <>
                Atualizado em <b className={velho ? '' : 'text-gray-800'}>{fmtQuando(s.atualizadoEm)}</b>
                {velho ? ' · pode estar desatualizado' : ''}
              </>
            ) : erro ? (
              <span className="text-rose-700">{erro}</span>
            ) : (
              'Carregando o saldo…'
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {bancos.map((b) => {
            const abre = b.banco === 'STONE' || b.banco === 'PAGARME';
            const on = Number(b.valor) > 0;
            return (
              <button
                key={b.banco}
                type="button"
                disabled={!abre}
                onClick={() => setAberto((a) => (a === b.banco ? null : b.banco))}
                title={`${b.automatico ? 'Atualizado pelo bot' : 'Informado à mão'} em ${fmtQuando(b.atualizadoEm)}`}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${on ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-gray-200 bg-gray-50 text-gray-400'} ${abre ? 'hover:brightness-95' : 'cursor-default'} ${aberto === b.banco ? 'ring-2 ring-teal-300' : ''}`}
              >
                {b.banco}: {fmtBRL(b.valor)}
                {abre && <CaretDown size={10} weight="bold" className={aberto === b.banco ? 'rotate-180' : ''} />}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onEntreContas} title="Transferir entre as contas da Stone: o bot inclui e o Fábio aprova" className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#000638] px-2.5 text-[11px] font-bold text-white hover:bg-indigo-900">
          <ArrowsLeftRight size={12} weight="bold" /> Entre contas
        </button>
        <button type="button" onClick={onAtualizar} disabled={carregando} title="Ler de novo o saldo guardado (o bot consulta o banco de hora em hora)" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40">
          {carregando ? <Spinner size={12} className="animate-spin" /> : <ArrowsClockwise size={12} weight="bold" />} Recarregar
        </button>
      </div>
      {aberto && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <p className="mb-1 text-[11px] font-bold text-gray-500">
            {aberto === 'STONE' ? 'Stone por conta (final do CNPJ)' : 'Pagar.me'}
            {aberto === 'STONE' && Number(s.antecipavel) > 0 ? <span className="text-amber-700"> · {fmtBRL(s.antecipavel)} para antecipar (já no total)</span> : null}
          </p>
          <div className="grid grid-cols-1 gap-x-6 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {contas.length ? (
              contas.map((c) => (
                <div key={c.rotulo} className="flex items-center justify-between gap-2 border-b border-dashed border-gray-100 py-1" title={c.titular || ''}>
                  <span className="truncate font-semibold text-gray-600">{c.rotulo}</span>
                  <span className="whitespace-nowrap">
                    <b className={Number(c.saldo) > 0 ? 'text-gray-900' : 'font-medium text-gray-400'}>{fmtBRL(c.saldo)}</b>
                    {Number(c.antecipavel) > 0 && <span className="ml-1 text-[10px] text-amber-700">+{fmtBRL(c.antecipavel)} antec.</span>}
                    {Number(c.aReceber) > 0 && <span className="ml-1 text-[10px] text-fuchsia-700">+{fmtBRL(c.aReceber)} a receber</span>}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-gray-400">sem captura</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Previsão por dia (gráfico de linha) ─────────────────────────────────────
const somaDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diaMes = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const diaSemana = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
// eixo: valores cheios até 9.999 e "10 mil" daí em diante (um estilo só no eixo)
const eixoReais = (max) => (v) => (max >= 10000 ? (v === 0 ? '0' : `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`) : Number(v).toLocaleString('pt-BR'));

/** Soma do que está em PREVISÃO por dia previsto. Até 45 dias de intervalo, os dias sem nada entram com zero (a linha é uma linha do tempo). */
function serieDaPrevisao(liberacoes) {
  const por = new Map();
  for (const l of liberacoes) {
    const dia = l.data_prevista ? String(l.data_prevista).slice(0, 10) : null;
    if (!dia) continue;
    const x = por.get(dia) || { dia, valor: 0, qtd: 0 };
    x.valor = Math.round((x.valor + Number(l.valor || 0)) * 100) / 100;
    x.qtd += 1;
    por.set(dia, x);
  }
  const dias = [...por.keys()].sort();
  if (!dias.length) return [];
  const ini = dias[0];
  const fim = dias[dias.length - 1];
  const intervalo = Math.round((new Date(`${fim}T12:00:00Z`) - new Date(`${ini}T12:00:00Z`)) / 86400000);
  if (intervalo > 45) return dias.map((d) => por.get(d));
  const out = [];
  for (let d = ini; d <= fim; d = somaDias(d, 1)) out.push(por.get(d) || { dia: d, valor: 0, qtd: 0 });
  return out;
}

const COR_PREVISAO = '#ea580c'; // a cor da etapa Previsão (laranja)

function DicaDoDia({ active, payload, hoje }) {
  const p = active ? payload?.[0]?.payload : null;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-lg">
      <div className="font-bold capitalize text-gray-900">
        {diaSemana(p.dia)}, {diaMes(p.dia)}
        {p.dia < hoje && p.valor > 0 ? <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-bold uppercase text-rose-700">vencido</span> : p.dia === hoje ? <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] font-bold uppercase text-gray-600">hoje</span> : null}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-gray-700">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: COR_PREVISAO }} />
        <b className="tabular-nums text-gray-900">{fmtBRL(p.valor)}</b>
        <span className="text-gray-500">· {p.qtd} duplicata(s)</span>
      </div>
      {p.qtd > 0 && <div className="mt-0.5 text-[10px] text-gray-400">clique para ver só este dia</div>}
    </div>
  );
}

/**
 * PREVISÃO POR DIA: quanto há para pagar em cada dia previsto (linha do tempo).
 * Uma série só (sem legenda: o título diz o que é). Passar o mouse mostra o dia;
 * clicar num dia filtra a tabela por ele.
 */
function GraficoPrevisao({ liberacoes, hoje, diaEscolhido, onEscolherDia }) {
  const serie = useMemo(() => serieDaPrevisao(liberacoes), [liberacoes]);
  if (!serie.length) return null;
  const total = serie.reduce((t, p) => t + p.valor, 0);
  const pico = serie.reduce((m, p) => (p.valor > m.valor ? p : m), serie[0]);
  const vencido = serie.filter((p) => p.dia < hoje).reduce((t, p) => t + p.valor, 0);
  const deHoje = serie.find((p) => p.dia === hoje)?.valor || 0;
  const temHoje = serie.some((p) => p.dia === hoje);
  const max = pico.valor;
  const umDia = serie.length === 1;
  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-orange-700">Previsão por dia</h3>
        <span className="text-xs text-gray-600">
          Total <b className="tabular-nums text-gray-900">{fmtBRL(total)}</b>
        </span>
        <span className="text-xs text-gray-600">
          Hoje <b className="tabular-nums text-gray-900">{fmtBRL(deHoje)}</b>
        </span>
        {vencido > 0 && (
          <span className="text-xs text-gray-600">
            Vencido <b className="tabular-nums text-rose-700">{fmtBRL(vencido)}</b>
          </span>
        )}
        <span className="text-xs text-gray-600">
          Maior dia <b className="tabular-nums text-gray-900">{diaMes(pico.dia)}</b> · <b className="tabular-nums text-gray-900">{fmtBRL(pico.valor)}</b>
        </span>
        {diaEscolhido && (
          <button type="button" onClick={() => onEscolherDia(null)} className="ml-auto text-xs font-semibold text-indigo-700 underline">
            mostrando só {diaMes(diaEscolhido)} · ver todos os dias
          </button>
        )}
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={serie} margin={{ top: 18, right: 16, bottom: 0, left: 0 }} onClick={(st) => st?.activeLabel && onEscolherDia(String(st.activeLabel))} style={{ cursor: 'pointer' }}>
            <CartesianGrid vertical={false} stroke="#eef0f3" />
            <XAxis dataKey="dia" tickFormatter={diaMes} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval="preserveStartEnd" minTickGap={24} padding={{ left: umDia ? 60 : 12, right: umDia ? 60 : 12 }} />
            <YAxis width={52} tickFormatter={eixoReais(max)} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
            <Tooltip content={<DicaDoDia hoje={hoje} />} cursor={{ stroke: '#9ca3af', strokeWidth: 1 }} />
            {temHoje && <ReferenceLine x={hoje} stroke="#9ca3af" strokeWidth={1} label={{ value: 'hoje', position: 'top', fontSize: 10, fill: '#6b7280' }} />}
            {diaEscolhido && serie.some((p) => p.dia === diaEscolhido) && <ReferenceLine x={diaEscolhido} stroke="#4338ca" strokeWidth={1} />}
            <Area type="linear" dataKey="valor" stroke="none" fill={COR_PREVISAO} fillOpacity={0.1} isAnimationActive={false} />
            <Line type="linear" dataKey="valor" stroke={COR_PREVISAO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" isAnimationActive={false} dot={(p) => (p.payload.valor > 0 ? <circle key={p.payload.dia} cx={p.cx} cy={p.cy} r={4} fill={COR_PREVISAO} stroke="#fff" strokeWidth={2} /> : <g key={p.payload.dia} />)} activeDot={{ r: 6, fill: COR_PREVISAO, stroke: '#fff', strokeWidth: 2 }}>
              {/* só o maior dia leva o valor escrito; os outros ficam no eixo e na dica */}
              <LabelList dataKey="valor" position="top" offset={8} formatter={(v) => (serie.length > 1 && v === max && v > 0 ? fmtBRL(v) : '')} style={{ fontSize: 10, fontWeight: 700, fill: '#111827' }} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Previsão em KANBAN ──────────────────────────────────────────────────────
/**
 * Colunas do quadro: VENCIDOS (tudo o que tem dia previsto antes de hoje, num bolo
 * só) e depois uma coluna por dia previsto, em ordem. O dia previsto nasce igual
 * ao vencimento; se alguém reprogramar, o cartão acompanha o dia novo.
 */
function colunasDoKanban(liberacoes, hoje) {
  const vencidos = [];
  const porDia = new Map();
  for (const l of liberacoes) {
    const dia = l.data_prevista ? String(l.data_prevista).slice(0, 10) : String(l.titulo?.vencimento || '').slice(0, 10);
    if (!dia || dia < hoje) vencidos.push(l);
    else {
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia).push(l);
    }
  }
  const ordem = (a, b) => String(a.data_prevista || '').localeCompare(String(b.data_prevista || '')) || Number(b.valor) - Number(a.valor);
  const cols = [];
  if (vencidos.length) cols.push({ k: 'vencidos', vencidos: true, itens: vencidos.sort(ordem) });
  for (const dia of [...porDia.keys()].sort()) cols.push({ k: dia, dia, itens: porDia.get(dia).sort((a, b) => Number(b.valor) - Number(a.valor)) });
  return cols.map((c) => ({ ...c, total: c.itens.reduce((t, l) => t + Number(l.valor || 0), 0) }));
}

function KanbanPrevisao({ liberacoes, hoje, selecionadas, marcar, onMoverDia, onAvancar, nomeEmpresa, formas, ocupado }) {
  const colunas = useMemo(() => colunasDoKanban(liberacoes, hoje), [liberacoes, hoje]);
  const [arrastando, setArrastando] = useState(null); // id da liberação
  const [sobre, setSobre] = useState(null); // coluna debaixo do cartão arrastado
  if (!colunas.length) return <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400 shadow">Nenhuma duplicata em previsão.</div>;
  const soltar = (col) => {
    const l = liberacoes.find((x) => x.id === arrastando);
    setArrastando(null);
    setSobre(null);
    if (!l || col.vencidos || !col.dia || String(l.data_prevista || '').slice(0, 10) === col.dia) return;
    onMoverDia(l, col.dia);
  };
  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-3">
      {colunas.map((col) => {
        const ids = col.itens.map((l) => l.id);
        const todasMarcadas = ids.every((id) => selecionadas.has(id));
        const alvo = arrastando != null && !col.vencidos && sobre === col.k;
        return (
          <div
            key={col.k}
            onDragOver={(e) => {
              if (arrastando == null || col.vencidos) return;
              e.preventDefault();
              if (sobre !== col.k) setSobre(col.k);
            }}
            onDragLeave={() => sobre === col.k && setSobre(null)}
            onDrop={(e) => {
              e.preventDefault();
              soltar(col);
            }}
            className={`flex w-[272px] shrink-0 flex-col rounded-xl border bg-gray-100/70 ${col.vencidos ? 'border-rose-200' : col.dia === hoje ? 'border-orange-300' : 'border-gray-200'} ${alvo ? 'ring-2 ring-indigo-400' : ''}`}
          >
            <div className={`rounded-t-xl border-b px-3 py-2 ${col.vencidos ? 'border-rose-200 bg-rose-50' : col.dia === hoje ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-2">
                <input type="checkbox" title="Selecionar a coluna" checked={todasMarcadas} onChange={(e) => marcar(ids, e.target.checked)} />
                {col.vencidos ? (
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-rose-700">
                    <Warning size={14} weight="bold" /> Vencidos
                  </span>
                ) : (
                  <span className="text-xs font-extrabold uppercase tracking-wide text-gray-800">
                    <span className="capitalize">{diaSemana(col.dia).replace('-feira', '')}</span> {diaMes(col.dia)}
                    {col.dia === hoje && <span className="ml-1.5 rounded bg-orange-200 px-1 text-[10px] text-orange-900">hoje</span>}
                  </span>
                )}
                <span className="ml-auto rounded-full bg-white px-1.5 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200">{col.itens.length}</span>
              </div>
              <div className={`mt-0.5 text-sm font-extrabold tabular-nums ${col.vencidos ? 'text-rose-700' : 'text-gray-900'}`}>{fmtBRL(col.total)}</div>
            </div>
            <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto p-2">
              {col.itens.map((l) => {
                const t = l.titulo || {};
                const venc = String(t.vencimento || '').slice(0, 10);
                const previsto = String(l.data_prevista || '').slice(0, 10);
                const marcada = selecionadas.has(l.id);
                return (
                  <div
                    key={l.id}
                    draggable={!ocupado}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(l.id));
                      setArrastando(l.id);
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setSobre(null);
                    }}
                    className={`cursor-grab rounded-lg border bg-white p-2 text-xs shadow-sm active:cursor-grabbing ${marcada ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-200'} ${arrastando === l.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5" checked={marcada} onChange={(e) => marcar([l.id], e.target.checked)} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-gray-900" title={`${t.fornecedor_code} · ${t.fornecedor_nome}`}>
                          {t.fornecedor_nome}
                        </div>
                        <div className="truncate text-[11px] text-gray-500" title={t.despesa_nome || ''}>
                          {t.despesa_nome || '—'}
                        </div>
                      </div>
                      <div className="whitespace-nowrap text-right font-extrabold tabular-nums text-gray-900">{fmtBRL(l.valor)}</div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-600">
                      <span className="tabular-nums" title="Duplicata">
                        <b>{t.rotulo}</b>
                      </span>
                      <span title={nomeEmpresa[t.empresa] || ''}>emp. {t.empresa}</span>
                      <span className={venc && venc < hoje ? 'font-bold text-rose-700' : ''}>
                        vence {diaMes(venc)}
                        {col.vencidos && previsto && previsto !== venc ? ` · previsto ${diaMes(previsto)}` : ''}
                      </span>
                      {(l.forma_pagamento || l.banco) && <span className="rounded bg-gray-100 px-1 text-[10px] font-semibold text-gray-600">{[formas[l.forma_pagamento] || l.forma_pagamento, l.banco].filter(Boolean).join(' · ')}</span>}
                      <button type="button" disabled={ocupado} onClick={() => onAvancar(l)} className="ml-auto rounded bg-[#000638] px-2 py-0.5 text-[10px] font-bold text-white hover:bg-indigo-900 disabled:opacity-40" title="Mover para Aprovado">
                        APROVAR
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Inclusão automática na Stone: o que o bot fez (ou vai fazer) com esta liberação
const INCLUSAO = {
  fila: { rotulo: 'Na fila do bot', cor: 'bg-gray-100 text-gray-700 border-gray-300' },
  processando: { rotulo: 'Bot incluindo…', cor: 'bg-blue-100 text-blue-800 border-blue-300' },
  incluido: { rotulo: 'Incluída pelo bot', cor: 'bg-green-100 text-green-800 border-green-300' },
  erro: { rotulo: 'Bot não incluiu', cor: 'bg-rose-100 text-rose-800 border-rose-300' },
  bloqueado: { rotulo: 'Bloqueada na Stone', cor: 'bg-rose-100 text-rose-800 border-rose-300' },
  verificar: { rotulo: 'Conferir na Stone', cor: 'bg-orange-100 text-orange-800 border-orange-300' },
  cancelada: { rotulo: 'Bot cancelou', cor: 'bg-gray-100 text-gray-500 border-gray-200' },
  manual: { rotulo: 'Incluir à mão', cor: 'bg-amber-100 text-amber-800 border-amber-300' },
};
function SeloInclusao({ inclusao }) {
  const cfg = inclusao && INCLUSAO[inclusao.status];
  if (!cfg) return null;
  const detalhe = [inclusao.conta ? `conta ${inclusao.conta}` : null, inclusao.recebedor ? `recebedor: ${inclusao.recebedor}` : null, inclusao.erro || inclusao.motivo || null].filter(Boolean).join(' · ');
  return (
    <span className={`mt-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${cfg.cor}`} title={detalhe || cfg.rotulo}>
      <Robot size={10} weight="bold" /> {cfg.rotulo}
    </span>
  );
}

function Paginacao({ pagina, total, qtd, onIr }) {
  if (total <= 1) return null;
  const nums = [...new Set([1, 2, pagina - 1, pagina, pagina + 1, total - 1, total])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold ring-1 ring-gray-200 disabled:opacity-40';
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-600">
      <span>
        Mostrando <b>{(pagina - 1) * POR_PAGINA + 1}</b>–<b>{Math.min(pagina * POR_PAGINA, qtd)}</b> de <b>{qtd}</b> · página {pagina} de {total}
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

function Modal({ titulo, onFechar, children, largura = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className={`my-10 w-full ${largura} rounded-2xl bg-white p-5 shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="flex-1 text-lg font-bold text-[#000638]">{titulo}</h3>
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function HcLiberacaoPagamento() {
  const { user } = useAuth();
  const podeFinanceiro = PERFIS_FINANCEIRO.includes(user?.role);
  const [op, setOp] = useState(null);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState(null);
  const [etapa, setEtapa] = useState('pendente');
  const [f, setF] = useState({ empresa: '', fornecedor: '', banco: '', forma: '', previstoDe: '', previstoAte: '', de: '', ate: '' });
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [pagina, setPagina] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState(null); // { tipo: 'pagar' | 'devolver' | 'editar' | 'baixaAuto' | 'entreContas', ... }
  const [copiado, setCopiado] = useState(null);
  // Previsão: lista (tabela) ou kanban por dia — a escolha fica guardada neste navegador
  const [visaoPrevisao, setVisaoPrevisao] = useState(() => {
    try {
      return localStorage.getItem('hc_lib_visao_previsao') === 'kanban' ? 'kanban' : 'lista';
    } catch {
      return 'lista';
    }
  });
  const trocarVisao = (v) => {
    setVisaoPrevisao(v);
    try {
      localStorage.setItem('hc_lib_visao_previsao', v);
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  };
  // saldo bancário do card (lido à parte: não trava a lista se falhar)
  const [saldos, setSaldos] = useState(null);
  const [saldosBusy, setSaldosBusy] = useState(false);
  const [saldosErro, setSaldosErro] = useState('');
  const carregarSaldos = useCallback(async () => {
    setSaldosBusy(true);
    try {
      const j = await apiJson(`${API}/saldos`);
      setSaldos(j.data);
      setSaldosErro('');
    } catch (e) {
      setSaldosErro(`Não consegui ler o saldo: ${e.message}`);
    } finally {
      setSaldosBusy(false);
    }
  }, []);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const avisar = useCallback((tipo, msg) => {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 8000);
  }, []);

  const carregar = useCallback(async (filtros) => {
    setCarregando(true);
    setErro('');
    try {
      const qs = new URLSearchParams(Object.entries({ empresa: filtros.empresa, de: filtros.de, ate: filtros.ate }).filter(([, v]) => v)).toString();
      const j = await apiJson(`${API}?${qs}`);
      setDados(j.data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!podeFinanceiro) return;
    apiJson(`${API}/opcoes`)
      .then((j) => setOp(j.data))
      .catch((e) => setErro(e.message));
    carregar(f);
    carregarSaldos();
    // o bot atualiza de hora em hora: a tela relê sozinha a cada 5 min
    const t = setInterval(carregarSaldos, 5 * 60000);
    return () => clearInterval(t);
  }, [podeFinanceiro]); // eslint-disable-line react-hooks/exhaustive-deps
  // em aba: ao voltar para a frente, relê o saldo
  useAoAtivarAba(() => {
    if (podeFinanceiro) carregarSaldos();
  });

  const formas = op?.formas || {};
  const bancos = op?.bancos || [];
  const nomeEmpresa = useMemo(() => Object.fromEntries((op?.empresas || []).map((e) => [e.code, e.nome])), [op]);
  const todas = dados?.liberacoes || [];
  const resumo = dados?.resumo || {};

  // filtros da tela (a etapa, o fornecedor, o banco, a forma e o dia previsto são filtrados aqui mesmo)
  const filtradas = useMemo(() => {
    const busca = f.fornecedor.trim().toLowerCase();
    return todas.filter((l) => {
      if (l.status !== etapa) return false;
      if (f.banco && (l.banco || '') !== f.banco) return false;
      if (f.forma && (l.forma_pagamento || '') !== f.forma) return false;
      if (f.previstoDe && (!l.data_prevista || l.data_prevista < f.previstoDe)) return false;
      if (f.previstoAte && (!l.data_prevista || l.data_prevista > f.previstoAte)) return false;
      if (busca) {
        const t = l.titulo || {};
        const alvo = `${t.fornecedor_code} ${t.fornecedor_nome} ${t.fornecedor_cpf_cnpj || ''} ${t.documento_fiscal || ''}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      return true;
    });
  }, [todas, etapa, f.fornecedor, f.banco, f.forma, f.previstoDe, f.previstoAte]);

  const daPrevisao = useMemo(() => {
    if (etapa !== 'previsao') return [];
    const busca = f.fornecedor.trim().toLowerCase();
    return todas.filter((l) => {
      if (l.status !== 'previsao') return false;
      if (f.banco && (l.banco || '') !== f.banco) return false;
      if (f.forma && (l.forma_pagamento || '') !== f.forma) return false;
      if (busca) {
        const t = l.titulo || {};
        if (!`${t.fornecedor_code} ${t.fornecedor_nome} ${t.fornecedor_cpf_cnpj || ''} ${t.documento_fiscal || ''}`.toLowerCase().includes(busca)) return false;
      }
      return true;
    });
  }, [todas, etapa, f.fornecedor, f.banco, f.forma]);
  // clicar num dia do gráfico filtra a tabela por ele (null = todos os dias)
  const escolherDiaPrevisto = (dia) => {
    setF((x) => ({ ...x, previstoDe: dia || '', previstoAte: dia || '' }));
    setPagina(1);
  };
  const diaEscolhido = f.previstoDe && f.previstoDe === f.previstoAte ? f.previstoDe : null;

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);
  const emAndamento = EM_ANDAMENTO.includes(etapa);
  const marcadas = filtradas.filter((l) => selecionadas.has(l.id));
  const valorMarcado = marcadas.reduce((s, l) => s + Number(l.valor), 0);
  const valorFiltrado = filtradas.reduce((s, l) => s + Number(l.valor), 0);
  const paginaToda = daPagina.length > 0 && daPagina.every((l) => selecionadas.has(l.id));
  const marcar = (ids, sim) =>
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      ids.forEach((id) => (sim ? novo.add(id) : novo.delete(id)));
      return novo;
    });
  const irParaEtapa = (k) => {
    setEtapa(k);
    setSelecionadas(new Set());
    setPagina(1);
  };

  // chama a API, avisa o resultado e recarrega
  const executar = async (caminho, body, { metodo = 'POST', limpar = true } = {}) => {
    setOcupado(true);
    try {
      const j = await apiJson(`${API}${caminho}`, { method: metodo, body });
      avisar('ok', j?.message || 'Feito');
      if (limpar) setSelecionadas(new Set());
      setModal(null);
      await carregar(f);
      return true;
    } catch (e) {
      avisar('erro', e.message);
      return false;
    } finally {
      setOcupado(false);
    }
  };
  const mover = (ids, status, extra = {}) => executar('/status', { ids, status, ...extra });
  // BAIXA AUTOMÁTICA (aba Incluídos): o servidor confere nos extratos de hoje e dos 30 dias
  // anteriores quais duplicatas incluídas já saíram. Aqui só mostra o que achou; a baixa
  // é gravada quando o usuário confirma com a senha (não tem estorno).
  const conferirExtratos = async () => {
    setOcupado(true);
    try {
      const j = await apiJson(`${API}/baixa-automatica`, { method: 'POST', body: {} });
      const r = j.data || {};
      setModal({ tipo: 'baixaAuto', r, ids: (r.casadas || []).flatMap((c) => c.liberacoes.map((l) => l.id)), senha: '' });
    } catch (e) {
      avisar('erro', e.message);
    } finally {
      setOcupado(false);
    }
  };
  const alterar = (l, patch) => executar(`/${l.id}`, patch, { metodo: 'PUT', limpar: false });
  // ALTERAR da linha: valor (parcial), observação e a chave Pix / boleto, que são gravados na duplicata
  const abrirEdicao = (l) => setModal({ tipo: 'editar', l, valor: String(l.valor).replace('.', ','), observacao: l.observacao || '', chavePix: l.titulo?.chave_pix || '', codigoBarras: l.titulo?.codigo_barras || '' });
  const copiar = async (id, valor) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      avisar('erro', 'Não consegui copiar; abra a duplicata e copie à mão.');
    }
  };

  if (!podeFinanceiro) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <PageTitle title="Liberação de Pagamento" subtitle="HeadCoach" icon={CurrencyDollar} iconColor="text-[#000638]" />
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">A liberação de pagamento é só para owner, admin e financeiro.</p>
      </div>
    );
  }

  const idsMarcados = marcadas.map((l) => l.id);
  const btnAcao = 'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-40';

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <PageTitle title="Liberação de Pagamento" subtitle="Duplicatas do Contas a Pagar HeadCoach liberadas para pagamento — pendente → previsão → aprovado → incluído → pago" icon={CurrencyDollar} iconColor="text-[#000638]" />
      {aviso && <p className={`mb-3 rounded-xl px-3 py-2 text-sm ring-1 ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{aviso.msg}</p>}
      {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}

      <CardSaldos saldos={saldos} carregando={saldosBusy} erro={saldosErro} onAtualizar={carregarSaldos} onEntreContas={() => setModal({ tipo: 'entreContas' })} />

      {/* Cards de resumo: clicar troca a etapa */}
      <div className="mb-4 flex flex-wrap gap-3">
        {ETAPAS.map((e) => (
          <CardEtapa key={e.k} etapa={e} dados={resumo[e.k]} ativo={etapa === e.k} onClick={() => irParaEtapa(e.k)} />
        ))}
        <div className="min-w-[180px] flex-1 rounded-xl bg-[#000638] p-3 text-white shadow">
          <div className="mb-1 flex items-center gap-2">
            <Receipt size={16} weight="bold" />
            <span className="text-[10px] font-bold uppercase tracking-wide">A pagar (em andamento)</span>
          </div>
          <div className="text-lg font-bold">{fmtBRL(resumo.ativos?.valor)}</div>
          <div className="text-[11px] opacity-80">{resumo.ativos?.qtd || 0} duplicata(s)</div>
        </div>
      </div>

      {/* Filtros */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPagina(1);
          carregar(f);
        }}
        className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-4 lg:grid-cols-8"
      >
        <div className="col-span-2">
          <label className={labelCls}>Empresa</label>
          <select value={f.empresa} onChange={set('empresa')} className={inputCls}>
            <option value="">Todas</option>
            {(op?.empresas || []).map((e) => (
              <option key={e.code} value={e.code}>
                {e.code} — {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Fornecedor ou documento</label>
          <input value={f.fornecedor} onChange={set('fornecedor')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Banco</label>
          <select value={f.banco} onChange={set('banco')} className={inputCls}>
            <option value="">Todos</option>
            {bancos.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
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
        {etapa === 'pago' ? (
          <>
            <div>
              <label className={labelCls}>Pagas de</label>
              <input type="date" value={f.de || dados?.pagosDe || ''} onChange={set('de')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Até</label>
              <input type="date" value={f.ate || dados?.pagosAte || ''} onChange={set('ate')} className={inputCls} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelCls}>Previsto de</label>
              <input type="date" value={f.previstoDe} onChange={set('previstoDe')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Até</label>
              <input type="date" value={f.previstoAte} onChange={set('previstoAte')} className={inputCls} />
            </div>
          </>
        )}
        <div className="col-span-2 flex items-end gap-2 sm:col-span-4 lg:col-span-8 lg:justify-end">
          <span className="mr-auto text-xs text-gray-600">
            <b>{filtradas.length}</b> em {ETAPA[etapa].label.toLowerCase()} · <b>{fmtBRL(valorFiltrado)}</b>
          </span>
          <Link to="/headcoach/contas-pagar" className="text-xs font-semibold text-indigo-700 underline">
            Ir para o Contas a Pagar
          </Link>
          <button type="submit" disabled={carregando} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#000638] px-4 text-xs font-bold text-white hover:bg-indigo-900 disabled:opacity-40">
            {carregando ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} weight="bold" />} ATUALIZAR
          </button>
        </div>
      </form>

      {/* Ações em lote */}
      {emAndamento && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs text-[#000638]">
          {marcadas.length > 0 ? (
            <span>
              <b>{marcadas.length}</b> selecionada(s) · <b>{fmtBRL(valorMarcado)}</b>
            </span>
          ) : (
            <span className="text-gray-600">
              Marque as duplicatas para mudar de etapa ou pagar.
              {(etapa === 'pendente' || etapa === 'previsao') && ' Ao APROVAR, a que tiver banco STONE e Pix (chave ou copia e cola) vai sozinha para o bot incluir na Stone.'}
            </span>
          )}
          {filtradas.length > marcadas.length && (
            <button type="button" onClick={() => marcar(filtradas.map((l) => l.id), true)} className="font-semibold text-indigo-700 underline">
              selecionar as {filtradas.length}
            </button>
          )}
          {marcadas.length > 0 && (
            <button type="button" onClick={() => setSelecionadas(new Set())} className="font-semibold text-gray-600 underline">
              limpar
            </button>
          )}
          {/* o mesmo banco para todas as selecionadas, de uma vez (a seleção continua para aprovar em seguida) */}
          {marcadas.length > 0 && (
            <select
              value=""
              disabled={ocupado}
              onChange={(e) => {
                const v = e.target.value;
                if (v) executar('/banco', { ids: idsMarcados, banco: v === '__limpar__' ? '' : v }, { limpar: false });
              }}
              title="Põe o mesmo banco em todas as selecionadas"
              className="h-8 rounded-lg border border-indigo-300 bg-white px-2 text-xs font-bold text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
            >
              <option value="">Banco para as {marcadas.length} selecionada(s)…</option>
              {bancos.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value="__limpar__">— tirar o banco —</option>
            </select>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {etapa === 'incluido' && (
              <button type="button" disabled={ocupado} onClick={conferirExtratos} title="Confere nos extratos de hoje e dos últimos 30 dias quais duplicatas incluídas já foram pagas" className={`${btnAcao} bg-[#000638] hover:bg-[#0b1a6e]`}>
                {ocupado && !modal ? <Spinner size={14} className="animate-spin" /> : <Lightning size={14} weight="bold" />} BAIXA AUTOMÁTICA
              </button>
            )}
            {etapa !== 'pendente' && (
              <button type="button" disabled={ocupado || !marcadas.length} onClick={() => mover(idsMarcados, 'pendente')} className={`${btnAcao} bg-yellow-600 hover:bg-yellow-700`}>
                <ArrowUUpLeft size={14} weight="bold" /> VOLTAR P/ PENDENTE
              </button>
            )}
            {etapa !== 'previsao' && (
              <button type="button" disabled={ocupado || !marcadas.length} onClick={() => mover(idsMarcados, 'previsao')} title="Só muda de etapa: a data prevista continua a mesma (o vencimento) e pode ser ajustada na linha" className={`${btnAcao} bg-orange-600 hover:bg-orange-700`}>
                <CalendarCheck size={14} weight="bold" /> PREVISÃO
              </button>
            )}
            {etapa !== 'aprovado' && (
              <button type="button" disabled={ocupado || !marcadas.length} onClick={() => mover(idsMarcados, 'aprovado')} className={`${btnAcao} bg-blue-600 hover:bg-blue-700`}>
                <CheckCircle size={14} weight="bold" /> {etapa === 'incluido' ? 'VOLTAR P/ APROVADO' : 'APROVAR'}
              </button>
            )}
            {etapa !== 'incluido' && (
              <button type="button" disabled={ocupado || !marcadas.length} onClick={() => mover(idsMarcados, 'incluido')} className={`${btnAcao} bg-violet-600 hover:bg-violet-700`}>
                <Bank size={14} weight="bold" /> INCLUÍDO NO BANCO
              </button>
            )}
            {etapa === 'aprovado' && (
              <button type="button" disabled={ocupado || !marcadas.length} onClick={() => executar('/incluir-stone', { ids: idsMarcados })} title="Manda de novo para o bot incluir na Stone as aprovadas que ele ainda não incluiu (Pix por chave ou copia e cola, banco STONE)" className={`${btnAcao} bg-slate-700 hover:bg-slate-800`}>
                <Robot size={14} weight="bold" /> ENVIAR AO BOT
              </button>
            )}
            <button type="button" disabled={ocupado || !marcadas.length} onClick={() => setModal({ tipo: 'pagar', ids: idsMarcados, data: hojeIso(), banco: '', senha: '' })} className={`${btnAcao} bg-green-600 hover:bg-green-700`}>
              <CurrencyDollar size={14} weight="bold" /> PAGAR SELECIONADAS
            </button>
            <button type="button" disabled={ocupado || !marcadas.length} onClick={() => setModal({ tipo: 'devolver', ids: idsMarcados, motivo: '' })} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40">
              <ArrowsClockwise size={14} weight="bold" /> DEVOLVER AO CONTAS A PAGAR
            </button>
          </div>
        </div>
      )}

      {/* Previsão: quanto há para pagar por dia */}
      {etapa === 'previsao' && <GraficoPrevisao liberacoes={daPrevisao} hoje={hojeIso()} diaEscolhido={diaEscolhido} onEscolherDia={escolherDiaPrevisto} />}

      {/* Previsão: lista ou kanban */}
      {etapa === 'previsao' && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Visualização</span>
          <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-gray-300">
            {[
              { k: 'lista', rotulo: 'Lista', Icone: ListBullets },
              { k: 'kanban', rotulo: 'Kanban', Icone: Kanban },
            ].map((v) => (
              <button key={v.k} type="button" onClick={() => trocarVisao(v.k)} className={`inline-flex h-8 items-center gap-1.5 px-3 text-xs font-bold ${visaoPrevisao === v.k ? 'bg-[#000638] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <v.Icone size={14} weight="bold" /> {v.rotulo}
              </button>
            ))}
          </div>
          {visaoPrevisao === 'kanban' && <span className="text-[11px] text-gray-500">Arraste um cartão para outro dia para mudar a data prevista.</span>}
        </div>
      )}
      {etapa === 'previsao' && visaoPrevisao === 'kanban' && (
        <KanbanPrevisao
          liberacoes={filtradas}
          hoje={hojeIso()}
          selecionadas={selecionadas}
          marcar={marcar}
          onMoverDia={(l, dia) => alterar(l, { dataPrevista: dia })}
          onAvancar={(l) => mover([l.id], 'aprovado')}
          nomeEmpresa={nomeEmpresa}
          formas={formas}
          ocupado={ocupado}
        />
      )}

      {/* Tabela */}
      <div className={`rounded-xl border border-gray-200 bg-white shadow ${etapa === 'previsao' && visaoPrevisao === 'kanban' ? 'hidden' : ''}`}>
        {!dados && carregando ? (
          <div className="py-12 text-center text-sm text-gray-400">Carregando…</div>
        ) : filtradas.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhuma duplicata em {ETAPA[etapa].label.toLowerCase()}
            {etapa === 'pendente' ? '. No Contas a Pagar HeadCoach, marque as duplicatas e clique em LIBERAR PARA PAGAMENTO.' : '.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-xs">
              <thead className="bg-[#000638] text-left text-[10px] font-bold uppercase text-white">
                <tr>
                  {emAndamento && (
                    <th className="w-9 px-2 py-2 text-center">
                      <input type="checkbox" title="Selecionar as desta página" checked={paginaToda} onChange={(e) => marcar(daPagina.map((l) => l.id), e.target.checked)} />
                    </th>
                  )}
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">{etapa === 'pago' ? 'Pago em' : 'Previsto'}</th>
                  <th className="px-2 py-2">Vencimento</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2">Fornecedor</th>
                  <th className="px-2 py-2">Despesa</th>
                  <th className="px-2 py-2">Duplicata</th>
                  <th className="px-2 py-2">Empresa</th>
                  <th className="px-2 py-2">Banco</th>
                  <th className="px-2 py-2">Forma pgto</th>
                  <th className="px-2 py-2">Detalhe pgto</th>
                  <th className="px-2 py-2">{etapa === 'pago' ? 'Pago por' : 'Liberada por'}</th>
                  {emAndamento && <th className="px-2 py-2 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {daPagina.map((l) => {
                  const t = l.titulo || {};
                  const atrasada = emAndamento && String(t.vencimento).slice(0, 10) < hojeIso();
                  const parcialDaDuplicata = Number(l.valor) < Number(t.falta ?? t.valor) - 0.005;
                  const proxima = ETAPAS[ETAPAS.findIndex((e) => e.k === l.status) + 1];
                  return (
                    <tr key={l.id} className={`hover:bg-indigo-50/40 ${selecionadas.has(l.id) ? 'bg-indigo-50/60' : ''}`}>
                      {emAndamento && (
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={selecionadas.has(l.id)} onChange={(e) => marcar([l.id], e.target.checked)} />
                        </td>
                      )}
                      <td className="px-2 py-1.5">
                        <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${ETAPA[l.status]?.selo || ''}`}>{ETAPA[l.status]?.um || l.status}</span>
                        {l.titulo?.escrituracao === 'pendente' && (
                          <div>
                            <span title="A nota fiscal desta duplicata ainda não foi escriturada (o status é trocado no Contas a Pagar)" className="whitespace-nowrap rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-300">
                              NÃO ESCRITURADA
                            </span>
                          </div>
                        )}
                        {emAndamento && l.inclusao && (
                          <div>
                            <SeloInclusao inclusao={l.inclusao} />
                            {['erro', 'bloqueado', 'verificar', 'cancelada', 'manual'].includes(l.inclusao.status) && (l.inclusao.erro || l.inclusao.motivo) && <div className="max-w-[180px] whitespace-normal text-[10px] leading-tight text-gray-500">{l.inclusao.erro || l.inclusao.motivo}</div>}
                          </div>
                        )}
                      </td>
                      <td className="w-[124px] px-2 py-1.5 tabular-nums">
                        {emAndamento ? <input type="date" defaultValue={l.data_prevista || ''} key={`${l.id}-${l.data_prevista}`} disabled={ocupado} onBlur={(e) => e.target.value !== (l.data_prevista || '') && alterar(l, { dataPrevista: e.target.value })} className={celCls} /> : fmtData(l.data_pagamento)}
                      </td>
                      <td className={`px-2 py-1.5 tabular-nums ${atrasada ? 'font-semibold text-rose-700' : ''}`} title={atrasada ? 'Vencida' : ''}>
                        {fmtData(t.vencimento)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                        {fmtBRL(l.valor)}
                        {parcialDaDuplicata && emAndamento && <div className="text-[10px] font-normal text-amber-700">parcial · faltam {fmtBRL(t.falta)}</div>}
                      </td>
                      <td className="max-w-[230px] truncate px-2 py-1.5" title={`${t.fornecedor_nome}${t.fornecedor_cpf_cnpj ? ` · ${t.fornecedor_cpf_cnpj}` : ''}`}>
                        {t.fornecedor_code} · {t.fornecedor_nome}
                      </td>
                      <td className="max-w-[170px] truncate px-2 py-1.5" title={`${t.despesa_nome || ''}${t.centro_custo_nome ? ` · ${t.centro_custo_nome}` : ''}`}>
                        {t.despesa_code ? `${t.despesa_code} · ${t.despesa_nome}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums" title={t.observacao || ''}>
                        <b>{t.rotulo}</b>
                        {t.documento_fiscal ? <span className="text-gray-500"> · {t.documento_fiscal}</span> : ''}
                      </td>
                      <td className="px-2 py-1.5" title={nomeEmpresa[t.empresa]}>
                        {t.empresa}
                      </td>
                      <td className="w-[130px] px-2 py-1.5">
                        {emAndamento ? (
                          <select value={l.banco || ''} disabled={ocupado} onChange={(e) => alterar(l, { banco: e.target.value })} className={celCls}>
                            <option value="">—</option>
                            {(l.banco && !bancos.includes(l.banco) ? [l.banco, ...bancos] : bancos).map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        ) : (
                          l.banco || '—'
                        )}
                      </td>
                      <td className="w-[124px] px-2 py-1.5">
                        {emAndamento ? (
                          <select value={l.forma_pagamento || ''} disabled={ocupado} onChange={(e) => alterar(l, { formaPagamento: e.target.value })} className={celCls}>
                            <option value="">—</option>
                            {Object.entries(formas).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          formas[l.forma_pagamento] || '—'
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {t.chave_pix && (
                            <button type="button" onClick={() => copiar(`pix-${l.id}`, t.chave_pix)} title={t.chave_pix} className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-200">
                              <Copy size={11} /> {copiado === `pix-${l.id}` ? 'copiado' : 'Pix'}
                            </button>
                          )}
                          {t.codigo_barras && (
                            <button type="button" onClick={() => copiar(`cb-${l.id}`, t.codigo_barras)} title={t.codigo_barras} className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-200">
                              <Copy size={11} /> {copiado === `cb-${l.id}` ? 'copiado' : 'Boleto'}
                            </button>
                          )}
                          {emAndamento && l.status !== 'incluido' ? (
                            <button type="button" disabled={ocupado} onClick={() => abrirEdicao(l)} title={t.chave_pix || t.codigo_barras ? 'Trocar a chave Pix ou o boleto' : 'Informar a chave Pix ou o boleto'} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 disabled:opacity-40">
                              <PencilSimple size={11} weight="bold" /> {t.chave_pix || t.codigo_barras ? 'trocar' : 'Pix / boleto'}
                            </button>
                          ) : (
                            !t.chave_pix && !t.codigo_barras && <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[150px] truncate px-2 py-1.5 text-[11px] text-gray-600" title={l.observacao || ''}>
                        {etapa === 'pago' ? `${autorExibicao(l.pago_por) || '—'} · ${fmtDataHora(l.pago_em)}` : `${autorExibicao(l.liberado_por) || '—'} · ${fmtDataHora(l.liberado_em)}`}
                      </td>
                      {emAndamento && (
                        <td className="whitespace-nowrap px-2 py-1.5 text-center">
                          {proxima && proxima.k !== 'pago' && (
                            <button type="button" disabled={ocupado} onClick={() => mover([l.id], proxima.k)} className="mr-1 rounded bg-[#000638] px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-900 disabled:opacity-40" title={`Mover para ${proxima.um}`}>
                              {proxima.acao}
                            </button>
                          )}
                          <button type="button" disabled={ocupado} onClick={() => setModal({ tipo: 'pagar', ids: [l.id], data: hojeIso(), banco: '', senha: '' })} className="mr-1 rounded bg-green-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-green-700 disabled:opacity-40">
                            PAGAR
                          </button>
                          <button type="button" disabled={ocupado} onClick={() => abrirEdicao(l)} className="rounded p-1 text-gray-600 hover:bg-gray-100" title="Alterar valor (pagamento parcial), observação, chave Pix e boleto">
                            <PencilSimple size={13} weight="bold" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!(etapa === 'previsao' && visaoPrevisao === 'kanban') && <Paginacao pagina={paginaAtual} total={totalPaginas} qtd={filtradas.length} onIr={(n) => setPagina(Math.min(Math.max(1, n), totalPaginas))} />}

      {/* ENTRE CONTAS: transferência entre as contas da Stone (fila do bot) */}
      {modal?.tipo === 'entreContas' && (
        <StoneEntreContasModal
          onFechar={() => {
            setModal(null);
            carregarSaldos();
          }}
        />
      )}

      {/* PAGAR: grava a baixa (sem estorno) */}
      {modal?.tipo === 'pagar' &&
        (() => {
          const alvo = todas.filter((l) => modal.ids.includes(l.id));
          const total = alvo.reduce((s, l) => s + Number(l.valor), 0);
          const semBanco = alvo.filter((l) => !l.banco).length;
          return (
            <Modal titulo={`Pagar ${alvo.length} duplicata(s)`} onFechar={() => setModal(null)}>
              <div className="mb-3 max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-2 text-xs ring-1 ring-gray-200">
                {alvo.map((l) => (
                  <div key={l.id} className="flex justify-between gap-2 py-0.5">
                    <span className="truncate">
                      {l.titulo?.fornecedor_nome} · {l.titulo?.rotulo}
                      {l.banco ? ` · ${l.banco}` : ''}
                    </span>
                    <b className="tabular-nums">{fmtBRL(l.valor)}</b>
                  </div>
                ))}
              </div>
              <p className="mb-3 text-sm">
                Total: <b className="text-green-700">{fmtBRL(total)}</b>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Data do pagamento</label>
                  <input type="date" max={hojeIso()} value={modal.data} onChange={(e) => setModal((m) => ({ ...m, data: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Banco {semBanco ? `(para as ${semBanco} sem banco)` : '(todas já têm)'}</label>
                  <select value={modal.banco} onChange={(e) => setModal((m) => ({ ...m, banco: e.target.value }))} className={inputCls}>
                    <option value="">—</option>
                    {bancos.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Sua senha do HeadCoach</label>
                  <input type="password" autoComplete="off" value={modal.senha} onChange={(e) => setModal((m) => ({ ...m, senha: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">O pagamento grava a baixa na duplicata do contas a pagar e não tem estorno.</p>
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
                  Voltar
                </button>
                <button disabled={ocupado || !modal.senha || !modal.data || (semBanco > 0 && !modal.banco)} onClick={() => executar('/pagar', { ids: modal.ids, dataPagamento: modal.data, banco: modal.banco, senha: modal.senha })} className={`${btnAcao} bg-green-600 hover:bg-green-700`}>
                  {ocupado ? <Spinner size={14} className="animate-spin" /> : <CurrencyDollar size={14} weight="bold" />} CONFIRMAR PAGAMENTO
                </button>
              </div>
            </Modal>
          );
        })()}

      {/* BAIXA AUTOMÁTICA: o que o extrato confirma como pago; grava só depois da senha */}
      {modal?.tipo === 'baixaAuto' &&
        (() => {
          const r = modal.r || {};
          const casadas = r.casadas || [];
          const semSaida = r.semSaida || [];
          const marcada = (c) => c.liberacoes.every((l) => modal.ids.includes(l.id));
          const alternar = (c) =>
            setModal((m) => {
              const dela = c.liberacoes.map((l) => l.id);
              const tem = dela.every((id) => m.ids.includes(id));
              return { ...m, ids: tem ? m.ids.filter((id) => !dela.includes(id)) : [...new Set([...m.ids, ...dela])] };
            });
          const escolhidas = casadas.filter(marcada);
          const total = escolhidas.reduce((t, c) => t + c.liberacoes.reduce((x, l) => x + Number(l.valor), 0), 0);
          const qtd = escolhidas.reduce((n, c) => n + c.liberacoes.length, 0);
          return (
            <Modal titulo="Baixa automática pelos extratos" onFechar={() => setModal(null)} largura="max-w-4xl">
              <p className="mb-3 text-xs text-gray-600">
                Conferi as <b>{r.incluidas}</b> duplicata(s) incluída(s) no banco com as saídas dos extratos de <b>{fmtData(r.periodo?.de)}</b> a <b>{fmtData(r.periodo?.ate)}</b>
                {r.periodo?.ultimaSaida ? ` (última saída importada: ${fmtData(r.periodo.ultimaSaida)})` : ' — não há nenhuma saída importada nesse período'}. Vale valor igual, centavo a centavo, para o mesmo fornecedor.
              </p>

              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-green-700">Pagas no extrato ({casadas.length})</p>
              {casadas.length ? (
                <div className="mb-3 max-h-72 overflow-auto rounded-lg ring-1 ring-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5" />
                        <th className="px-2 py-1.5">Duplicata</th>
                        <th className="px-2 py-1.5 text-right">Valor</th>
                        <th className="px-2 py-1.5">Saiu em</th>
                        <th className="px-2 py-1.5">Banco</th>
                        <th className="px-2 py-1.5">No extrato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {casadas.map((c) => (
                        <tr key={c.lancamentoId} className="border-t border-gray-100 align-top">
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={marcada(c)} onChange={() => alternar(c)} className="h-4 w-4 accent-[#000638]" />
                          </td>
                          <td className="px-2 py-1.5">
                            {c.liberacoes.map((l) => (
                              <div key={l.id}>
                                <b>{l.fornecedor}</b> · {l.rotulo} · emp. {l.empresa} · vence {fmtData(l.vencimento)}
                                {c.liberacoes.length > 1 ? ` · ${fmtBRL(l.valor)}` : ''}
                              </div>
                            ))}
                            {c.tipo === 'soma' && <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">UMA SAÍDA PAGOU AS {c.liberacoes.length}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums">{fmtBRL(c.valor)}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{fmtData(c.data)}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{c.banco}</td>
                          <td className="px-2 py-1.5 text-gray-600">{c.contraparte}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mb-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 ring-1 ring-gray-200">Nenhuma das duplicatas incluídas apareceu como paga nos extratos desse período.</p>
              )}

              {semSaida.length > 0 && (
                <>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">Continuam em Incluídos ({semSaida.length})</p>
                  <div className="mb-3 max-h-40 overflow-y-auto rounded-lg bg-gray-50 p-2 text-xs ring-1 ring-gray-200">
                    {semSaida.map((x) => (
                      <div key={x.id} className="py-0.5">
                        <b>{x.fornecedor}</b> · {x.rotulo} · emp. {x.empresa} · {fmtBRL(x.valor)} — <span className="text-gray-600">{x.motivo}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {casadas.length > 0 && (
                <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label className={labelCls}>Sua senha do HeadCoach</label>
                    <input type="password" autoComplete="off" value={modal.senha} onChange={(e) => setModal((m) => ({ ...m, senha: e.target.value }))} className={inputCls} />
                  </div>
                  <p className="text-sm sm:text-right">
                    {qtd} duplicata(s) · <b className="text-green-700">{fmtBRL(total)}</b>
                  </p>
                </div>
              )}
              <p className="mt-2 text-[11px] text-gray-500">A baixa usa a data e o banco do extrato, grava o pagamento na duplicata do contas a pagar e não tem estorno. Desmarque o que não quiser baixar agora.</p>
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
                  {casadas.length ? 'Voltar' : 'Fechar'}
                </button>
                {casadas.length > 0 && (
                  <button disabled={ocupado || !modal.senha || !qtd} onClick={() => executar('/baixa-automatica', { confirmar: true, ids: modal.ids, senha: modal.senha })} className={`${btnAcao} bg-green-600 hover:bg-green-700`}>
                    {ocupado ? <Spinner size={14} className="animate-spin" /> : <Lightning size={14} weight="bold" />} BAIXAR {qtd} DUPLICATA(S)
                  </button>
                )}
              </div>
            </Modal>
          );
        })()}

      {/* DEVOLVER ao contas a pagar */}
      {modal?.tipo === 'devolver' && (
        <Modal titulo={`Devolver ${modal.ids.length} duplicata(s) ao contas a pagar`} onFechar={() => setModal(null)} largura="max-w-md">
          <p className="mb-2 text-xs text-gray-600">Elas saem da liberação e continuam em aberto no Contas a Pagar HeadCoach; podem ser liberadas de novo depois.</p>
          <label className={labelCls}>Motivo (opcional)</label>
          <input value={modal.motivo} onChange={(e) => setModal((m) => ({ ...m, motivo: e.target.value }))} className={inputCls} />
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
              Voltar
            </button>
            <button disabled={ocupado} onClick={() => executar('/devolver', { ids: modal.ids, motivo: modal.motivo })} className={`${btnAcao} bg-rose-600 hover:bg-rose-700`}>
              {ocupado ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} weight="bold" />} DEVOLVER
            </button>
          </div>
        </Modal>
      )}

      {/* ALTERAR valor (parcial), observação, chave Pix e boleto */}
      {modal?.tipo === 'editar' && (
        <Modal titulo={`${modal.l.titulo?.fornecedor_nome} · ${modal.l.titulo?.rotulo}`} onFechar={() => setModal(null)} largura="max-w-lg">
          <p className="mb-2 text-xs text-gray-600">
            Duplicata de {fmtBRL(modal.l.titulo?.valor)} · faltam <b>{fmtBRL(modal.l.titulo?.falta)}</b>. Com valor menor, o pagamento é parcial e o resto continua em aberto no contas a pagar.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Valor a pagar nesta liberação</label>
              <input inputMode="decimal" value={modal.valor} onChange={(e) => setModal((m) => ({ ...m, valor: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Observação</label>
              <input value={modal.observacao} onChange={(e) => setModal((m) => ({ ...m, observacao: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Chave Pix ou Pix copia e cola</label>
              <textarea rows={3} disabled={modal.l.status === 'incluido'} value={modal.chavePix} onChange={(e) => setModal((m) => ({ ...m, chavePix: e.target.value }))} placeholder="CPF, CNPJ, e-mail, telefone, chave aleatória ou o código copia e cola inteiro" style={{ height: 'auto' }} className={`${inputCls} py-1.5 font-mono text-[11px] leading-snug disabled:bg-gray-100`} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Boleto (linha digitável)</label>
              <input disabled={modal.l.status === 'incluido'} value={modal.codigoBarras} onChange={(e) => setModal((m) => ({ ...m, codigoBarras: e.target.value }))} placeholder="47 ou 48 dígitos" className={`${inputCls} font-mono text-[11px] disabled:bg-gray-100`} />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            {modal.l.status === 'incluido'
              ? 'Já incluída no banco: a chave Pix e o boleto não mudam mais (volte para Aprovados se precisar corrigir).'
              : 'A chave Pix e o boleto ficam gravados na duplicata do Contas a Pagar. Com os dois, o pagamento vai por Pix.'}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="h-9 rounded-lg px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
              Voltar
            </button>
            <button disabled={ocupado || !(num(modal.valor) > 0)} onClick={() => alterar(modal.l, { valor: num(modal.valor), observacao: modal.observacao, ...(modal.l.status !== 'incluido' ? { chavePix: modal.chavePix, codigoBarras: modal.codigoBarras } : {}) })} className={`${btnAcao} bg-[#000638] hover:bg-indigo-900`}>
              {ocupado ? <Spinner size={14} className="animate-spin" /> : <CheckCircle size={14} weight="bold" />} SALVAR
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
