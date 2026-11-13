// ============================================================================
// HEADCOACH › CAIXA — Abertura, Contagem e Fechamento (com o encerramento do
// dia junto). Yago, 12/11/2026: o mesmo roteiro do TOTVS (PDVFM001 › Menu
// Caixa e GERFP010), mais enxuto:
//   • Um caixa por empresa (sem terminal — Yago, 12/11/2026).
//   • Abertura: a empresa, na data de caixa dela, com o fundo de troco
//     (sugere o que o caixa anterior deixou); com o caixa aberto, suprimento e
//     retirada (com senha) e estorno do que foi lançado errado.
//   • Contagem: o valor total em dinheiro + conferência de cada forma contra o
//     que o sistema registrou; mostra a diferença na hora. Salvou, fica travada
//     (cadeado): só owner, admin ou financeiro reabre, com senha.
//   • Voltar data: owner, admin ou financeiro volta a data de caixa quando o dia
//     foi encerrado para a data errada.
//   • Fechamento: resumo, fundo que fica para o próximo caixa, senha, comprovante;
//     e logo abaixo o encerramento do dia (data de caixa → próximo dia).
// API: /api/hc/caixa (exige login) — services/hcCaixa.js
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CashRegister,
  LockOpen,
  Lock,
  Coins,
  CalendarCheck,
  Plus,
  Minus,
  Printer,
  ArrowsClockwise,
  Warning,
  CheckCircle,
  Spinner,
  ArrowCounterClockwise,
  Info,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';

const API = '/api/hc/caixa';
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const maisDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
const btnPri = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#000638] px-4 text-sm font-bold text-white hover:bg-[#000638]/90 disabled:opacity-40';
const btnSec = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40';
const FORMAS_PADRAO = ['credito', 'debito', 'pix'];
const NOME_FORMA = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Cartão de crédito', debito: 'Cartão de débito', boleto: 'Boleto', credito_loja: 'Credev', adiantamento: 'Adiantamento', vale_troca: 'Vale-troca', saldo_bonus: 'Saldo bônus' };
const nomeForma = (f) => NOME_FORMA[f] || f;
// owner, admin e financeiro (perfil "user") reabrem a contagem e voltam a data de caixa
const PERFIS_GESTAO = ['owner', 'admin', 'user'];
const MOV = {
  suprimento: { label: 'Suprimento', cls: 'text-emerald-700', sinal: '+' },
  retirada: { label: 'Retirada', cls: 'text-rose-700', sinal: '−' },
  retirada_fechamento: { label: 'Retirada do fechamento', cls: 'text-rose-700', sinal: '−' },
};
const ETAPAS = [
  { k: 'abertura', label: 'Abertura', icon: LockOpen, href: '/headcoach/caixa/abertura' },
  { k: 'contagem', label: 'Contagem', icon: Coins, href: '/headcoach/caixa/contagem' },
  { k: 'fechamento', label: 'Fechamento e encerramento', icon: Lock, href: '/headcoach/caixa/fechamento' },
];
const lerLocal = (k, padrao) => {
  try {
    return localStorage.getItem(k) || padrao;
  } catch {
    return padrao;
  }
};
const gravarLocal = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sem storage */
  }
};

function Bloco({ titulo, icone: Icone, children, extra, className = '' }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Icone size={15} className="text-[#000638]" />
        <h3 className="flex-1 text-[11px] font-bold uppercase tracking-wide text-[#000638]">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}
function Linha({ rotulo, valor, forte, cls = '' }) {
  return (
    <p className={`flex justify-between gap-2 text-xs ${forte ? 'border-t border-gray-100 pt-1 text-sm font-bold text-[#000638]' : ''}`}>
      <span className={forte ? '' : 'text-gray-500'}>{rotulo}</span>
      <span className={`tabular-nums font-semibold ${cls}`}>{valor}</span>
    </p>
  );
}
const Diferenca = ({ v }) => {
  const d = round2(v);
  if (Math.abs(d) < 0.005) return <span className="font-bold text-emerald-700">confere</span>;
  return <span className={`font-bold ${d > 0 ? 'text-sky-700' : 'text-rose-700'}`}>{d > 0 ? `sobra ${fmtBRL(d)}` : `falta ${fmtBRL(-d)}`}</span>;
};

