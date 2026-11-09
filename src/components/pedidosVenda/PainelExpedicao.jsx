// Painel da Expedição — visão "Painel" da tela Pedido de Venda.
// Cópia do PAINEL ("Gestão à Vista — Expedição") do /frete do Dryland, com as
// MESMAS regras de contagem do frete.html, lido ao vivo pela API
// (/api/pedidos-venda/painel*). Só leitura: mudar status, transportadora,
// checklist, enviar duplicata e dar recebimento continuam no Dryland.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Storefront,
  Tag,
  Buildings,
  Package,
  ShieldWarning,
  NotePencil,
  Barcode,
  Truck,
  SealCheck,
  Warehouse,
  ArrowsLeftRight,
  Cube,
  Receipt,
  Factory,
  Hourglass,
  CheckCircle,
  MagnifyingGlass,
  ArrowsClockwise,
  Spinner,
  X,
  CaretRight,
  CaretDown,
  Lock,
  WhatsappLogo,
  MapPin,
  User,
  CalendarBlank,
  CreditCard,
  Signature,
  ArrowSquareOut,
  FileText,
  Image as ImageIcon,
  Recycle,
  ListChecks,
  Warning,
  Broadcast,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../../config/constants';

const DRYLAND_FRETE = 'https://dryland-missao-separacao.vercel.app/frete';
const AUTO_REFRESH_MS = 3 * 60 * 1000;
const CORTE_EXPEDICAO = 14; // assinada até 14h (dia útil) sai no mesmo dia

const CANAIS = [
  { id: 'varejo', label: 'Varejo', icon: Storefront },
  { id: 'mtm', label: 'MTM', icon: Tag },
  { id: 'franquias', label: 'Franquias', icon: Buildings },
  { id: 'revenda', label: 'Revenda', icon: Package },
];
const NOME_CANAL = Object.fromEntries(CANAIS.map((c) => [c.id, c.label]));

// ─── regras do frete.html ────────────────────────────────────────────────────
const FINAL = (s) => /faturamento conclu|pedido faturado|pedido enviado/i.test(s || '');
const CONCLUIDO_LISTA = (s) => /faturamento conclu|pedido faturado/i.test(s || '');
const A_FATURAR = (c) => !c.status || /^\s*a faturar\s*$/i.test(c.status);
const FALTA_INFO = (c) => /falta|incompleto|pendência|sem informa/i.test(c.status || '');
const BOLETO = (c) => /BOLETO/i.test(String(c.dados?.forma_pagamento || ''));
const BREJINHO = (c) => c.dados?.origem === 'brejinho';
const TRAVA_DUP = (c) => BOLETO(c) && !c.dados?.duplicata_assinada_em;
const trDe = (c) => {
  const d = c.dados || {};
  return String(d.transportadora || d.forma_envio || (d.envio_correios ? 'CORREIOS' : '') || '—').toUpperCase();
};
const vigiaRuim = (v) => v && (v.cadastro_ok === false || v.ie_ok === false);
const D30 = () => Date.now() - 30 * 864e5;

// ─── formatação ──────────────────────────────────────────────────────────────
const fmtBRL = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
};
const fmtDH = (v) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const fmtD = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '');
const semAcento = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// ─── tons ────────────────────────────────────────────────────────────────────
const TONS = {
  alerta: { txt: 'text-rose-600', soft: 'bg-rose-50 text-rose-600', bar: 'bg-rose-500', ring: 'hover:ring-rose-300' },
  ok: { txt: 'text-emerald-600', soft: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500', ring: 'hover:ring-emerald-300' },
  info: { txt: 'text-blue-600', soft: 'bg-blue-50 text-blue-600', bar: 'bg-blue-500', ring: 'hover:ring-blue-300' },
  roxo: { txt: 'text-violet-600', soft: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500', ring: 'hover:ring-violet-300' },
  navy: { txt: 'text-[#000638]', soft: 'bg-indigo-50 text-[#000638]', bar: 'bg-[#000638]', ring: 'hover:ring-indigo-300' },
  ambar: { txt: 'text-amber-600', soft: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500', ring: 'hover:ring-amber-300' },
  cinza: { txt: 'text-gray-500', soft: 'bg-gray-100 text-gray-500', bar: 'bg-gray-400', ring: 'hover:ring-gray-300' },
};
const tomAlerta = (n) => (n > 0 ? 'alerta' : 'ok');

// ─── peças visuais ───────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, valor, sub, tom = 'navy', onClick, children }) {
  const t = TONS[tom] || TONS.navy;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl bg-white p-3 text-left ring-1 ring-gray-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${t.ring}`}
    >
      <div className="flex items-start gap-2">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${t.soft}`}>
          <Icon size={17} weight="bold" />
        </span>
        <span className="text-[10.5px] font-bold uppercase leading-tight tracking-wide text-gray-500">{label}</span>
      </div>
      {children || <div className={`mt-1.5 text-[2rem] font-extrabold leading-none tabular-nums ${t.txt}`}>{valor}</div>}
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px] text-gray-500">
        <span className="truncate">{sub}</span>
        <CaretRight size={12} className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500" />
      </div>
      <span className={`absolute inset-x-0 bottom-0 h-1 ${t.bar} opacity-80`} />
    </button>
  );
}

function Painel({ icon: Icon, titulo, sub, children, acoes }) {
  return (
    <section className="flex flex-col rounded-2xl bg-white p-4 ring-1 ring-gray-200 shadow-sm">
      <div className="mb-3 flex items-start gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-50 text-[#000638]">
          <Icon size={17} weight="bold" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#000638]">{titulo}</h3>
          {sub && <p className="text-[11px] leading-snug text-gray-500">{sub}</p>}
        </div>
      </div>
      <div className="flex-1">{children}</div>
      {acoes && <div className="mt-3 flex flex-wrap gap-2">{acoes}</div>}
    </section>
  );
}