// pede senha / motivo antes de uma ação (retirada, estorno, fechamento, reabertura).
// pedirAutorizador: e-mail + senha de quem autoriza (pode ser outra pessoa).
function Confirmar({ titulo, texto, pedirMotivo, motivoOpcional, pedirSenha = true, pedirAutorizador, emailPadrao = '', onConfirmar, onCancelar, busy }) {
  const [motivo, setMotivo] = useState('');
  const [senha, setSenha] = useState('');
  const [email, setEmail] = useState(emailPadrao);
  const motivoOk = !pedirMotivo || motivoOpcional || motivo.trim().length >= 3;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirmar({ motivo, senha, email: email.trim() });
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <h3 className="text-lg font-bold text-[#000638]">{titulo}</h3>
        {texto && <p className="mt-1 text-sm text-gray-600">{texto}</p>}
        {pedirAutorizador ? (
          <>
            <div className="mt-3">
              <label className={labelCls}>E-mail de quem autoriza</label>
              <input autoFocus={!emailPadrao} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className={inputCls} />
            </div>
            <div className="mt-3">
              <label className={labelCls}>Senha de quem autoriza</label>
              <input autoFocus={!!emailPadrao} type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
            </div>
            {pedirMotivo && (
              <div className="mt-3">
                <label className={labelCls}>Motivo{motivoOpcional ? ' (opcional)' : ''}</label>
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
              </div>
            )}
          </>
        ) : (
          <>
            {pedirMotivo && (
              <div className="mt-3">
                <label className={labelCls}>Motivo{motivoOpcional ? ' (opcional)' : ''}</label>
                <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
              </div>
            )}
            {pedirSenha && (
              <div className="mt-3">
                <label className={labelCls}>Sua senha do HeadCoach</label>
                <input autoFocus={!pedirMotivo} type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
              </div>
            )}
          </>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancelar} disabled={busy} className="h-10 flex-1 rounded-lg text-sm font-bold text-gray-600 ring-1 ring-gray-300">
            Voltar
          </button>
          <button type="submit" disabled={busy || ((pedirSenha || pedirAutorizador) && !senha) || (pedirAutorizador && !email.trim()) || !motivoOk} className={`${btnPri} flex-1`}>
            {busy ? <Spinner size={15} className="animate-spin" /> : <CheckCircle size={15} weight="bold" />} Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}

// voltar a data de caixa (owner, admin ou financeiro) — encerrou para a data errada
function VoltarData({ sit, busy, onConfirmar, onCancelar }) {
  const minima = sit.voltarDataMinima || '';
  const maxima = maisDias(sit.dataCaixa, -1);
  const sugerida = (() => {
    let d = sit.hoje < sit.dataCaixa ? sit.hoje : maxima;
    if (minima && d < minima) d = minima;
    return d;
  })();
  const [data, setData] = useState(sugerida);
  const [motivo, setMotivo] = useState('');
  const [senha, setSenha] = useState('');
  const bloqueio = sit.caixa
    ? `Feche o caixa #${sit.caixa.caixa.id} antes de voltar a data.`
    : minima && minima >= sit.dataCaixa
      ? `Já tem caixa em ${fmtData(minima)}: a data de caixa não pode voltar para antes dele.`
      : null;
  const dataOk = data && data < sit.dataCaixa && (!minima || data >= minima);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirmar({ novaData: data, motivo: motivo.trim(), senha });
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <h3 className="text-lg font-bold text-[#000638]">Voltar a data de caixa</h3>
        <p className="mt-1 text-sm text-gray-600">
          Empresa {sit.empresa.code} · data de caixa atual <b>{fmtData(sit.dataCaixa)}</b>. Use quando o dia foi encerrado para a data errada. Fica registrado quem voltou e o motivo.
        </p>
        {bloqueio ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
            <Warning size={14} weight="fill" className="mt-0.5 shrink-0" /> {bloqueio}
          </p>
        ) : (
          <>
            <div className="mt-3">
              <label className={labelCls}>Nova data de caixa</label>
              <input type="date" value={data} min={minima || undefined} max={maxima} onChange={(e) => setData(e.target.value)} className={inputCls} />
              {minima && <p className="mt-1 text-[10.5px] text-gray-400">Não dá para voltar antes de {fmtData(minima)} (último caixa da empresa).</p>}
            </div>
            <div className="mt-3">
              <label className={labelCls}>Motivo</label>
              <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: encerrado para a data errada" className={inputCls} />
            </div>
            <div className="mt-3">
              <label className={labelCls}>Sua senha do HeadCoach</label>
              <input type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
            </div>
          </>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancelar} disabled={busy} className="h-10 flex-1 rounded-lg text-sm font-bold text-gray-600 ring-1 ring-gray-300">
            Voltar
          </button>
          {!bloqueio && (
            <button type="submit" disabled={busy || !dataOk || motivo.trim().length < 3 || !senha} className={`${btnPri} flex-1`}>
              {busy ? <Spinner size={15} className="animate-spin" /> : <ArrowCounterClockwise size={15} weight="bold" />} VOLTAR DATA
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// comprovante do fechamento (imprime pelo navegador / app do PDV)
function imprimirComprovante(c) {
  const r = c.caixa?.resumo || {};
  const formas = Object.entries(r.formas || {});
  const linhas = (pares) => pares.map(([a, b]) => `<tr><td>${a}</td><td style="text-align:right">${b}</td></tr>`).join('');
  const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Fechamento de caixa #${c.caixa.id}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:16px;max-width:320px}h1{font-size:15px;margin:0 0 4px}h2{font-size:12px;margin:12px 0 4px;border-bottom:1px solid #000}table{width:100%;border-collapse:collapse}td{padding:2px 0}.f{font-weight:bold;border-top:1px dashed #000}</style></head><body>
<h1>FECHAMENTO DE CAIXA</h1>
<div>Empresa ${c.empresa?.code} — ${c.empresa?.nome || ''}</div>
<div>Caixa #${c.caixa.id} · Data de caixa ${fmtData(c.caixa.data_caixa)}</div>
<div>Aberto ${fmtDataHora(c.caixa.aberto_em)} por ${c.caixa.aberto_por || '—'}</div>
<div>Fechado ${fmtDataHora(c.caixa.fechado_em)} por ${c.caixa.fechado_por || '—'}</div>
<h2>Vendas (${r.vendas || 0})</h2><table>${linhas(formas.map(([f, v]) => [nomeForma(f), brl(v)]))}<tr class="f"><td>Total</td><td style="text-align:right">${brl(r.totalVendas)}</td></tr></table>
<h2>Dinheiro</h2><table>${linhas([
    ['Fundo inicial', brl(r.dinheiro?.fundo)],
    ['Vendas em dinheiro', brl(r.dinheiro?.vendas)],
    ['Suprimentos', brl(r.dinheiro?.suprimentos)],
    ['Retiradas', `- ${brl(r.dinheiro?.retiradas)}`],
    ['Esperado', brl(r.dinheiro?.esperado)],
    ['Contado', brl(r.contagem?.dinheiroContado)],
    ['Diferença', brl(r.contagem?.diferencaDinheiro)],
  ])}</table>
<h2>Fechamento</h2><table>${linhas([
    ['Diferença total', brl(c.caixa.diferenca)],
    ['Fundo para o próximo caixa', brl(r.fundoFinal)],
    ['Retirada do fechamento', brl(r.retiradaFechamento)],
  ])}</table>
<p style="margin-top:28px">_______________________________<br>Assinatura do operador</p>
</body></html>`;
  const w = window.open('', '_blank', 'width=420,height=700');
  if (!w) return alert('O navegador bloqueou a janela do comprovante. Libere pop-ups.');
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* a janela fica aberta para imprimir */
    }
  }, 400);
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function HcCaixa({ etapa = 'abertura' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState(null);
  const [empresa, setEmpresa] = useState(() => lerLocal('hc_caixa_empresa', ''));
  const [sit, setSit] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState(null); // { tipo, msg }
  const [busy, setBusy] = useState(false);
  const [confirmar, setConfirmar] = useState(null); // { titulo, texto, pedirMotivo, pedirSenha, pedirAutorizador, acao }
  const [voltandoData, setVoltandoData] = useState(false);

  const avisar = useCallback((tipo, msg) => {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 6000);
  }, []);

  useEffect(() => {
    apiJson(`${API}/empresas`)
      .then((j) => {
        const lista = j.data.empresas || [];
        setEmpresas(lista);
        setEmpresa((atual) => (lista.some((e) => String(e.code) === String(atual)) ? atual : lista.length === 1 ? String(lista[0].code) : atual));
      })
      .catch((e) => {
        setEmpresas([]);
        setErro(e.message);
      });
  }, []);
  useEffect(() => gravarLocal('hc_caixa_empresa', empresa), [empresa]);

  const carregar = useCallback(async () => {
    if (!empresa) return;
    setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/situacao?empresa=${encodeURIComponent(empresa)}`);
      setSit(j.data);
    } catch (e) {
      setSit(null);
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [empresa]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  // executa uma ação no servidor e recarrega
  const acao = async (fn, ok) => {
    setBusy(true);
    try {
      const j = await fn();
      avisar('ok', j?.message || ok);
      setConfirmar(null);
      await carregar();
      return j;
    } catch (e) {
      avisar('erro', e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const post = (path, body) => apiJson(`${API}${path}`, { method: 'POST', body });

  const caixa = sit?.caixa?.caixa || null;
  const r = sit?.caixa || null;
  const statusChip = !sit ? null : caixa ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
      <LockOpen size={12} weight="bold" /> CAIXA ABERTO · desde {fmtDataHora(caixa.aberto_em)} · {caixa.aberto_por}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200">
      <Lock size={12} weight="bold" /> SEM CAIXA ABERTO
    </span>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-6xl">
        <PageTitle title="Caixa" subtitle="Abertura, suprimento e retirada, contagem, fechamento e encerramento do dia — tudo no HeadCoach" icon={CashRegister} />

        {/* Empresa + data de caixa */}
        <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto]">
            <div>
              <label className={labelCls}>Empresa</label>
              <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inputCls}>
                <option value="">{empresas === null ? 'Carregando…' : 'Escolha a empresa'}</option>
                {(empresas || []).map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.code} — {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={carregar} disabled={!empresa || carregando} className={btnSec}>
              <ArrowsClockwise size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
          {sit && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ring-1 ${sit.dataAtrasada ? 'bg-amber-50 text-amber-800 ring-amber-300' : 'bg-indigo-50 text-[#000638] ring-indigo-200'}`}>
                <CalendarCheck size={12} weight="bold" /> DATA DE CAIXA {fmtData(sit.dataCaixa)}
                {sit.dataAtrasada ? ` · hoje é ${fmtData(sit.hoje)}` : ''}
              </span>
              {statusChip}
              {PERFIS_GESTAO.includes(user?.role) && (
                <button
                  onClick={() => setVoltandoData(true)}
                  disabled={busy}
                  title="Owner, admin ou financeiro: volta a data de caixa quando o dia foi encerrado para a data errada"
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-bold text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50"
                >
                  <ArrowCounterClockwise size={12} weight="bold" /> Voltar data
                </button>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
            {ETAPAS.map((x) => (
              <button
                key={x.k}
                onClick={() => navigate(x.href)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${etapa === x.k ? 'bg-[#000638] text-white' : 'text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50'}`}
              >
                <x.icon size={14} /> {x.label}
              </button>
            ))}
          </div>
        </div>

        {aviso && (
          <p className={`mb-3 rounded-xl px-3 py-2 text-sm ring-1 ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{aviso.msg}</p>
        )}
        {erro && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}

        {!empresa ? (
          <p className="rounded-xl bg-white px-3 py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">Escolha a empresa para ver o caixa.</p>
        ) : !sit ? (
          carregando && (
            <div className="py-16 text-center text-gray-400">
              <Spinner size={22} className="mx-auto animate-spin" />
            </div>
          )
        ) : etapa === 'abertura' ? (
          <Abertura sit={sit} r={r} caixa={caixa} busy={busy} acao={acao} post={post} setConfirmar={setConfirmar} navigate={navigate} />
        ) : etapa === 'contagem' ? (
          <Contagem sit={sit} r={r} caixa={caixa} busy={busy} acao={acao} post={post} navigate={navigate} setConfirmar={setConfirmar} user={user} />
        ) : (
          <Fechamento sit={sit} r={r} caixa={caixa} busy={busy} acao={acao} post={post} setConfirmar={setConfirmar} navigate={navigate} user={user} carregar={carregar} avisar={avisar} />
        )}
      </div>

      {confirmar && (
        <Confirmar
          titulo={confirmar.titulo}
          texto={confirmar.texto}
          pedirMotivo={confirmar.pedirMotivo}
          pedirSenha={confirmar.pedirSenha !== false}
          pedirAutorizador={confirmar.pedirAutorizador}
          emailPadrao={confirmar.emailPadrao}
          motivoOpcional={confirmar.motivoOpcional}
          busy={busy}
          onCancelar={() => setConfirmar(null)}
          onConfirmar={confirmar.acao}
        />
      )}
      {voltandoData && sit && (
        <VoltarData
          sit={sit}
          busy={busy}
          onCancelar={() => setVoltandoData(false)}
          onConfirmar={(b) =>
            acao(() => post('/voltar-data', { empresa: sit.empresa.code, ...b }), 'Data de caixa voltou').then((j) => {
              if (j) setVoltandoData(false);
            })
          }
        />
      )}
    </div>
  );
}

// ─── Resumo do caixa aberto (usado nas três etapas) ─────────────────────────
function ResumoCaixa({ r }) {
  const formas = Object.entries(r.formas || {});
  return (
    <Bloco titulo={`Caixa #${r.caixa.id} · data de caixa ${fmtData(r.caixa.data_caixa)}`} icone={CashRegister}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Linha rotulo="Vendas atendidas" valor={`${r.qtdVendas} · ${fmtBRL(r.totalVendas)}`} />
          {formas.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhuma venda neste caixa ainda.</p>
          ) : (
            formas.map(([f, v]) => <Linha key={f} rotulo={`· ${nomeForma(f)}`} valor={fmtBRL(v)} />)
          )}
          {r.pendentes.length > 0 && <p className="text-[11px] font-semibold text-amber-700">{r.pendentes.length} venda(s) com a nota ainda não autorizada</p>}
        </div>
        <div className="space-y-1">
          <Linha rotulo="Fundo de troco" valor={fmtBRL(r.dinheiro.fundo)} />
          <Linha rotulo="+ Vendas em dinheiro" valor={fmtBRL(r.dinheiro.vendas)} />
          <Linha rotulo="+ Suprimentos" valor={fmtBRL(r.dinheiro.suprimentos)} />
          <Linha rotulo="− Retiradas" valor={fmtBRL(r.dinheiro.retiradas)} />
          <Linha rotulo="Dinheiro que deve ter no caixa" valor={fmtBRL(r.dinheiro.esperado)} forte />
        </div>
      </div>
    </Bloco>
  );
}

function Movimentos({ r, caixa, busy, acao, post, setConfirmar }) {
  const [tipo, setTipo] = useState(null);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const lancar = () => {
    const corpo = { tipo, valor: num(valor), motivo };
    const enviar = (extra = {}) =>
      acao(() => post(`/${caixa.id}/movimentos`, { ...corpo, ...extra }), 'Lançado').then((j) => {
        if (j) {
          setTipo(null);
          setValor('');
          setMotivo('');
        }
      });
    if (tipo === 'retirada') {
      setConfirmar({ titulo: `Retirada de ${fmtBRL(num(valor))}`, texto: `Motivo: ${motivo}`, acao: ({ senha }) => enviar({ senha }) });
    } else enviar();
  };
  return (
    <Bloco
      titulo="Suprimento e retirada"
      icone={Coins}
      extra={
        !tipo && (
          <span className="flex gap-1.5">
            <button onClick={() => setTipo('suprimento')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700">
              <Plus size={12} weight="bold" /> Suprimento
            </button>
            <button onClick={() => setTipo('retirada')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2.5 text-[11px] font-bold text-white hover:bg-rose-700">
              <Minus size={12} weight="bold" /> Retirada
            </button>
          </span>
        )
      }
    >
      {tipo && (
        <div className={`mb-2 grid items-end gap-2 rounded-lg p-2 ring-1 sm:grid-cols-[140px_1fr_auto_auto] ${tipo === 'suprimento' ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
          <div>
            <label className={labelCls}>{tipo === 'suprimento' ? 'Valor que entra' : 'Valor que sai'}</label>
            <input autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Motivo</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === 'suprimento' ? 'ex.: troco trazido do cofre' : 'ex.: sangria para o cofre'} className={inputCls} />
          </div>
          <button onClick={() => setTipo(null)} className={btnSec}>
            Voltar
          </button>
          <button onClick={lancar} disabled={busy || !(num(valor) > 0) || motivo.trim().length < 3} className={`${btnPri} h-9`}>
            Lançar {tipo === 'retirada' && <Lock size={13} />}
          </button>
        </div>
      )}
      {r.movimentos.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum suprimento ou retirada neste caixa.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-xs">
          {r.movimentos.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-center gap-2 py-1.5 ${m.estornado_em ? 'text-gray-400 line-through' : ''}`}>
              <span className="w-32 shrink-0 tabular-nums text-gray-500">{fmtDataHora(m.em)}</span>
              <span className={`w-40 shrink-0 font-semibold ${MOV[m.tipo]?.cls}`}>{MOV[m.tipo]?.label}</span>
              <span className="min-w-0 flex-1 truncate">
                {m.motivo} · {m.por}
              </span>
              <span className={`font-bold tabular-nums ${MOV[m.tipo]?.cls}`}>
                {MOV[m.tipo]?.sinal} {fmtBRL(m.valor)}
              </span>
              {m.estornado_em ? (
                <span className="text-[10.5px] no-underline">estornado: {m.estorno_motivo}</span>
              ) : (
                m.tipo !== 'retirada_fechamento' && (
                  <button
                    onClick={() =>
                      setConfirmar({
                        titulo: `Estornar ${MOV[m.tipo]?.label.toLowerCase()} de ${fmtBRL(m.valor)}`,
                        texto: 'O lançamento continua no histórico, marcado como estornado.',
                        pedirMotivo: true,
                        acao: ({ motivo: mot, senha }) => acao(() => post(`/movimentos/${m.id}/estornar`, { motivo: mot, senha }), 'Estornado'),
                      })
                    }
                    className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-gray-500 hover:text-rose-600"
                  >
                    <ArrowCounterClockwise size={11} /> estornar
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </Bloco>
  );
}

// ─── ABERTURA ────────────────────────────────────────────────────────────────
function Abertura({ sit, r, caixa, busy, acao, post, setConfirmar, navigate }) {
  const [fundo, setFundo] = useState('');
  const [obs, setObs] = useState('');
  const [encerrarAnterior, setEncerrarAnterior] = useState(true);
  useEffect(() => {
    setFundo(sit.fundoSugerido != null ? String(sit.fundoSugerido).replace('.', ',') : '');
  }, [sit.fundoSugerido, sit.empresa.code]);

  if (caixa) {
    return (
      <div className="space-y-3">
        <ResumoCaixa r={r} />
        <Movimentos r={r} caixa={caixa} busy={busy} acao={acao} post={post} setConfirmar={setConfirmar} />
        <div className="flex justify-end">
          <button onClick={() => navigate('/headcoach/caixa/contagem')} className={btnPri}>
            <Coins size={15} /> Ir para a contagem
          </button>
        </div>
        <CaixasDaData sit={sit} />
      </div>
    );
  }
  const abrir = () =>
    acao(
      () => post('/abrir', { empresa: sit.empresa.code, fundoInicial: num(fundo), observacao: obs, encerrarAnterior: sit.dataAtrasada && encerrarAnterior }),
      'Caixa aberto',
    );
  return (
    <div className="space-y-3">
      <Bloco titulo="Abrir caixa" icone={LockOpen}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Data de caixa</label>
            <div className="flex h-9 items-center rounded-lg bg-gray-50 px-2.5 text-sm font-bold text-[#000638] ring-1 ring-gray-200">{fmtData(sit.dataAtrasada && encerrarAnterior ? sit.hoje : sit.dataCaixa)}</div>
          </div>
          <div>
            <label className={labelCls}>Fundo de troco (dinheiro no caixa)</label>
            <input inputMode="decimal" value={fundo} onChange={(e) => setFundo(e.target.value)} placeholder="0,00" className={inputCls} />
            <p className="mt-0.5 text-[10.5px] text-gray-500">{sit.fundoSugerido != null ? `O último caixa da empresa deixou ${fmtBRL(sit.fundoSugerido)}.` : 'Primeiro caixa da empresa.'}</p>
          </div>
          <div>
            <label className={labelCls}>Observação</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} className={inputCls} />
          </div>
        </div>
        {sit.fundoSugerido != null && Math.abs(num(fundo) - sit.fundoSugerido) > 0.005 && (
          <p className="mt-2 text-[11px] font-semibold text-amber-700">
            O fundo informado ({fmtBRL(num(fundo))}) é diferente do que ficou no caixa anterior ({fmtBRL(sit.fundoSugerido)}). Explique na observação.
          </p>
        )}
        {sit.dataAtrasada && (
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900 ring-1 ring-amber-300">
            <input type="checkbox" checked={encerrarAnterior} onChange={(e) => setEncerrarAnterior(e.target.checked)} className="mb-0 mt-0.5 !h-4 !w-4 accent-amber-600" />
            <span>
              <b>A data de caixa ainda é {fmtData(sit.dataCaixa)}</b> (o dia não foi encerrado). Encerrar {fmtData(sit.dataCaixa)} e abrir este caixa em {fmtData(sit.hoje)}. Só dá se todos os caixas
              de {fmtData(sit.dataCaixa)} estiverem fechados.
            </span>
          </label>
        )}
        <div className="mt-3 flex justify-end">
          <button onClick={abrir} disabled={busy || (sit.dataAtrasada && !encerrarAnterior)} className={btnPri}>
            {busy ? <Spinner size={15} className="animate-spin" /> : <LockOpen size={15} weight="bold" />} ABRIR CAIXA
          </button>
        </div>
      </Bloco>
      {sit.ultimoFechado && (
        <p className="text-center text-[11px] text-gray-500">
          Último caixa da empresa: #{sit.ultimoFechado.id} de {fmtData(sit.ultimoFechado.dataCaixa)}, fechado em {fmtDataHora(sit.ultimoFechado.fechadoEm)} por {sit.ultimoFechado.fechadoPor}
          {Math.abs(Number(sit.ultimoFechado.diferenca || 0)) > 0.005 ? ` · diferença ${fmtBRL(sit.ultimoFechado.diferenca)}` : ''}
        </p>
      )}
      <CaixasDaData sit={sit} />
    </div>
  );
}

function CaixasDaData({ sit }) {
  if (!sit.caixasDaData.length) return null;
  return (
    <Bloco titulo={`Caixas da empresa em ${fmtData(sit.dataCaixa)}`} icone={CalendarCheck}>
      <ul className="divide-y divide-gray-100 text-xs">
        {sit.caixasDaData.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5">
            <span className="w-20 font-bold text-[#000638]">Caixa #{c.id}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ${c.status === 'aberto' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-gray-200'}`}>{c.status.toUpperCase()}</span>
            <span className="min-w-0 flex-1 text-gray-600">
              aberto {fmtDataHora(c.aberto_em)} por {c.aberto_por}
              {c.fechado_em ? ` · fechado ${fmtDataHora(c.fechado_em)} por ${c.fechado_por}` : ''}
            </span>
            {c.status === 'fechado' && <Diferenca v={c.diferenca} />}
          </li>
        ))}
      </ul>
    </Bloco>
  );
}

// ─── CONTAGEM ────────────────────────────────────────────────────────────────
function Contagem({ sit, r, caixa, busy, acao, post, navigate, setConfirmar, user }) {
  // dinheiro: só o valor total que tem no caixa (sem detalhar cédulas e moedas)
  const [dinheiro, setDinheiro] = useState('');
  const [informado, setInformado] = useState({});
  const [obs, setObs] = useState('');
  const u = r?.ultimaContagem || null;
  // contagem salva fica travada (cadeado) até owner/admin/financeiro reabrir
  const travada = !!r?.contagemTravada;
  // começa da última contagem (se houver); travada mostra exatamente o que foi salvo
  useEffect(() => {
    setDinheiro(u ? String(round2(u.dinheiro_contado)).replace('.', ',') : '');
    setInformado(travada && u ? Object.fromEntries(Object.entries(u.formas || {}).map(([f, x]) => [f, String(round2(x.informado)).replace('.', ',')])) : {});
    setObs(travada && u ? u.observacao || '' : '');
  }, [caixa?.id, u?.id, travada]); // eslint-disable-line react-hooks/exhaustive-deps

  const formas = useMemo(() => {
    const s = new Set([...FORMAS_PADRAO, ...Object.keys(r?.formas || {}).filter((f) => f !== 'dinheiro')]);
    return [...s];
  }, [r?.formas]);
  if (!caixa) {
    return (
      <p className="rounded-xl bg-white px-3 py-10 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200">
        A empresa não tem caixa aberto.{' '}
        <button onClick={() => navigate('/headcoach/caixa/abertura')} className="font-bold text-[#000638] underline">
          Abrir caixa
        </button>
      </p>
    );
  }
  const contado = round2(num(dinheiro));
  const semValor = String(dinheiro).trim() === '';
  const difDinheiro = round2(contado - r.dinheiro.esperado);
  const valorInformado = (f) => (informado[f] === undefined || informado[f] === '' ? round2(r.formas[f] || 0) : num(informado[f]));
  const difOutras = round2(formas.reduce((s, f) => s + (valorInformado(f) - round2(r.formas[f] || 0)), 0));
  const reabrir = () =>
    setConfirmar({
      titulo: 'Reabrir a contagem',
      texto: 'Só owner, admin ou financeiro reabre a contagem. Fica registrado quem autorizou.',
      pedirAutorizador: true,
      emailPadrao: PERFIS_GESTAO.includes(user?.role) ? user?.email || '' : '',
      pedirMotivo: true,
      motivoOpcional: true,
      acao: ({ email, senha, motivo }) => acao(() => post(`/${caixa.id}/contagem/reabrir`, { autorizador: { email, senha }, motivo }), 'Contagem reaberta'),
    });
  const salvar = () =>
    acao(
      () =>
        post(`/${caixa.id}/contagem`, {
          dinheiroContado: contado,
          formas: Object.fromEntries(formas.map((f) => [f, valorInformado(f)])),
          observacao: obs,
        }),
      'Contagem salva',
    );
  return (
    <div className="space-y-3">
      {r.contagemDesatualizada && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
          <Warning size={14} weight="fill" /> Houve venda ou movimento depois da última contagem: conte de novo.
        </p>
      )}
      {travada && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-indigo-50 px-3 py-2.5 ring-1 ring-indigo-200">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#000638] text-white">
            <Lock size={18} weight="fill" />
          </span>
          <div className="min-w-0 flex-1 text-xs text-[#000638]">
            <b className="block text-sm">CONTAGEM FINALIZADA</b>
            por {u.por} em {fmtDataHora(u.em)} · para contar de novo, owner, admin ou financeiro reabre com a senha
          </div>
          <button onClick={reabrir} disabled={busy} className={btnPri}>
            <LockOpen size={15} weight="bold" /> REABRIR CONTAGEM
          </button>
        </div>
      )}
      {r.contagemReaberta && !r.contagemDesatualizada && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
          <LockOpen size={14} weight="fill" /> Contagem reaberta{u?.reabertura_autorizada_por ? ` (autorizou ${u.reabertura_autorizada_por})` : ''}: conte de novo e salve.
        </p>
      )}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Bloco titulo="Dinheiro" icone={Coins}>
          <label className={labelCls}>Quanto tem em dinheiro no caixa</label>
          <input
            autoFocus={!travada}
            disabled={travada}
            inputMode="decimal"
            value={dinheiro}
            onChange={(e) => setDinheiro(e.target.value)}
            placeholder="0,00"
            className="mb-0 h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-xl font-bold tabular-nums text-[#000638] focus:outline-none focus:ring-2 focus:ring-[#000638]/30 disabled:bg-gray-50 disabled:text-gray-600"
          />
          <div className="mt-3 space-y-1 border-t border-gray-100 pt-2">
            <Linha rotulo="Fundo de troco" valor={fmtBRL(r.dinheiro.fundo)} />
            <Linha rotulo="+ Vendas em dinheiro" valor={fmtBRL(r.dinheiro.vendas)} />
            <Linha rotulo="+ Suprimentos" valor={fmtBRL(r.dinheiro.suprimentos)} />
            <Linha rotulo="− Retiradas" valor={fmtBRL(r.dinheiro.retiradas)} />
            <Linha rotulo="Deve ter na gaveta" valor={fmtBRL(r.dinheiro.esperado)} forte />
            <Linha rotulo="Contado" valor={fmtBRL(contado)} />
            <p className="flex justify-between text-sm">
              <span className="font-bold text-[#000638]">Diferença do dinheiro</span>
              <Diferenca v={difDinheiro} />
            </p>
          </div>
        </Bloco>

        <Bloco titulo="Outras formas de pagamento" icone={CashRegister}>
          <p className="mb-2 text-[11px] text-gray-500">Confira com os comprovantes da maquininha e o extrato do Pix. Se bater, deixe como está.</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                <th className="pb-1 font-semibold">Forma</th>
                <th className="pb-1 text-right font-semibold">Sistema</th>
                <th className="pb-1 pl-2 text-right font-semibold">Conferido</th>
                <th className="pb-1 pl-2 text-right font-semibold">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {formas.map((f) => (
                <tr key={f}>
                  <td className="py-1.5 font-semibold text-gray-800">{nomeForma(f)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtBRL(r.formas[f] || 0)}</td>
                  <td className="py-1.5 pl-2 text-right">
                    <input
                      inputMode="decimal"
                      disabled={travada}
                      value={informado[f] ?? String(round2(r.formas[f] || 0)).replace('.', ',')}
                      onChange={(e) => setInformado((x) => ({ ...x, [f]: e.target.value }))}
                      className="mb-0 h-8 w-28 rounded-lg border border-gray-300 px-1.5 text-right text-sm disabled:bg-gray-50 disabled:text-gray-600"
                    />
                  </td>
                  <td className="py-1.5 pl-2 text-right text-[11px]">
                    <Diferenca v={valorInformado(f) - round2(r.formas[f] || 0)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 border-t border-gray-100 pt-2">
            <p className="flex justify-between text-sm">
              <span className="font-bold text-[#000638]">Diferença total do caixa</span>
              <Diferenca v={difDinheiro + difOutras} />
            </p>
          </div>
          <div className="mt-3">
            <label className={labelCls}>Observação da contagem</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} disabled={travada} placeholder={travada ? '' : 'explique qualquer diferença'} className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-600`} />
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {!travada && (
              <button onClick={salvar} disabled={busy || semValor} className={btnPri}>
                {busy ? <Spinner size={15} className="animate-spin" /> : <CheckCircle size={15} weight="bold" />} SALVAR CONTAGEM
              </button>
            )}
            {travada && (
              <button onClick={() => navigate('/headcoach/caixa/fechamento')} className={`${btnSec} h-10`}>
                <Lock size={14} /> Ir para o fechamento
              </button>
            )}
          </div>
        </Bloco>
      </div>
      {r.contagens.length > 0 && (
        <Bloco titulo="Contagens deste caixa" icone={Info}>
          <ul className="divide-y divide-gray-100 text-xs">
            {r.contagens.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="w-32 tabular-nums text-gray-500">{fmtDataHora(c.em)}</span>
                <span className="min-w-0 flex-1">
                  {c.por} · dinheiro {fmtBRL(c.dinheiro_contado)} de {fmtBRL(c.dinheiro_esperado)}
                  {c.observacao ? ` · ${c.observacao}` : ''}
                  {i === 0 ? <b className="ml-1 text-[#000638]">(vale esta)</b> : ''}
                </span>
                <Diferenca v={c.diferenca_total} />
              </li>
            ))}
          </ul>
        </Bloco>
      )}
    </div>
  );
}

// ─── FECHAMENTO + ENCERRAMENTO ───────────────────────────────────────────────
function Fechamento({ sit, r, caixa, busy, acao, post, setConfirmar, navigate, user, carregar, avisar }) {
  const u = r?.ultimaContagem || null;
  const contado = round2(u?.dinheiro_contado || 0);
  const [fundoFinal, setFundoFinal] = useState('');
  const [destino, setDestino] = useState('Cofre');
  const [obs, setObs] = useState('');
  useEffect(() => {
    const padrao = Math.min(round2(r?.dinheiro?.fundo || 0), contado);
    setFundoFinal(String(padrao).replace('.', ','));
  }, [caixa?.id, u?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const retiradaFinal = round2(contado - num(fundoFinal));

  const fechar = () =>
    setConfirmar({
      titulo: `Fechar o caixa #${caixa.id}`,
      texto: `Fica ${fmtBRL(num(fundoFinal))} de fundo e sai ${fmtBRL(retiradaFinal)} (${destino}). Depois de fechado, só owner ou admin reabre.`,
      acao: ({ senha }) =>
        acao(() => post(`/${caixa.id}/fechar`, { fundoFinal: num(fundoFinal), destinoRetirada: destino, observacao: obs, senha }), 'Caixa fechado').then(async (j) => {
          if (j?.data?.id) {
            try {
              const d = await apiJson(`${API}/${j.data.id}`);
              imprimirComprovante(d.data);
            } catch {
              /* o comprovante pode ser impresso depois */
            }
          }
        }),
    });

  return (
    <div className="space-y-3">
      {caixa ? (
        <>
          <ResumoCaixa r={r} />
          <Bloco titulo="Fechar caixa" icone={Lock}>
            {!u ? (
              <p className="flex flex-wrap items-center gap-2 text-sm text-amber-800">
                <Warning size={15} weight="fill" /> Faça a contagem antes de fechar.
                <button onClick={() => navigate('/headcoach/caixa/contagem')} className={btnSec}>
                  <Coins size={14} /> Ir para a contagem
                </button>
              </p>
            ) : r.contagemDesatualizada ? (
              <p className="flex flex-wrap items-center gap-2 text-sm text-amber-800">
                <Warning size={15} weight="fill" /> Houve venda ou movimento depois da contagem de {fmtDataHora(u.em)}: conte de novo.
                <button onClick={() => navigate('/headcoach/caixa/contagem')} className={btnSec}>
                  <Coins size={14} /> Contar de novo
                </button>
              </p>
            ) : r.contagemReaberta ? (
              <p className="flex flex-wrap items-center gap-2 text-sm text-amber-800">
                <LockOpen size={15} weight="fill" /> A contagem foi reaberta{u.reabertura_autorizada_por ? ` (autorizou ${u.reabertura_autorizada_por})` : ''}: conte de novo e salve antes de fechar.
                <button onClick={() => navigate('/headcoach/caixa/contagem')} className={btnSec}>
                  <Coins size={14} /> Ir para a contagem
                </button>
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Contagem de {fmtDataHora(u.em)} · {u.por}</p>
                    <Linha rotulo="Dinheiro contado" valor={fmtBRL(contado)} />
                    <p className="flex justify-between text-xs">
                      <span className="text-gray-500">Diferença do dinheiro</span>
                      <Diferenca v={u.diferenca_dinheiro} />
                    </p>
                    {Object.entries(u.formas || {}).map(([f, x]) => (
                      <p key={f} className="flex justify-between text-xs">
                        <span className="text-gray-500">{nomeForma(f)}</span>
                        <span>
                          {fmtBRL(x.informado)} <Diferenca v={x.diferenca} />
                        </span>
                      </p>
                    ))}
                    <p className="flex justify-between border-t border-gray-200 pt-1 text-sm">
                      <span className="font-bold text-[#000638]">Diferença total</span>
                      <Diferenca v={u.diferenca_total} />
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls}>Fundo que fica no caixa (troco do próximo)</label>
                      <input inputMode="decimal" value={fundoFinal} onChange={(e) => setFundoFinal(e.target.value)} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-[1fr_1fr] gap-2">
                      <div>
                        <label className={labelCls}>Sai do caixa</label>
                        <div className={`flex h-9 items-center rounded-lg px-2.5 text-sm font-bold ring-1 ${retiradaFinal < 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-gray-50 text-[#000638] ring-gray-200'}`}>{fmtBRL(retiradaFinal)}</div>
                      </div>
                      <div>
                        <label className={labelCls}>Para onde</label>
                        <input value={destino} onChange={(e) => setDestino(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Observação do fechamento</label>
                      <input value={obs} onChange={(e) => setObs(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>
                {r.pendentes.length > 0 && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 ring-1 ring-amber-200">
                    {r.pendentes.length} venda(s) deste caixa com a nota ainda não autorizada (não entram nos totais): {r.pendentes.map((p) => `nº ${p.id} ${fmtBRL(p.total)}`).join(' · ')}
                  </p>
                )}
                <div className="mt-3 flex justify-end">
                  <button onClick={fechar} disabled={busy || retiradaFinal < -0.005} className={btnPri}>
                    <Lock size={15} weight="bold" /> FECHAR CAIXA
                  </button>
                </div>
              </>
            )}
          </Bloco>
        </>
      ) : (
        <UltimoFechado sit={sit} user={user} busy={busy} acao={acao} post={post} setConfirmar={setConfirmar} avisar={avisar} />
      )}
      <Encerramento sit={sit} busy={busy} acao={acao} post={post} carregar={carregar} />
    </div>
  );
}

function UltimoFechado({ sit, user, busy, acao, post, setConfirmar, avisar }) {
  const u = sit.ultimoFechado;
  if (!u) return <p className="rounded-xl bg-white px-3 py-8 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">A empresa ainda não teve caixa aberto.</p>;
  const podeReabrir = ['owner', 'admin'].includes(user?.role) && String(u.dataCaixa).slice(0, 10) >= sit.dataCaixa;
  const imprimir = async () => {
    try {
      const d = await apiJson(`${API}/${u.id}`);
      imprimirComprovante(d.data);
    } catch (e) {
      avisar('erro', e.message);
    }
  };
  return (
    <Bloco titulo={`Último caixa fechado · #${u.id}`} icone={Lock}>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span>
          Data de caixa <b>{fmtData(u.dataCaixa)}</b> · fechado em {fmtDataHora(u.fechadoEm)} por {u.fechadoPor} · fundo deixado {fmtBRL(u.fundoFinal)}
        </span>
        <Diferenca v={u.diferenca} />
        <span className="flex-1" />
        <button onClick={imprimir} className={btnSec}>
          <Printer size={14} /> Comprovante
        </button>
        {podeReabrir && (
          <button
            onClick={() =>
              setConfirmar({
                titulo: `Reabrir o caixa #${u.id}`,
                texto: 'A retirada do fechamento é estornada e o caixa volta a aceitar movimentos. Fica registrado quem reabriu e o motivo.',
                pedirMotivo: true,
                acao: ({ motivo, senha }) => acao(() => post(`/${u.id}/reabrir`, { motivo, senha }), 'Caixa reaberto'),
              })
            }
            disabled={busy}
            className={btnSec}
          >
            <ArrowCounterClockwise size={14} /> Reabrir
          </button>
        )}
      </div>
    </Bloco>
  );
}

function Encerramento({ sit, busy, acao, post, carregar }) {
  const [v, setV] = useState(null);
  const [erro, setErro] = useState('');
  const [proxima, setProxima] = useState('');
  const [autEmail, setAutEmail] = useState('');
  const [autSenha, setAutSenha] = useState('');
  const verificar = useCallback(async () => {
    setErro('');
    try {
      const j = await apiJson(`${API}/encerramento?empresa=${sit.empresa.code}`);
      setV(j.data);
      setProxima(j.data.proximaSugerida);
    } catch (e) {
      setErro(e.message);
    }
  }, [sit.empresa.code]);
  useEffect(() => {
    verificar();
  }, [verificar, sit.dataCaixa, sit.caixasDaData.length, sit.caixa?.caixa?.status]);
  if (erro) return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>;
  if (!v) return null;
  const limiteLivre = v.dataCaixa < v.hoje ? v.hoje : maisDias(v.dataCaixa, 1);
  const pedeAut = proxima > limiteLivre;
  const encerrar = () =>
    acao(() => post('/encerrar', { empresa: v.empresa.code, proximaData: proxima, ...(pedeAut ? { autorizador: { email: autEmail, senha: autSenha } } : {}) }), 'Dia encerrado').then((j) => {
      if (j) {
        setAutSenha('');
        verificar();
        carregar();
      }
    });
  return (
    <Bloco titulo={`Encerramento do dia · empresa ${v.empresa.code}`} icone={CalendarCheck}>
      <div className="grid gap-3 sm:grid-cols-[1fr_260px]">
        <div className="space-y-1 text-xs">
          <p>
            Data de caixa atual: <b className="text-[#000638]">{fmtData(v.dataCaixa)}</b> · hoje {fmtData(v.hoje)}
          </p>
          <p>{v.caixas.length ? `${v.caixas.length} caixa(s) nesta data: ${v.caixas.map((c) => `#${c.id} ${c.status}`).join(' · ')}` : 'Nenhum caixa aberto nesta data.'}</p>
          {v.caixasAbertos.length > 0 && (
            <p className="flex items-center gap-1 font-semibold text-rose-700">
              <Warning size={13} weight="fill" /> {v.motivo}
            </p>
          )}
          {v.vendasPendentes.length > 0 && <p className="font-semibold text-amber-700">{v.vendasPendentes.length} venda(s) do dia com a nota ainda não autorizada.</p>}
          {v.comDiferenca.length > 0 && <p className="font-semibold text-amber-700">{v.comDiferenca.length} caixa(s) fechados com diferença.</p>}
          {v.podeEncerrar && v.vendasPendentes.length === 0 && <p className="flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle size={13} weight="fill" /> Tudo certo para encerrar.</p>}
          {sit.encerramentos.length > 0 && (
            <p className="pt-1 text-[10.5px] text-gray-400">
              Últimos: {sit.encerramentos.map((e) => `${fmtData(e.data_caixa)} → ${fmtData(e.proxima_data)}${String(e.proxima_data) < String(e.data_caixa) ? ' (voltou)' : ''} (${e.por})`).join(' · ')}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <label className={labelCls}>Nova data de caixa</label>
            <input type="date" value={proxima} min={maisDias(v.dataCaixa, 1)} onChange={(e) => setProxima(e.target.value)} className={inputCls} />
          </div>
          {pedeAut && (
            <div className="space-y-1.5 rounded-lg bg-amber-50 p-2 ring-1 ring-amber-300">
              <p className="text-[10.5px] font-semibold text-amber-900">Avançar para depois de {fmtData(limiteLivre)} pede owner, admin ou financeiro.</p>
              <input value={autEmail} onChange={(e) => setAutEmail(e.target.value)} placeholder="e-mail de quem autoriza" className={inputCls} />
              <input type="password" autoComplete="off" value={autSenha} onChange={(e) => setAutSenha(e.target.value)} placeholder="senha" className={inputCls} />
            </div>
          )}
          <button onClick={encerrar} disabled={busy || !v.podeEncerrar || !proxima || (pedeAut && (!autEmail || !autSenha))} className={`${btnPri} w-full`}>
            <CalendarCheck size={15} weight="bold" /> ENCERRAR {fmtData(v.dataCaixa)}
          </button>
        </div>
      </div>
    </Bloco>
  );
}