// linhas = [{ label, n, tom, onClick }]
function Barras({ linhas, vazio = 'Nada por aqui 🎉' }) {
  if (!linhas.length) return <p className="py-4 text-center text-xs text-gray-400">{vazio}</p>;
  const max = Math.max(1, ...linhas.map((l) => l.n));
  return (
    <ul className="space-y-1.5">
      {linhas.map((l) => {
        const t = TONS[l.tom] || TONS.navy;
        return (
          <li key={l.label}>
            <button type="button" onClick={l.onClick} className="group flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-gray-50">
              <span className="w-36 shrink-0 truncate text-right text-[11.5px] font-semibold text-gray-700 sm:w-44" title={l.label}>
                {l.label}
              </span>
              <span className="relative h-6 flex-1 overflow-hidden rounded-md bg-gray-100">
                <span className={`absolute inset-y-0 left-0 rounded-md ${t.bar} transition-all`} style={{ width: `${Math.max(3, Math.round((l.n / max) * 100))}%` }} />
              </span>
              <span className={`w-9 shrink-0 text-right text-sm font-extrabold tabular-nums ${t.txt}`}>{l.n}</span>
              <CaretRight size={11} className="shrink-0 text-gray-300 group-hover:text-gray-500" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Chip({ children, cls = 'bg-gray-100 text-gray-600 ring-gray-200', title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${cls}`}>
      {children}
    </span>
  );
}

const corStatus = (st) =>
  /erro|falta|inadimplente|bloqueio|duplicado|errado|cancel/i.test(st || '')
    ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : /aguardando/i.test(st || '')
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : FINAL(st) || /pronto na matriz/i.test(st || '')
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        : 'bg-indigo-50 text-[#000638] ring-indigo-200';

function Gaveta({ titulo, total, onClose, busca, onBusca, children, larga = false, extra }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#000638]/40 backdrop-blur-[1px]" onClick={onClose}>
      <div
        className={`flex h-full w-full flex-col bg-gray-50 shadow-2xl ${larga ? 'sm:max-w-4xl' : 'sm:max-w-3xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-base font-bold text-[#000638]">
              {titulo} {total != null && <span className="ml-1 rounded-full bg-[#000638] px-2 py-0.5 text-xs text-white tabular-nums">{total}</span>}
            </h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Fechar (Esc)">
              <X size={18} weight="bold" />
            </button>
          </div>
          {extra}
          {onBusca && (
            <div className="relative mt-2">
              <MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => onBusca(e.target.value)}
                placeholder="Buscar loja, TR, pedido TOTVS, NF, cliente…"
                className="mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
              />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}

// Plano do boleto (planoBoletoHtml): parcelas a cada 30 dias, frete incluso
function PlanoBoleto({ d }) {
  if (!d || !/BOLETO/i.test(d.forma_pagamento || '')) return null;
  const itens = parseFloat(String(d.valor_pedido).replace(',', '.')) || 0;
  const frete = parseFloat(String(d.valor_frete || 0).replace(',', '.')) || 0;
  const valor = itens + frete;
  const n = parseInt(d.parcelamento, 10) || 1;
  if (!valor || !d.data_1a_fatura) return null;
  const base = new Date(`${d.data_1a_fatura}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const parc = valor / n;
  return (
    <div className="mt-2 rounded-xl bg-indigo-50/70 p-2.5 ring-1 ring-indigo-100">
      <p className="text-xs font-bold text-[#000638]">
        Boleto — {n}x de {fmtBRL(parc)}{' '}
        <span className="font-normal text-gray-500">
          (total {fmtBRL(valor)}
          {frete > 0 ? ` · produtos ${fmtBRL(itens)} + frete ${fmtBRL(frete)}` : ''} · 30/30 dias)
        </span>
      </p>
      <div className="mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
        {Array.from({ length: n }, (_, i) => {
          const dt = new Date(base);
          dt.setDate(dt.getDate() + 30 * i);
          return (
            <div key={i} className="flex justify-between border-t border-indigo-100 py-0.5 text-[11px]">
              <span>
                {i + 1}ª · {dt.toLocaleDateString('pt-BR')}
              </span>
              <b>{fmtBRL(parc)}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Assinatura({ d }) {
  const q = d?.duplicata_assinada_em;
  if (!q) return null;
  const dt = new Date(q);
  if (Number.isNaN(dt.getTime())) return null;
  const fds = dt.getDay() === 0 || dt.getDay() === 6;
  const noPrazo = !fds && dt.getHours() < CORTE_EXPEDICAO;
  return (
    <p className="flex items-center gap-1.5 text-xs">
      <Signature size={13} className="text-emerald-600" />
      <b className="text-emerald-700">
        Duplicata assinada em {dt.toLocaleDateString('pt-BR')} às {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </b>
      <span className={noPrazo ? 'text-emerald-700' : 'text-amber-700'}>
        · {noPrazo ? 'até 14h — sai no mesmo dia' : fds ? 'fim de semana — sai no próximo dia útil' : 'após 14h — sai no próximo dia útil'}
      </span>
    </p>
  );
}

function Info({ icon: Icon, children }) {
  if (children == null || children === false || children === '') return null;
  return (
    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-gray-600">
      <Icon size={13} className="mt-0.5 shrink-0 text-gray-400" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

// Card da fila (mesma informação do modal do Dryland, sem os botões de edição)
function CardFila({ c, vig, arq }) {
  const d = c.dados || {};
  const v = vig?.[c.id];
  const itens = Array.isArray(d.itens) ? d.itens : [];
  const comps = c.comprovantes || [];
  return (
    <article className="rounded-2xl bg-white p-3 ring-1 ring-gray-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <h4 className="mr-1 min-w-0 text-sm font-bold text-[#000638]">{c.titulo || '—'}</h4>
        <Chip>{NOME_CANAL[c.canal] || c.canal}</Chip>
        <Chip cls={corStatus(c.status)}>{c.status || 'a faturar'}</Chip>
        {d.rastreio_entregue ? (
          <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">
            <SealCheck size={11} /> entregue{d.rastreio_local ? ` · ${d.rastreio_local}` : ''}
          </Chip>
        ) : d.rastreio_status ? (
          <Chip cls="bg-blue-50 text-blue-700 ring-blue-200">
            <Truck size={11} /> {String(d.rastreio_status).slice(0, 28)}
          </Chip>
        ) : null}
        {d.etiqueta_path && (
          <a href={arq + d.etiqueta_path} target="_blank" rel="noreferrer">
            <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">
              <Barcode size={11} /> etiqueta
            </Chip>
          </a>
        )}
      </div>

      {v &&
        (vigiaRuim(v) ? (
          <div className="mt-2 rounded-xl bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 ring-1 ring-rose-200">
            <p className="flex items-center gap-1 font-bold">
              <ShieldWarning size={14} weight="fill" /> VIGIA — NÃO EMITIR NF
              {(v.cadastro_chamado || v.ie_chamado) && <span className="font-semibold">· chamado #{v.cadastro_chamado || v.ie_chamado}</span>}
            </p>
            <p>{[v.cadastro_ok === false ? v.cadastro_motivo : null, v.ie_ok === false ? v.ie_motivo : null].filter(Boolean).join(' · ')}</p>
          </div>
        ) : v.cadastro_ok === true ? (
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">● vigia: cadastro e IE conferidos</p>
        ) : (
          <p className="mt-1 text-[11px] font-semibold text-amber-700">● vigia conferindo…</p>
        ))}

      <div className="mt-2 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
        <Info icon={User}>
          <b className="text-gray-900">{d.nome_cliente || d.nf_cliente || '—'}</b>
          {d.codigo_cliente ? <span className="text-gray-400"> (cód {d.codigo_cliente})</span> : ''}
          {d.tipo_cliente ? ` · ${d.tipo_cliente}` : ''}
        </Info>
        <Info icon={CalendarBlank}>{c.criado_em ? `subiu em ${fmtDH(c.criado_em)}` : null}</Info>
        <Info icon={FileText}>
          {d.pedido_totvs || d.transacao ? (
            <>
              pedido TOTVS <b>{d.pedido_totvs || d.transacao}</b>
              {d.transacao && d.pedido_totvs && String(d.transacao) !== String(d.pedido_totvs) ? ` · transação ${d.transacao}` : ''}
              {d.numero_pedido_site ? ` · site ${d.numero_pedido_site}` : ''}
              {d.nf_numero ? ` · NF ${d.nf_numero}` : ''}
            </>
          ) : d.nf_numero ? (
            `NF ${d.nf_numero}`
          ) : null}
        </Info>
        <Info icon={Receipt}>
          {d.valor_pedido ? (
            <>
              <b>{fmtBRL(d.valor_pedido)}</b>
              {Number(d.desconto) > 0 ? ` · desconto ${fmtBRL(d.desconto)}` : ''}
              {d.total_pecas ? ` · ${d.total_pecas} pç` : ''}
            </>
          ) : null}
        </Info>
        <Info icon={CreditCard}>
          {d.forma_pagamento ? `${d.forma_pagamento}${Number(d.parcelamento) > 1 ? ` em ${d.parcelamento}x` : ''}` : null}
        </Info>
        <Info icon={User}>{d.vendedor ? `vendedor: ${d.vendedor}` : null}</Info>
        <Info icon={Truck}>
          {d.transportadora || d.forma_envio || '—'}
          {/correios/i.test(d.transportadora || '') && d.envio_correios ? ` (${d.envio_correios})` : ''} · frete{' '}
          {Number(d.valor_frete) > 0 ? fmtBRL(d.valor_frete) : <span className="text-gray-400">R$ 0 / a definir</span>}
        </Info>
        <Info icon={MapPin}>{d.endereco ? String(d.endereco).slice(0, 110) : null}</Info>
        {String(d.credev).toUpperCase() === 'SIM' && (
          <Info icon={Recycle}>
            <b className="text-violet-700">CREDEV</b>
            {Number(d.consumo_credev) > 0 ? ` · consumo ${fmtBRL(d.consumo_credev)}` : ''}
          </Info>
        )}
      </div>

      <PlanoBoleto d={d} />
      <div className="mt-1">
        <Assinatura d={d} />
      </div>
      {d.obs && <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11.5px] leading-snug text-gray-600">{d.obs}</p>}
      {d.etiqueta_erro && (
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-600">
          <Warning size={13} /> {String(d.etiqueta_erro).slice(0, 120)}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {comps.length ? (
          comps.map((p, i) => (
            <a key={p} href={arq + p} target="_blank" rel="noreferrer">
              <Chip cls="bg-blue-50 text-blue-700 ring-blue-200">
                <Receipt size={11} /> comprovante{comps.length > 1 ? ` ${i + 1}` : ''}
              </Chip>
            </a>
          ))
        ) : (
          <Chip cls="bg-rose-50 text-rose-600 ring-rose-200">sem comprovante</Chip>
        )}
        {d.duplicata_assinada_url && (
          <a href={d.duplicata_assinada_url} target="_blank" rel="noreferrer">
            <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">
              <Signature size={11} /> duplicata assinada
            </Chip>
          </a>
        )}
        {!d.duplicata_assinada_url && d.duplicata_link && (
          <a href={d.duplicata_link} target="_blank" rel="noreferrer">
            <Chip cls="bg-amber-50 text-amber-700 ring-amber-200">
              <Signature size={11} /> duplicata para assinar
            </Chip>
          </a>
        )}
      </div>

      {(itens.length > 0 || d.exp_info || (d.exp_anexos || []).length > 0) && (
        <div className="mt-2 space-y-1">
          {itens.length > 0 && (
            <details className="group rounded-lg bg-gray-50 px-2.5 py-1.5">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-blue-700">
                <CaretDown size={11} className="-rotate-90 transition group-open:rotate-0" />
                <Package size={13} /> Itens ({itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0)} pç)
              </summary>
              <div className="mt-1.5 overflow-x-auto">
                <table className="w-full text-[11.5px]">
                  <thead className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="py-1 pr-2">Código</th>
                      <th className="py-1 pr-2">Produto</th>
                      <th className="py-1 pr-2">Cor</th>
                      <th className="py-1 pr-2">Tam</th>
                      <th className="py-1 text-right">Qtd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/70">
                    {itens.map((i, k) => (
                      <tr key={k}>
                        <td className="py-1 pr-2 font-mono font-bold text-[#000638]">{i.cod || '—'}</td>
                        <td className="py-1 pr-2">{i.descricao || i.nome || '—'}</td>
                        <td className="py-1 pr-2">{i.cor || '—'}</td>
                        <td className="py-1 pr-2">{i.tam || i.tamanho || '—'}</td>
                        <td className="py-1 text-right font-bold">{i.qtd || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          {(d.exp_info || (d.exp_anexos || []).length > 0) && (
            <details className="group rounded-lg bg-gray-50 px-2.5 py-1.5">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-blue-700">
                <CaretDown size={11} className="-rotate-90 transition group-open:rotate-0" />
                <ListChecks size={13} /> Info / checklist da expedição <CheckCircle size={12} weight="fill" className="text-emerald-600" />
              </summary>
              {d.exp_info && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-700">{d.exp_info}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {(d.exp_anexos || []).map((p, i) => (
                  <a key={p} href={arq + p} target="_blank" rel="noreferrer">
                    <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">
                      <ImageIcon size={11} /> checklist {i + 1}
                    </Chip>
                  </a>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

function ListaCards({ lista, vig, arq, busca }) {
  const filtrada = useMemo(() => {
    const termos = semAcento(busca).split(/\s+/).filter(Boolean);
    if (!termos.length) return lista;
    return lista.filter((c) => {
      const d = c.dados || {};
      const txt = semAcento(
        [c.titulo, c.canal, c.status, d.loja_retirada, d.loja, d.pedido_totvs, d.transacao, d.nf_numero, d.nome_cliente, d.nf_cliente, d.codigo_cliente, d.vendedor, d.transportadora, d.numero_pedido_site].join(' '),
      );
      return termos.every((t) => txt.includes(t));
    });
  }, [lista, busca]);
  if (!filtrada.length) return <p className="py-10 text-center text-sm text-gray-400">Nenhuma transação aqui 🎉</p>;
  return (
    <div className="space-y-2">
      {busca && <p className="text-[11px] text-gray-500">{filtrada.length} de {lista.length}</p>}
      {filtrada.map((c) => (
        <CardFila key={c.id} c={c} vig={vig} arq={arq} />
      ))}
    </div>
  );
}

// ─── Consulta de expedição — rastreio por transação ─────────────────────────
function RastreioVivo({ codigo }) {
  const [estado, setEstado] = useState(null); // null | 'carregando' | { erro } | { obj }
  const ver = async () => {
    setEstado('carregando');
    try {
      const r = await fetch(`${API_BASE_URL}/api/pedidos-venda/painel/rastreio-correios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'falha');
      const obj = (j.data?.data?.objetos || [])[0] || {};
      setEstado({ obj, msg: obj.mensagem || (j.data?.data?.msgs || [])[0] });
    } catch (e) {
      setEstado({ erro: e.message });
    }
  };
  if (estado === null)
    return (
      <button onClick={ver} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100">
        <Broadcast size={12} /> ver ao vivo
      </button>
    );
  if (estado === 'carregando') return <span className="text-[11px] text-gray-400">consultando Correios…</span>;
  if (estado.erro) return <span className="text-[11px] text-rose-600">erro: {estado.erro}</span>;
  const evs = estado.obj.eventos || [];
  if (!evs.length) return <span className="text-[11px] text-gray-400">sem eventos ainda{estado.msg ? ` (${estado.msg})` : ''}</span>;
  const cid = (ev) => [ev.unidade?.endereco?.cidade, ev.unidade?.endereco?.uf].filter(Boolean).join('/');
  const dest = (ev) => [ev.unidadeDestino?.endereco?.cidade, ev.unidadeDestino?.endereco?.uf].filter(Boolean).join('/');
  const atual = evs[0];
  const entregue = /entregue/i.test(atual.descricao || '');
  return (
    <div className="mt-1 rounded-xl bg-slate-50 p-2.5 ring-1 ring-blue-100">
      <p className="text-xs font-bold text-[#000638]">
        {entregue ? '📦 ENTREGUE' : `🚚 ${estado.obj.tipoPostal?.categoria || 'em trânsito'}`}
        {estado.obj.dtPrevista ? ` · previsão ${fmtD(estado.obj.dtPrevista)}` : ''}
      </p>
      <ol className="mt-1.5 space-y-1 border-l-2 border-blue-100 pl-3">
        {evs.map((ev, i) => (
          <li key={i} className="relative text-[11px]">
            <span className={`absolute -left-[17px] top-1 h-2 w-2 rounded-full ${i === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <b>{ev.descricao}</b>
            {cid(ev) ? ` · ${cid(ev)}` : ''}
            {dest(ev) ? ` ➜ ${dest(ev)}` : ''}
            <span className="block text-gray-400">{fmtDH(ev.dtHrCriado)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ConsultaExpedicao({ arq }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const timer = useRef(null);

  const buscar = useCallback(async (termo) => {
    const t = termo.trim().toLowerCase();
    if (!t) {
      setRes(null);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/pedidos-venda/painel/expedicao?q=${encodeURIComponent(t)}`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'falha na busca');
      const dig = (s) => String(s || '').replace(/\D/g, '');
      const dq = dig(t);
      // mesmo filtro do Dryland: texto em qualquer campo, ou número da transação/NF/cliente (≥ 3 dígitos)
      const l = (j.data || [])
        .filter((e) => {
          const hay = [e.titulo, e.nf_texto, e.cliente, e.codigo_cliente, e.loja_label, e.classificacao, e.transportadora, e.rastreio, e.situacao_rastreio, e.transacao_totvs]
            .map((x) => String(x || '').toLowerCase())
            .join(' ');
          if (hay.includes(t)) return true;
          const nums = `${e.titulo || ''},${e.nf_texto || ''},${e.codigo_cliente || ''},${e.transacao_totvs || ''}`.split(/[,\s]+/).map(dig).filter(Boolean);
          return dq.length >= 3 && nums.some((n) => n === dq || n.includes(dq));
        })
        .slice(0, 30);
      setRes(l);
    } catch (e) {
      setErro(e.message);
      setRes([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  const onChange = (v) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => buscar(v), 500);
  };

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-[#000638]">
          <MagnifyingGlass size={17} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[#000638]">Consulta de expedição — rastreio por transação</h3>
          <p className="text-[11px] text-gray-500">O que a expedição preencheu no checklist de saída + o código de rastreio.</p>
        </div>
      </div>
      <div className="relative mt-3">
        <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nº da transação, cliente ou nota fiscal"
          className="mb-0 h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
        />
        {carregando && <Spinner size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
      </div>
      {erro && <p className="mt-2 text-xs text-rose-600">{erro}</p>}
      {res && res.length === 0 && !carregando && !erro && <p className="mt-3 text-center text-xs text-gray-400">Nada encontrado para “{q}”.</p>}
      {res && res.length > 0 && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {res.map((e, i) => {
            const cod = String(e.rastreio || '').toUpperCase().replace(/\s/g, '');
            const ehCorreios = e.teve_saida && /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(cod);
            const sit = String(e.situacao_rastreio || '').toLowerCase();
            const retirada = (e.teve_saida && String(e.rastreio || '').toLowerCase() === 'retirada') || sit === 'retirada';
            const pb = (e.estado || '').toUpperCase() === 'PB' && /^(AZUL|LATAM)$/.test((e.transportadora || '').toUpperCase());
            const anexos = (e.foto_paths || []).filter(Boolean);
            const L = ({ r, children }) => (
              <div className="flex gap-2 text-xs">
                <span className="w-40 shrink-0 text-gray-400">{r}</span>
                <span className="min-w-0 text-gray-800">{children || '—'}</span>
              </div>
            );
            return (
              <div key={`${e.titulo}-${i}`} className="rounded-xl p-3 ring-1 ring-gray-200">
                {pb && <p className="mb-1.5 rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-bold text-white">🚫 Transportadora indisponível pra esse destino — troque pra CORREIOS!</p>}
                <div className="mb-1 flex items-center justify-between gap-2">
                  <b className="truncate text-sm text-[#000638]">{e.cliente || e.loja_label || e.classificacao || '—'}</b>
                  {retirada ? (
                    <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">Retirada</Chip>
                  ) : e.teve_saida ? (
                    <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">{e.rastreio ? `rastreio ${e.rastreio}` : 'saiu · sem código'}</Chip>
                  ) : (
                    <Chip cls="bg-amber-50 text-amber-700 ring-amber-200">Pendente — ainda não saiu</Chip>
                  )}
                </div>
                <L r="Transação">{e.titulo}</L>
                {e.saida_agrupada && (
                  <L r={String(e.saida_agrupada).replace(/\D/g, '') === String(e.transacao_totvs || '').replace(/\D/g, '') ? 'Transação no TOTVS' : 'Saiu junto com'}>{e.saida_agrupada}</L>
                )}
                <L r="Nº NF">{e.nf_texto}</L>
                <L r="Retirada/Transportadora">{sit === 'retirada' ? 'Retirada' : String(e.transportadora || e.forma_envio || '—').toUpperCase()}</L>
                <L r="Situação do envio">{e.situacao_rastreio || e.status_fila}</L>
                <L r="Rastreio">{e.teve_saida && e.rastreio && sit !== 'retirada' ? e.rastreio : null}</L>
                <L r="Transportadora selecionada">{String(e.transportadora || '—').toUpperCase()}</L>
                <L r="Acompanhamento ao vivo">{ehCorreios ? <RastreioVivo codigo={cod} /> : 'não disponível'}</L>
                <L r="Observações">{e.obs}</L>
                <L r="Arquivos anexados">
                  {anexos.length ? (
                    <span className="flex flex-wrap gap-1">
                      {anexos.map((p, k) => (
                        <a key={p} href={arq + p} target="_blank" rel="noreferrer">
                          <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">anexo {anexos.length > 1 ? k + 1 : ''}</Chip>
                        </a>
                      ))}
                    </span>
                  ) : (
                    'nenhum'
                  )}
                </L>
                <L r="Vendedor responsável">{e.vendedor}</L>
                <p className="mt-1 text-[10.5px] text-gray-400">
                  {fmtDH(e.criado_clickup || e.criado_fila)}
                  {e.previsao ? ` · previsão ${e.previsao}` : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Duplicatas do boleto (lista completa) ──────────────────────────────────
const CAT_DUP = {
  erro: { label: 'com erro', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  pendente: { label: 'a enviar', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  'na fila': { label: 'na fila de envio', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  'sem NF': { label: 'sem NF', cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
  enviada: { label: 'aguardando assinatura', cls: 'bg-teal-50 text-teal-700 ring-teal-200' },
  assinada: { label: 'assinada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  dispensada: { label: 'dispensada', cls: 'bg-gray-50 text-gray-400 ring-gray-200' },
};
const catDup = (c) => {
  const d = c.dados || {};
  if (d.duplicata_assinada_em) return 'assinada';
  if (d.duplicata_link) return 'enviada';
  if (d.duplicata_erro) return 'erro';
  if (d.duplicata_solicitada) return 'na fila';
  if (String(d.duplicata_dispensada) === 'true') return 'dispensada';
  return d.nf_numero ? 'pendente' : 'sem NF';
};

function GavetaDuplicatas({ inicial, onClose, vig, arq }) {
  const [cards, setCards] = useState(null);
  const [erro, setErro] = useState('');
  const [canal, setCanal] = useState(inicial.canal || '');
  const [origem, setOrigem] = useState(inicial.origem || '');
  const [classe, setClasse] = useState(inicial.classe || '');
  const [cat, setCat] = useState('');
  const [busca, setBusca] = useState('');
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/pedidos-venda/painel/duplicatas`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) throw new Error(j.message);
        setCards(j.data || []);
      })
      .catch((e) => {
        setErro(e.message);
        setCards([]);
      });
  }, []);
  const base = useMemo(
    () =>
      (cards || []).filter(
        (c) =>
          BOLETO(c) &&
          c.status !== 'cancelado' &&
          (!canal || c.canal === canal) &&
          (!origem || (origem === 'brejinho' ? BREJINHO(c) : !BREJINHO(c))) &&
          (!classe || String(c.dados?.showroom_classe || '').toUpperCase() === classe),
      ),
    [cards, canal, origem, classe],
  );
  const ordem = { erro: 0, pendente: 1, 'na fila': 2, 'sem NF': 3, enviada: 4, assinada: 5, dispensada: 6 };
  const lista = useMemo(
    () =>
      base
        .map((c) => ({ c, st: catDup(c) }))
        .filter((x) => !cat || x.st === cat)
        .sort((a, b) => ordem[a.st] - ordem[b.st] || String(b.c.criado_em || '').localeCompare(String(a.c.criado_em || ''))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, cat],
  );
  const conta = (st) => base.filter((c) => catDup(c) === st).length;
  const Botao = ({ on, onClick, children }) => (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition ${on ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-white text-[#000638] ring-gray-300 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
  return (
    <Gaveta
      titulo="Duplicatas do boleto"
      total={cards ? lista.length : null}
      onClose={onClose}
      busca={busca}
      onBusca={setBusca}
      larga
      extra={
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-bold uppercase text-gray-400">Canal</span>
            {[['', 'Todos'], ...CANAIS.map((c) => [c.id, c.label])].map(([k, l]) => (
              <Botao key={k} on={canal === k} onClick={() => setCanal(k)}>
                {l}
              </Botao>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-bold uppercase text-gray-400">Origem</span>
            {[
              ['', '', 'Todas'],
              ['blue', '', 'Só Blue (fila)'],
              ['brejinho', '', 'Brejinho — todas'],
              ['brejinho', 'MTM', 'Brejinho · MTM'],
              ['brejinho', 'FRANQUIA', 'Brejinho · Franquia'],
            ].map(([o, cl, l]) => (
              <Botao
                key={l}
                on={origem === o && classe === cl}
                onClick={() => {
                  setOrigem(o);
                  setClasse(cl);
                }}
              >
                {l}
              </Botao>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-bold uppercase text-gray-400">Situação</span>
            <Botao on={!cat} onClick={() => setCat('')}>
              Todas · {base.length}
            </Botao>
            {Object.entries(CAT_DUP).map(([k, v]) => (
              <Botao key={k} on={cat === k} onClick={() => setCat(k)}>
                {v.label} · {conta(k)}
              </Botao>
            ))}
          </div>
        </div>
      }
    >
      {erro && <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {cards === null ? (
        <div className="py-16 text-center text-gray-400">
          <Spinner size={22} className="mx-auto animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {lista
            .filter(({ c }) => {
              const termos = semAcento(busca).split(/\s+/).filter(Boolean);
              if (!termos.length) return true;
              const d = c.dados || {};
              const txt = semAcento([c.titulo, d.nome_cliente, d.nf_numero, d.pedido_totvs, d.transacao, d.codigo_cliente, d.doc].join(' '));
              return termos.every((t) => txt.includes(t));
            })
            .map(({ c, st }) => (
              <div key={c.id}>
                <div className="mb-0.5 flex items-center gap-1.5 px-1">
                  <Chip cls={CAT_DUP[st].cls}>{CAT_DUP[st].label}</Chip>
                  {c.dados?.duplicata_erro && <span className="truncate text-[11px] text-rose-600">{String(c.dados.duplicata_erro).slice(0, 100)}</span>}
                  {st === 'enviada' && !c.dados?.whats_cliente && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-rose-600">
                      <WhatsappLogo size={12} /> sem WhatsApp do cliente
                    </span>
                  )}
                </div>
                <CardFila c={c} vig={vig} arq={arq} />
              </div>
            ))}
          {lista.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhuma venda no boleto aqui.</p>}
        </div>
      )}
    </Gaveta>
  );
}

// ─── Varejo + Transferências · saída ────────────────────────────────────────
const vsFaturado = (x) => /faturad|enviado|conclu/i.test(x.status || '');
function GavetaVarejoSaida({ linhas, dias, onDias, carregando, onClose }) {
  const [filtro, setFiltro] = useState('pend');
  const [tipo, setTipo] = useState('todos');
  const [busca, setBusca] = useState('');
  const F = {
    pend: ['Faturado sem saída', (x) => vsFaturado(x) && !x.saida],
    ok: ['Já saiu', (x) => !!x.saida],
    nfat: ['Ainda não faturado', (x) => !vsFaturado(x) && !x.saida],
    todos: ['Todos', () => true],
  };
  const T = { todos: 'Todos', cliente: 'Clientes varejo', transferencia: 'Transferências' };
  const base = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (linhas || [])
      .filter((x) => tipo === 'todos' || x.tipo === tipo)
      .filter((x) => !q || [x.numero, x.loja, x.cliente, x.nf, x.transacao, x.pedido_totvs, x.titulo].join(' ').toLowerCase().includes(q));
  }, [linhas, tipo, busca]);
  const lista = base
    .filter(F[filtro][1])
    .sort((a, b) => String(a.loja || '').localeCompare(String(b.loja || ''), 'pt-BR') || String(b.criado_em).localeCompare(String(a.criado_em)));
  const Botao = ({ on, onClick, children }) => (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition ${on ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-white text-[#000638] ring-gray-300 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
  return (
    <Gaveta
      titulo="Varejo + Transferências · saída"
      total={lista.length}
      onClose={onClose}
      busca={busca}
      onBusca={setBusca}
      extra={
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <select value={dias} onChange={(e) => onDias(Number(e.target.value))} className="mb-0 h-7 rounded-full border border-gray-300 px-2 text-[11px] font-bold text-[#000638]">
              {[7, 15, 30, 60].map((d) => (
                <option key={d} value={d}>
                  últimos {d} dias
                </option>
              ))}
            </select>
            {carregando && <Spinner size={13} className="animate-spin text-gray-400" />}
            {Object.entries(F).map(([k, [t, f]]) => (
              <Botao key={k} on={filtro === k} onClick={() => setFiltro(k)}>
                {t} · {base.filter(f).length}
              </Botao>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(T).map(([k, t]) => (
              <Botao key={k} on={tipo === k} onClick={() => setTipo(k)}>
                {t}
              </Botao>
            ))}
          </div>
        </div>
      }
    >
      {!lista.length ? (
        <p className="py-10 text-center text-sm text-gray-400">Nada aqui 🎉</p>
      ) : (
        <div className="space-y-2">
          {lista.map((x) => {
            const s = x.saida;
            return (
              <div key={x.id} className="rounded-2xl bg-white p-3 ring-1 ring-gray-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="flex items-center gap-1.5 text-sm text-[#000638]">
                    {x.tipo === 'transferencia' ? <ArrowsLeftRight size={15} /> : <Storefront size={15} />}
                    {x.numero} · {x.loja || '—'}
                  </b>
                  <span className="text-[11px] text-gray-400">criado {fmtDH(x.criado_em)}</span>
                </div>
                {x.tipo === 'cliente' && x.cliente && <p className="mt-0.5 text-xs text-gray-700">{x.cliente}</p>}
                <p className="text-[11px] text-gray-500">
                  {x.pedido_totvs ? `pedido TOTVS ${x.pedido_totvs} · ` : ''}
                  {x.nf ? `NF ${x.nf}` : 'sem NF'}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s ? (
                    <>
                      <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">
                        <CheckCircle size={11} weight="fill" /> saiu {fmtDH(s.em)}
                        {s.expedidor ? ` · ${s.expedidor}` : ''}
                      </Chip>
                      <Chip>
                        {String(s.transportadora || '—').toUpperCase()}
                        {s.rastreio ? ` · ${s.rastreio}` : ''}
                      </Chip>
                    </>
                  ) : vsFaturado(x) ? (
                    <Chip cls="bg-rose-50 text-rose-700 ring-rose-200">faturado, sem checklist de saída</Chip>
                  ) : (
                    <Chip cls="bg-amber-50 text-amber-700 ring-amber-200">{x.status || 'a faturar'}</Chip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Gaveta>
  );
}

// ─── Showroom / pedidos a enviar ────────────────────────────────────────────
function GavetaShowroom({ linhas, onClose, arq }) {
  const [filtro, setFiltro] = useState('recebido');
  const [busca, setBusca] = useState('');
  const todos = linhas || [];
  const lista = todos
    .slice()
    .sort(
      (a, b) =>
        ({ transito: 0, recebido: 1 })[a.coluna] - ({ transito: 0, recebido: 1 })[b.coluna] ||
        String(b.recebido_em || b.criado_clickup || '').localeCompare(String(a.recebido_em || a.criado_clickup || '')),
    )
    .filter((c) => filtro === 'todos' || c.coluna === filtro)
    .filter((c) => {
      const q = busca.trim().toLowerCase();
      return !q || [c.titulo, c.cliente, c.nf, c.estado, c.frete_tipo, c.expedidor].some((v) => String(v || '').toLowerCase().includes(q));
    });
  const n = (col) => todos.filter((c) => col === 'todos' || c.coluna === col).length;
  const Botao = ({ on, onClick, children }) => (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition ${on ? 'bg-[#000638] text-white ring-[#000638]' : 'bg-white text-[#000638] ring-gray-300 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
  return (
    <Gaveta
      titulo="Showroom / pedidos a enviar"
      total={lista.length}
      onClose={onClose}
      busca={busca}
      onBusca={setBusca}
      extra={
        <div className="mt-2 flex flex-wrap gap-1">
          <Botao on={filtro === 'recebido'} onClick={() => setFiltro('recebido')}>
            Na matriz · {n('recebido')}
          </Botao>
          <Botao on={filtro === 'transito'} onClick={() => setFiltro('transito')}>
            Vindo de Brejinho · {n('transito')}
          </Botao>
          <Botao on={filtro === 'todos'} onClick={() => setFiltro('todos')}>
            Todos · {n('todos')}
          </Botao>
        </div>
      }
    >
      {!lista.length ? (
        <p className="py-10 text-center text-sm text-gray-400">Nenhum pedido aqui.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((c) => (
            <div key={c.id} className="rounded-2xl bg-white p-3 ring-1 ring-gray-200 shadow-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <b className="mr-1 text-sm text-[#000638]">{c.titulo || '—'}</b>
                {c.coluna === 'transito' ? (
                  <Chip cls="bg-amber-50 text-amber-700 ring-amber-200">
                    <Truck size={11} /> vindo de Brejinho
                  </Chip>
                ) : (
                  <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">
                    <Warehouse size={11} /> na matriz
                  </Chip>
                )}
                {c.classificacao && <Chip>{c.classificacao}</Chip>}
                {c.volumes ? <Chip>{c.volumes} vol</Chip> : null}
                {c.frete_tipo ? (
                  <Chip cls="bg-blue-50 text-blue-700 ring-blue-200">frete {c.frete_tipo}</Chip>
                ) : (
                  <Chip cls="bg-rose-50 text-rose-600 ring-rose-200">sem frete escolhido</Chip>
                )}
                {c.escolha_cliente === 'aguardar_showroom' && <Chip cls="bg-amber-50 text-amber-700 ring-amber-200">cliente pediu pra aguardar outro showroom</Chip>}
                {c.escolha_cliente === 'retirada' && <Chip cls="bg-indigo-50 text-indigo-700 ring-indigo-200">cliente vai retirar na matriz</Chip>}
                {c.escolha_cliente === 'seguir_envio' && <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">cliente confirmou o envio</Chip>}
              </div>
              <p className="mt-1 text-xs text-gray-700">
                <b>{c.cliente || '—'}</b>
                {c.nf ? ` · NF ${c.nf}` : ''}
                {c.valor_nf != null ? (
                  <b className="text-emerald-700">
                    {' '}
                    · {fmtBRL(c.valor_nf)}
                    {Number(c.valor_notas) > 1 ? ` (${c.valor_notas} notas)` : ''}
                  </b>
                ) : (
                  <span className="text-gray-400"> · valor da NF não encontrado</span>
                )}
                {c.estado ? ` · ${c.estado}` : ''}
              </p>
              <p className="text-[11px] text-gray-500">
                {c.expedidor ? `${c.expedidor} · ` : ''}
                {c.faturado_em ? `faturado em ${fmtD(c.faturado_em)} · ` : ''}
                {c.recebido_em
                  ? `recebido em ${fmtD(c.recebido_em)}${c.recebido_por ? ` por ${c.recebido_por}` : ''}`
                  : c.coluna === 'transito'
                    ? `saiu de Brejinho em ${fmtD(c.criado_clickup) || '—'}`
                    : 'faturado e ainda sem checklist de saída'}
              </p>
              {(c.card_obs || (c.card_anexos || []).length > 0) && (
                <div className="mt-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11.5px] text-gray-600">
                  {c.card_obs}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(c.card_anexos || []).map((p, i) => (
                      <a key={p} href={arq + p} target="_blank" rel="noreferrer">
                        <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">arquivo {i + 1}</Chip>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Gaveta>
  );
}

// ─── Painel ─────────────────────────────────────────────────────────────────
export default function PainelExpedicao() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [dias, setDias] = useState(15);
  const [gaveta, setGaveta] = useState(null); // { tipo:'lista', titulo, lista } | { tipo:'dup', ...} | { tipo:'varejo' } | { tipo:'showroom' }
  const [buscaGaveta, setBuscaGaveta] = useState('');
  const [buscaConcl, setBuscaConcl] = useState('');
  const [buscandoConcl, setBuscandoConcl] = useState(false);

  const carregar = useCallback(
    async (forcar = false, d = dias) => {
      setCarregando(true);
      setErro('');
      try {
        const r = await fetch(`${API_BASE_URL}/api/pedidos-venda/painel?dias=${d}${forcar ? '&forcar=1' : ''}`);
        const j = await r.json();
        if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao ler o painel');
        setDados(j.data);
      } catch (e) {
        setErro(e.message);
      } finally {
        setCarregando(false);
      }
    },
    [dias],
  );

  useEffect(() => {
    carregar(false);
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') carregar(false);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [carregar]);

  const cards = useMemo(() => dados?.cards || [], [dados]);
  const vig = dados?.vigia || {};
  const arq = dados?.arquivoBase || '';

  // ─── contas do painelLoad ─────────────────────────────────────────────────
  const conta = useMemo(() => {
    const abertos = cards.filter((c) => !FINAL(c.status));
    const d30 = D30();
    const concl = cards.filter((c) => FINAL(c.status) && new Date(c.criado_em || 0).getTime() > d30);
    const porCanal = {};
    for (const c of cards.filter(A_FATURAR)) porCanal[c.canal] = (porCanal[c.canal] || 0) + 1;
    const porStatus = {};
    for (const c of abertos) porStatus[c.status || '?'] = (porStatus[c.status || '?'] || 0) + 1;
    const porTr = {};
    let foraPorDup = 0;
    for (const c of abertos.filter((c) => /aguardando minuta/i.test(c.status || ''))) {
      if (TRAVA_DUP(c)) {
        foraPorDup += 1;
        continue;
      }
      const t = trDe(c);
      if (t !== '—') porTr[t] = (porTr[t] || 0) + 1;
    }
    const porTrC = {};
    for (const c of concl) porTrC[trDe(c)] = (porTrC[trDe(c)] || 0) + 1;
    // duplicatas do boleto (sem as de Brejinho)
    const bol = cards.filter((c) => BOLETO(c) && !BREJINHO(c) && c.status !== 'cancelado' && !/faturamento conclu|pedido faturado/i.test(c.status || ''));
    const dupOk = bol.filter((c) => c.dados?.duplicata_assinada_em);
    const dupEspera = bol.filter((c) => !c.dados?.duplicata_assinada_em && c.dados?.nf_numero);
    const dupSemNf = bol.filter((c) => !c.dados?.duplicata_assinada_em && !c.dados?.nf_numero);
    // duplicatas de Brejinho (showroom)
    const brej = cards.filter((c) => BREJINHO(c) && c.status !== 'cancelado');
    const catB = (c) => (c.dados?.duplicata_assinada_em ? 'assinada' : c.dados?.duplicata_link ? 'enviada' : c.dados?.duplicata_erro ? 'erro' : 'pendente');
    const brejLinhas = [
      ['MTM', 'MTM', Tag],
      ['FRANQUIA', 'Franquia', Buildings],
    ].map(([classe, rot, icon]) => {
      const l = brej.filter((c) => String(c.dados?.showroom_classe || '').toUpperCase() === classe);
      const n = (x) => l.filter((c) => catB(c) === x).length;
      return { classe, rot, icon, total: l.length, assinada: n('assinada'), enviada: n('enviada'), pendente: n('pendente'), erro: n('erro') };
    });
    return {
      abertos,
      porCanal,
      vigia: abertos.filter((c) => vigiaRuim(vig[c.id])).length,
      faltaInfo: abertos.filter(FALTA_INFO).length,
      etiqueta: abertos.filter((c) => c.dados?.minuta_solicitada === 'correios' && !c.dados?.etiqueta_path).length,
      transito: cards.filter((c) => c.dados?.correios_objeto && !c.dados?.rastreio_entregue).length,
      entregues: cards.filter((c) => c.dados?.rastreio_entregue).length,
      porStatus: Object.entries(porStatus).sort((a, b) => b[1] - a[1]),
      porTr: Object.entries(porTr).sort((a, b) => b[1] - a[1]),
      foraPorDup,
      porTrC: Object.entries(porTrC).sort((a, b) => b[1] - a[1]),
      dupOk,
      dupEspera,
      dupSemNf,
      semZap: dupEspera.filter((c) => !c.dados?.whats_cliente).length,
      brejLinhas,
      temBrej: brej.length > 0,
    };
  }, [cards, vig]);

  // ─── abreLista do Dryland ─────────────────────────────────────────────────
  const abrirLista = useCallback(
    (filtro, titulo, listaPronta) => {
      const abertos = cards.filter((c) => c.status !== 'faturamento concluído');
      const d30 = D30();
      let lista = [];
      if (listaPronta) lista = listaPronta;
      else if (filtro === 'dupok') lista = conta.dupOk;
      else if (filtro === 'dupespera') lista = conta.dupEspera;
      else if (filtro === 'dupsemnf') lista = conta.dupSemNf;
      else if (filtro.startsWith('canal:')) lista = cards.filter((c) => c.canal === filtro.slice(6) && A_FATURAR(c));
      else if (filtro.startsWith('status:')) lista = abertos.filter((c) => (c.status || '?') === filtro.slice(7));
      else if (filtro.startsWith('transp:'))
        lista = abertos.filter((c) => /aguardando minuta/i.test(c.status || '') && trDe(c) === filtro.slice(7) && !TRAVA_DUP(c));
      else if (filtro.startsWith('concl:'))
        lista = cards.filter((c) => CONCLUIDO_LISTA(c.status) && new Date(c.criado_em || 0).getTime() > d30 && trDe(c) === filtro.slice(6));
      else if (filtro === 'faltainfo') lista = abertos.filter(FALTA_INFO);
      else if (filtro === 'etiqueta') lista = abertos.filter((c) => c.dados?.minuta_solicitada === 'correios' && !c.dados?.etiqueta_path);
      else if (filtro === 'transito') lista = cards.filter((c) => c.dados?.correios_objeto && !c.dados?.rastreio_entregue);
      else if (filtro === 'entregues') lista = cards.filter((c) => c.dados?.rastreio_entregue);
      else if (filtro === 'vigia') lista = abertos.filter((c) => vigiaRuim(vig[c.id]));
      // varejo: agrupado por loja de destino (A→Z) e, dentro da loja, pelo pedido TOTVS
      if (filtro === 'canal:varejo') {
        const lojaDe = (c) => {
          const d = c.dados || {};
          return String(d.loja_retirada || d.loja || (String(c.titulo || '').match(/LOJA\s+([A-ZÀ-Ú ]+?)(?:\s*\(|$)/i) || [])[1] || '')
            .trim()
            .toUpperCase();
        };
        const totvsDe = (c) => {
          const d = c.dados || {};
          const n = Number(String(d.pedido_totvs || d.transacao || (String(c.titulo || '').match(/\d{4,}/) || [])[0] || '').replace(/\D/g, ''));
          return n || Infinity;
        };
        lista = [...lista].sort((a, b) => {
          const la = lojaDe(a);
          const lb = lojaDe(b);
          if (la !== lb) return !la ? 1 : !lb ? -1 : la.localeCompare(lb, 'pt-BR');
          return totvsDe(a) - totvsDe(b);
        });
      }
      setBuscaGaveta('');
      setGaveta({ tipo: 'lista', titulo, lista });
    },
    [cards, conta, vig],
  );

  const buscarConcluidos = async () => {
    const q = buscaConcl.trim();
    if (q.length < 2) return;
    const alvo = (c) => {
      const d = c.dados || {};
      return [c.titulo, d.nome_cliente, d.nf_cliente, d.nf_numero, d.pedido_totvs, d.transacao, d.numero_pedido_site, d.codigo_cliente, d.vendedor, d.transportadora]
        .join(' ')
        .toLowerCase();
    };
    let lista = cards.filter((c) => FINAL(c.status) && alvo(c).includes(q.toLowerCase()));
    if (!lista.length) {
      setBuscandoConcl(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/pedidos-venda/painel/concluidos?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (j.success) lista = j.data || [];
      } catch {
        /* segue com vazio */
      } finally {
        setBuscandoConcl(false);
      }
    }
    abrirLista('', `Concluídos · busca “${q}”`, lista);
  };

  // muda `dias` → `carregar` muda → o efeito acima busca de novo
  const trocarDias = (d) => setDias(d);

  if (!dados && carregando)
    return (
      <div className="py-24 text-center text-gray-400">
        <Spinner size={26} className="mx-auto animate-spin" />
        <p className="mt-2 text-xs">Lendo o painel do Dryland…</p>
      </div>
    );

  const vsPend = (dados?.varejoSaida || []).filter((x) => vsFaturado(x) && !x.saida).length;
  const sr = dados?.showroom;
  const srMatriz = (sr || []).filter((c) => c.coluna === 'recebido');
  const srTransito = (sr || []).filter((c) => c.coluna === 'transito').length;
  const srSemFrete = srMatriz.filter((c) => !c.frete_tipo).length;

  return (
    <div className="space-y-3">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gradient-to-r from-[#000638] to-[#1b2a6b] px-4 py-3 text-white shadow-sm">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Gestão à vista — Expedição</p>
          <p className="text-[11px] text-white/70">
            {dados ? `atualizado ${new Date(dados.atualizadoEm).toLocaleTimeString('pt-BR')} · atualiza sozinho a cada 3 min` : '—'} · últimos 500 cards da fila do Dryland
          </p>
        </div>
        <a
          href={DRYLAND_FRETE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
          title="Mudar status, transportadora, checklist e enviar duplicata continuam no Dryland"
        >
          Abrir no Dryland <ArrowSquareOut size={12} />
        </a>
        <button
          onClick={() => carregar(true)}
          disabled={carregando}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-[#000638] hover:bg-white/90 disabled:opacity-60"
        >
          <ArrowsClockwise size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar agora
        </button>
      </div>

      {erro && (
        <p className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
          <Warning size={14} weight="bold" /> {erro}
        </p>
      )}
      {dados?.falhas?.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-200">Parte do painel não carregou: {dados.falhas.join(' · ')}</p>
      )}

      {dados && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {CANAIS.map((c) => {
              const n = conta.porCanal[c.id] || 0;
              return <Kpi key={c.id} icon={c.icon} label={c.label} valor={n} sub="a faturar · ver transações" tom={n > 0 ? 'ambar' : 'ok'} onClick={() => abrirLista(`canal:${c.id}`, `${c.label} · a faturar`)} />;
            })}
            <Kpi icon={ShieldWarning} label="Vigia — não emitir NF" valor={conta.vigia} sub="cadastro/IE com pendência" tom={tomAlerta(conta.vigia)} onClick={() => abrirLista('vigia', 'Vigia — não emitir NF')} />
            <Kpi icon={NotePencil} label="Falta informação" valor={conta.faltaInfo} sub="devolver ao vendedor" tom={tomAlerta(conta.faltaInfo)} onClick={() => abrirLista('faltainfo', 'Falta informação')} />
            <Kpi icon={Barcode} label="Etiqueta na fila" valor={conta.etiqueta} sub="watcher ≤ 5 min" tom={tomAlerta(conta.etiqueta)} onClick={() => abrirLista('etiqueta', 'Etiqueta na fila')} />
            <Kpi icon={Truck} label="Em trânsito" valor={conta.transito} sub="rastreio" tom="info" onClick={() => abrirLista('transito', 'Em trânsito')} />
            <Kpi icon={SealCheck} label="Entregues" valor={conta.entregues} sub="30 dias" tom="ok" onClick={() => abrirLista('entregues', 'Entregues')} />
            <Kpi icon={Warehouse} label="Na matriz × enviados" tom="roxo" sub="site + showroom · 30 dias" onClick={() => abrirLista('status:Pronto na matriz', 'Pronto na matriz (site)')}>
              <div className="mt-1.5 flex items-baseline gap-1.5 leading-none">
                <span className="text-[2rem] font-extrabold tabular-nums text-violet-600">{dados.matriz.naMatriz}</span>
                <span className="text-sm font-bold text-gray-300">×</span>
                <span className="text-[1.6rem] font-extrabold tabular-nums text-violet-400">{dados.matriz.enviados}</span>
              </div>
            </Kpi>
            {dados.varejoSaida && (
              <Kpi
                icon={ArrowsLeftRight}
                label="Varejo + transf. · saída"
                valor={vsPend}
                sub="faturado sem checklist de saída"
                tom={tomAlerta(vsPend)}
                onClick={() => setGaveta({ tipo: 'varejo' })}
              />
            )}
            {sr && (
              <Kpi
                icon={Cube}
                label="Showroom/pedidos a enviar"
                valor={srMatriz.length}
                sub={`${srSemFrete ? `${srSemFrete} sem frete escolhido` : 'prontos pra sair'}${srTransito ? ` · ${srTransito} vindo de Brejinho` : ''}`}
                tom={srMatriz.length ? 'ambar' : 'ok'}
                onClick={() => setGaveta({ tipo: 'showroom' })}
              />
            )}
          </div>

          <ConsultaExpedicao arq={arq} />

          {/* Painéis */}
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            <Painel
              icon={Receipt}
              titulo="Duplicatas do boleto — o que pode sair"
              acoes={
                <button
                  onClick={() => setGaveta({ tipo: 'dup', inicial: { origem: 'blue' } })}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700"
                >
                  Ver a lista completa <CaretRight size={12} weight="bold" />
                </button>
              }
            >
              <Barras
                linhas={[
                  { label: 'Assinadas — pode expedir', n: conta.dupOk.length, tom: 'ok', onClick: () => abrirLista('dupok', 'Duplicatas assinadas — pode expedir') },
                  { label: 'Aguardando o cliente assinar', n: conta.dupEspera.length, tom: 'ambar', onClick: () => abrirLista('dupespera', 'Aguardando o cliente assinar') },
                  { label: 'Sem nota emitida', n: conta.dupSemNf.length, tom: 'cinza', onClick: () => abrirLista('dupsemnf', 'Boleto sem nota emitida') },
                ]}
              />
              {conta.semZap > 0 && (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                  <WhatsappLogo size={13} /> {conta.semZap} sem WhatsApp do cliente no card — a duplicata não tem pra onde ir
                </p>
              )}
            </Painel>

            <Painel
              icon={Factory}
              titulo="Duplicatas Exped Brejinho — showroom"
              sub="Vendas de showroom faturadas em Brejinho (op 7299 MTM · 7254 franquia · 7007 Suframa). O robô cria o card e manda a duplicata sozinho."
            >
              {!conta.temBrej ? (
                <p className="py-4 text-center text-xs text-gray-400">Nenhuma venda de showroom a prazo nos últimos dias.</p>
              ) : (
                <div className="space-y-2">
                  {conta.brejLinhas.map((l) => {
                    const Icon = l.icon;
                    const pct = (x) => (l.total ? `${(x / l.total) * 100}%` : '0%');
                    return (
                      <button
                        key={l.classe}
                        onClick={() => setGaveta({ tipo: 'dup', inicial: { origem: 'brejinho', classe: l.classe } })}
                        className="group w-full rounded-xl p-2.5 text-left ring-1 ring-gray-200 hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#000638]">
                            <Icon size={15} /> {l.rot}
                          </span>
                          <span className="text-xs text-gray-500">
                            <b className="text-[#000638]">{l.total}</b> venda(s) <CaretRight size={11} className="inline text-gray-300 group-hover:text-gray-500" />
                          </span>
                        </div>
                        <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-gray-100">
                          <span className="bg-emerald-500" style={{ width: pct(l.assinada) }} />
                          <span className="bg-teal-300" style={{ width: pct(l.enviada) }} />
                          <span className="bg-amber-400" style={{ width: pct(l.pendente) }} />
                          <span className="bg-rose-500" style={{ width: pct(l.erro) }} />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
                          <span className="font-semibold text-emerald-700">{l.assinada} assinada(s)</span>
                          <span className="text-teal-700">{l.enviada} aguardando assinatura</span>
                          <span className="text-amber-700">{l.pendente} a enviar</span>
                          {l.erro > 0 && <span className="font-semibold text-rose-600">{l.erro} com erro</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Painel>

            <Painel icon={Hourglass} titulo="Pendências por status (abertos)">
              <Barras
                linhas={conta.porStatus.map(([st, n]) => ({
                  label: st,
                  n,
                  tom: /erro|falta|inadimplente|bloqueio|duplicado|errado/.test(st) ? 'alerta' : /aguardando/.test(st) ? 'ambar' : 'navy',
                  onClick: () => abrirLista(`status:${st}`, st),
                }))}
              />
            </Painel>

            <Painel icon={Truck} titulo="Envios pendentes por transportadora" sub="Só os pedidos aguardando minuta.">
              <Barras
                linhas={conta.porTr.map(([t, n]) => ({ label: t, n, tom: 'alerta', onClick: () => abrirLista(`transp:${t}`, `Aguardando minuta · ${t}`) }))}
              />
              {conta.foraPorDup > 0 && (
                <p className="mt-2 flex items-start gap-1 text-[11px] text-gray-500">
                  <Lock size={12} className="mt-0.5 shrink-0" /> {conta.foraPorDup} pedido(s) fora desta conta: travados por duplicata não assinada — não são fila da
                  expedição.
                </p>
              )}
            </Painel>

            <Painel icon={CheckCircle} titulo="Concluídos por transportadora (30 dias)">
              <div className="mb-3 flex gap-1.5">
                <div className="relative flex-1">
                  <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={buscaConcl}
                    onChange={(e) => setBuscaConcl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscarConcluidos()}
                    placeholder="Buscar concluído: transação, NF, cliente, pedido…"
                    className="mb-0 h-9 w-full rounded-lg border border-gray-300 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30"
                  />
                </div>
                <button
                  onClick={buscarConcluidos}
                  disabled={buscandoConcl || buscaConcl.trim().length < 2}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#000638] px-3 text-xs font-bold text-white disabled:opacity-40"
                >
                  {buscandoConcl ? <Spinner size={13} className="animate-spin" /> : <MagnifyingGlass size={13} />} Buscar
                </button>
              </div>
              <Barras linhas={conta.porTrC.map(([t, n]) => ({ label: t, n, tom: 'ok', onClick: () => abrirLista(`concl:${t}`, `Concluídos · ${t}`) }))} />
            </Painel>
          </div>
        </>
      )}

      {gaveta?.tipo === 'lista' && (
        <Gaveta titulo={gaveta.titulo} total={gaveta.lista.length} onClose={() => setGaveta(null)} busca={buscaGaveta} onBusca={gaveta.lista.length > 3 ? setBuscaGaveta : null}>
          <ListaCards lista={gaveta.lista} vig={vig} arq={arq} busca={buscaGaveta} />
        </Gaveta>
      )}
      {gaveta?.tipo === 'dup' && <GavetaDuplicatas inicial={gaveta.inicial || {}} onClose={() => setGaveta(null)} vig={vig} arq={arq} />}
      {gaveta?.tipo === 'varejo' && (
        <GavetaVarejoSaida linhas={dados?.varejoSaida} dias={dias} onDias={trocarDias} carregando={carregando} onClose={() => setGaveta(null)} />
      )}
      {gaveta?.tipo === 'showroom' && <GavetaShowroom linhas={sr} arq={arq} onClose={() => setGaveta(null)} />}
    </div>
  );
}
