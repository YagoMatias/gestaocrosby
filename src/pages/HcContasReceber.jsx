// ============================================================================
// HEADCOACH › CONTAS A RECEBER (Yago, 12/11/2026) — títulos próprios do
// HeadCoach, sem o TOTVS. Toda venda com nota autorizada (PDV Crosby e
// Faturamento) vira títulos: fatura = 9.000.000.000 + nº da transação.
//   • Títulos: consulta com os filtros do TOTVS, detalhe e BAIXA do que está em
//     aberto (boleto/fatura) com juros, multa e desconto — sem estorno.
//   • Conciliação D+1: cartão e Pix nascem pagos com liquidação D+1; no dia da
//     liquidação, informa o que caiu e a diferença vira a taxa real.
//   • Configuração: juros, multa, taxas da maquininha e dias de liquidação.
// API: /api/hc/contas-receber (exige login) — services/hcContasReceber.js
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HandCoins,
  MagnifyingGlass,
  Spinner,
  X,
  CheckCircle,
  Warning,
  ArrowsClockwise,
  Link as LinkIcon,
  Gear,
  ListBullets,
  Receipt,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';

const API = '/api/hc/contas-receber';
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const hojeIso = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife' }).format(new Date());
const inicioMes = () => `${hojeIso().slice(0, 8)}01`;
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
const inputCls = 'mb-0 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const labelCls = 'mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500';
const btnPri = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#000638] px-4 text-sm font-bold text-white hover:bg-[#000638]/90 disabled:opacity-40';
const btnSec = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40';
const PERFIS_FINANCEIRO = ['owner', 'admin', 'user'];

const FORMAS = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  boleto: 'Boleto / fatura',
  credito_loja: 'Credev',
  adiantamento: 'Adiantamento',
  saldo_bonus: 'Saldo bônus',
};
const FORMAS_RECEBIMENTO = ['Pix', 'Boleto', 'Transferência / TED', 'Dinheiro', 'Cartão', 'Outro'];
const CAMPOS_DATA = [
  { k: 'emissao', label: 'Emissão' },
  { k: 'vencimento', label: 'Vencimento' },
  { k: 'pagamento', label: 'Pagamento' },
  { k: 'liquidacao', label: 'Liquidação' },
];
const ABAS = [
  { k: 'titulos', label: 'Títulos', icon: ListBullets },
  { k: 'conciliacao', label: 'Conciliação D+1', icon: LinkIcon },
  { k: 'config', label: 'Configuração', icon: Gear },
];

// juros e multa de um título em aberto (mesma conta do servidor)
function atualizado(t, cfg, ate = hojeIso()) {
  const valor = round2(t.valor);
  if (t.situacao !== 'aberto' || !cfg || String(t.vencimento) >= ate) return { diasAtraso: 0, juros: 0, multa: 0, total: valor };
  const dias = diasEntre(String(t.vencimento).slice(0, 10), ate);
  const multa = round2((valor * cfg.multa_pct) / 100);
  const juros = round2((((valor * cfg.juros_mes_pct) / 100) / 30) * dias);
  return { diasAtraso: dias, juros, multa, total: round2(valor + juros + multa) };
}

function Situacao({ t }) {
  if (t.situacao === 'cancelado') return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">CANCELADO</span>;
  if (t.situacao === 'pago')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
        PAGO
        {t.precisa_conciliar && (t.conciliado_em ? <LinkIcon size={10} weight="bold" title="Conciliado" /> : <span title="A conciliar" className="h-1.5 w-1.5 rounded-full bg-amber-500" />)}
      </span>
    );
  const dias = t.atualizado?.diasAtraso || 0;
  return dias > 0 ? (
    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">VENCIDO {dias}d</span>
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

function Campo({ rotulo, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className="truncate text-xs font-semibold text-gray-800">{children ?? '—'}</p>
    </div>
  );
}

export default function HcContasReceber() {
  const { user } = useAuth();
  const podeFinanceiro = PERFIS_FINANCEIRO.includes(user?.role);
  const [aba, setAba] = useState('titulos');
  const [empresas, setEmpresas] = useState([]);
  const [aviso, setAviso] = useState(null);
  const avisar = useCallback((tipo, msg) => {
    setAviso({ tipo, msg });
    setTimeout(() => setAviso(null), 6000);
  }, []);
  useEffect(() => {
    apiJson(`${API}/empresas`)
      .then((j) => setEmpresas(j.data.empresas || []))
      .catch((e) => avisar('erro', e.message));
  }, [avisar]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-3 lg:p-4">
      <div className="mx-auto max-w-7xl">
        <PageTitle title="Contas a Receber" subtitle="Títulos do HeadCoach (fatura 9.000.000.000 + nº da transação) — baixa com juros e multa e conciliação D+1, sem o TOTVS" icon={HandCoins} />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ABAS.map((x) => (
            <button
              key={x.k}
              onClick={() => setAba(x.k)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${aba === x.k ? 'bg-[#000638] text-white' : 'bg-white text-[#000638] ring-1 ring-gray-300 hover:bg-gray-50'}`}
            >
              <x.icon size={14} /> {x.label}
            </button>
          ))}
        </div>
        {aviso && (
          <p className={`mb-3 rounded-xl px-3 py-2 text-sm ring-1 ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{aviso.msg}</p>
        )}
        {aba === 'titulos' && <Titulos empresas={empresas} podeFinanceiro={podeFinanceiro} avisar={avisar} />}
        {aba === 'conciliacao' && <Conciliacao empresas={empresas} podeFinanceiro={podeFinanceiro} avisar={avisar} />}
        {aba === 'config' && <Configuracao podeFinanceiro={podeFinanceiro} admin={['owner', 'admin'].includes(user?.role)} avisar={avisar} />}
      </div>
    </div>
  );
}

// ─── TÍTULOS ─────────────────────────────────────────────────────────────────
function Titulos({ empresas, podeFinanceiro, avisar }) {
  const [f, setF] = useState({ empresa: '', campoData: 'emissao', de: inicioMes(), ate: hojeIso(), situacao: '', forma: '', cliente: '', fatura: '', conciliacao: '' });
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(null); // id do título no detalhe
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

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
    buscar(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tot = dados?.totais || {};
  const nomeEmpresa = useMemo(() => Object.fromEntries((empresas || []).map((e) => [e.code, e.nome])), [empresas]);
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
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
            <option value="vencido">Vencidos</option>
            <option value="pago">Pagos</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Forma</label>
          <select value={f.forma} onChange={set('forma')} className={inputCls}>
            <option value="">Todas</option>
            {Object.entries(FORMAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Conciliação</label>
          <select value={f.conciliacao} onChange={set('conciliacao')} className={inputCls}>
            <option value="">Todas</option>
            <option value="pendente">A conciliar</option>
            <option value="conciliado">Conciliados</option>
          </select>
        </div>
        <div className="col-span-2 lg:col-span-3">
          <label className={labelCls}>Cliente (código, nome ou CPF/CNPJ)</label>
          <input value={f.cliente} onChange={set('cliente')} className={inputCls} />
        </div>
        <div className="col-span-1 lg:col-span-2">
          <label className={labelCls}>Fatura ou nº da transação</label>
          <input value={f.fatura} onChange={set('fatura')} inputMode="numeric" className={inputCls} />
        </div>
        <div className="col-span-1 flex items-end lg:col-span-3">
          <button type="submit" disabled={carregando} className={`${btnPri} w-full`}>
            {carregando ? <Spinner size={15} className="animate-spin" /> : <MagnifyingGlass size={15} weight="bold" />} BUSCAR
          </button>
        </div>
      </form>

      {erro && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}

      {dados && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Card rotulo="Em aberto" valor={fmtBRL(tot.aberto)} sub={tot.abertoAtualizado > tot.aberto ? `atualizado ${fmtBRL(tot.abertoAtualizado)}` : null} cls="text-sky-700" />
            <Card rotulo="Vencido" valor={fmtBRL(tot.vencido)} cls={tot.vencido > 0 ? 'text-rose-700' : 'text-[#000638]'} />
            <Card rotulo="Recebido" valor={fmtBRL(tot.recebido)} cls="text-emerald-700" />
            <Card rotulo="Taxas" valor={fmtBRL(tot.taxa)} />
            <Card rotulo="Líquido recebido" valor={fmtBRL(tot.liquido)} />
            <Card rotulo="A conciliar" valor={fmtBRL(tot.aConciliar)} cls={tot.aConciliar > 0 ? 'text-amber-700' : 'text-[#000638]'} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[1100px] text-xs">
              <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2">Fatura / parc.</th>
                  <th className="px-2 py-2">Empresa</th>
                  <th className="px-2 py-2">Cliente</th>
                  <th className="px-2 py-2">Forma</th>
                  <th className="px-2 py-2">Emissão</th>
                  <th className="px-2 py-2">Vencimento</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2 text-right">Juros + multa</th>
                  <th className="px-2 py-2 text-right">Taxa</th>
                  <th className="px-2 py-2 text-right">Recebido</th>
                  <th className="px-2 py-2">Pagamento</th>
                  <th className="px-2 py-2">Liquidação</th>
                  <th className="px-2 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dados.titulos.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-2 py-10 text-center text-gray-400">
                      Nenhum título com esses filtros.
                    </td>
                  </tr>
                )}
                {dados.titulos.map((t) => {
                  const jm = t.situacao === 'aberto' ? round2(t.atualizado.juros + t.atualizado.multa) : round2(Number(t.juros) + Number(t.multa));
                  return (
                    <tr key={t.id} onClick={() => setAberto(t.id)} className={`cursor-pointer hover:bg-indigo-50/50 ${t.situacao === 'cancelado' ? 'text-gray-400 line-through' : ''}`}>
                      <td className="px-2 py-1.5 font-semibold tabular-nums text-[#000638]">
                        {t.fatura}/{t.parcela}
                      </td>
                      <td className="px-2 py-1.5" title={nomeEmpresa[t.empresa]}>
                        {t.empresa}
                      </td>
                      <td className="max-w-[220px] truncate px-2 py-1.5" title={t.cliente_nome || ''}>
                        {t.cliente_code ? `${t.cliente_code} · ` : ''}
                        {t.cliente_nome || 'Consumidor'}
                      </td>
                      <td className="px-2 py-1.5">
                        {FORMAS[t.forma] || t.forma}
                        {t.parcelas_cartao > 1 ? ` ${t.parcelas_cartao}x` : ''}
                        {t.portador && !['PIX', 'CARTEIRA'].includes(t.portador) ? <span className="text-gray-400"> · {t.portador}</span> : ''}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtData(t.emissao)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtData(t.vencimento)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtBRL(t.valor)}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${jm > 0 ? 'text-rose-700' : 'text-gray-400'}`}>{jm > 0 ? fmtBRL(jm) : '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{Number(t.taxa_valor) > 0 ? fmtBRL(t.taxa_valor) : '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t.situacao === 'pago' ? fmtBRL(t.valor_pago) : '—'}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtData(t.data_pagamento)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{fmtData(t.data_liquidacao)}</td>
                      <td className="px-2 py-1.5">
                        <Situacao t={t} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {dados.titulos.length > 0 && (
                <tfoot className="bg-gray-50 text-xs font-bold">
                  <tr>
                    <td className="px-2 py-2" colSpan={6}>
                      {tot.qtd} título(s)
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(tot.valor)}</td>
                    <td colSpan={2} />
                    <td className="px-2 py-2 text-right tabular-nums">{fmtBRL(tot.recebido)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
      {aberto && (
        <DetalheTitulo
          id={aberto}
          podeFinanceiro={podeFinanceiro}
          onFechar={() => setAberto(null)}
          onBaixado={(msg) => {
            avisar('ok', msg);
            buscar(f);
          }}
        />
      )}
    </div>
  );
}

function DetalheTitulo({ id, podeFinanceiro, onFechar, onBaixado }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [baixa, setBaixa] = useState(null); // formulário
  const [busy, setBusy] = useState(false);
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
  const abrirBaixa = () => {
    const a = atualizado(t, d.config, hojeIso());
    setBaixa({ data: hojeIso(), juros: String(a.juros).replace('.', ','), multa: String(a.multa).replace('.', ','), desconto: '', forma: 'Pix', conta: '', obs: '', senha: '' });
  };
  // mudou a data do pagamento: recalcula juros e multa
  const mudarData = (data) => {
    const a = atualizado(t, d.config, data || hojeIso());
    setBaixa((b) => ({ ...b, data, juros: String(a.juros).replace('.', ','), multa: String(a.multa).replace('.', ',') }));
  };
  const recebido = baixa ? round2(Number(t.valor) + num(baixa.juros) + num(baixa.multa) - num(baixa.desconto)) : 0;
  const confirmarBaixa = async () => {
    setBusy(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/titulos/${t.id}/baixar`, {
        method: 'POST',
        body: { dataPagamento: baixa.data, juros: num(baixa.juros), multa: num(baixa.multa), desconto: num(baixa.desconto), formaRecebimento: baixa.forma, conta: baixa.conta, observacao: baixa.obs, senha: baixa.senha },
      });
      setBaixa(null);
      await carregar();
      onBaixado(j.message || 'Título baixado');
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
            <h3 className="text-lg font-bold text-[#000638]">{t ? `Fatura ${t.fatura} · parcela ${t.parcela}` : 'Título'}</h3>
            {t && (
              <p className="text-xs text-gray-500">
                Transação nº {t.venda_id} · empresa {t.empresa} · {t.origem === 'expedicao' ? 'Faturamento' : 'PDV Crosby'}
                {t.canal ? ` (${t.canal})` : ''}
              </p>
            )}
          </div>
          {t && <Situacao t={t} />}
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200 sm:grid-cols-4">
              <Campo rotulo="Cliente">{t.cliente_nome || 'Consumidor'}</Campo>
              <Campo rotulo="Código">{t.cliente_code}</Campo>
              <Campo rotulo="CPF/CNPJ">{t.cliente_cpf_cnpj}</Campo>
              <Campo rotulo="Vendedor">{t.vendedor_nome}</Campo>
              <Campo rotulo="Forma">
                {FORMAS[t.forma] || t.forma}
                {t.parcelas_cartao > 1 ? ` ${t.parcelas_cartao}x` : ''}
              </Campo>
              <Campo rotulo="Tipo de documento">{t.tipo_documento}</Campo>
              <Campo rotulo="Portador">{t.portador}</Campo>
              <Campo rotulo="Bandeira">{t.bandeira}</Campo>
              <Campo rotulo="NSU">{t.nsu}</Campo>
              <Campo rotulo="Autorização">{t.autorizacao}</Campo>
              <Campo rotulo="Nota fiscal">{t.nf_numero ? `${t.nf_modelo === 65 ? 'NFC-e' : 'NF-e'} ${t.nf_serie}/${t.nf_numero}` : null}</Campo>
              <Campo rotulo="Caixa">{t.caixa_id ? `#${t.caixa_id} · ${fmtData(t.data_caixa)}` : null}</Campo>
              <Campo rotulo="Emissão">{fmtData(t.emissao)}</Campo>
              <Campo rotulo="Vencimento">{fmtData(t.vencimento)}</Campo>
              <Campo rotulo="Pagamento">{fmtData(t.data_pagamento)}</Campo>
              <Campo rotulo="Liquidação">{fmtData(t.data_liquidacao)}</Campo>
              <Campo rotulo="Valor">{fmtBRL(t.valor)}</Campo>
              <Campo rotulo="Juros / multa">
                {t.situacao === 'aberto' ? `${fmtBRL(t.atualizado.juros)} / ${fmtBRL(t.atualizado.multa)}` : `${fmtBRL(t.juros)} / ${fmtBRL(t.multa)}`}
              </Campo>
              <Campo rotulo="Desconto">{fmtBRL(t.desconto)}</Campo>
              <Campo rotulo={t.situacao === 'aberto' ? 'Valor atualizado' : 'Valor pago'}>{t.situacao === 'aberto' ? fmtBRL(t.atualizado.total) : fmtBRL(t.valor_pago)}</Campo>
              <Campo rotulo="Taxa">
                {fmtBRL(t.taxa_valor)}
                {Number(t.taxa_pct) > 0 ? ` (${String(t.taxa_pct).replace('.', ',')}%)` : ''}
              </Campo>
              <Campo rotulo="Líquido">{fmtBRL(t.valor_liquido)}</Campo>
              <Campo rotulo="Baixado por">{t.baixado_por ? `${t.baixado_por} · ${fmtDataHora(t.baixado_em)}` : null}</Campo>
              <Campo rotulo="Conciliação">
                {!t.precisa_conciliar ? 'não precisa' : t.conciliado_em ? `#${t.conciliacao_id} · ${t.conciliado_por} · ${fmtDataHora(t.conciliado_em)}` : 'a conciliar'}
              </Campo>
              {t.situacao === 'cancelado' && <Campo rotulo="Cancelado">{`${fmtDataHora(t.cancelado_em)} · ${t.cancelado_motivo || ''}`}</Campo>}
            </div>

            {d.parcelas.length > 1 && (
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Parcelas da fatura</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.parcelas.map((p) => (
                    <span key={p.id} className={`rounded-lg px-2 py-1 text-[11px] ring-1 ${p.id === t.id ? 'bg-indigo-50 font-bold text-[#000638] ring-indigo-300' : 'bg-white text-gray-600 ring-gray-200'}`}>
                      {p.parcela} · {FORMAS[p.forma] || p.forma} · {fmtBRL(p.valor)} · {p.situacao === 'pago' ? `pago ${fmtData(p.data_pagamento)}` : p.situacao === 'cancelado' ? 'cancelado' : `vence ${fmtData(p.vencimento)}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {d.baixas.length > 0 && (
              <div>
                <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Baixa</p>
                {d.baixas.map((b) => (
                  <p key={b.id} className="text-xs text-gray-700">
                    {fmtData(b.data_pagamento)} · recebido <b>{fmtBRL(b.valor_recebido)}</b> (título {fmtBRL(b.valor_titulo)} + juros {fmtBRL(b.juros)} + multa {fmtBRL(b.multa)} − desconto {fmtBRL(b.desconto)}) · {b.forma_recebimento || '—'}
                    {b.conta ? ` · ${b.conta}` : ''} · {b.por} em {fmtDataHora(b.em)}
                    {b.observacao ? ` · ${b.observacao}` : ''}
                  </p>
                ))}
              </div>
            )}

            {t.situacao === 'aberto' && podeFinanceiro && !baixa && (
              <div className="flex justify-end">
                <button onClick={abrirBaixa} className={btnPri}>
                  <CheckCircle size={15} weight="bold" /> BAIXAR TÍTULO
                </button>
              </div>
            )}
            {baixa && (
              <div className="rounded-xl bg-emerald-50/60 p-3 ring-1 ring-emerald-200">
                <p className="mb-2 text-sm font-bold text-emerald-900">Baixa do título</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className={labelCls}>Data do pagamento</label>
                    <input type="date" value={baixa.data} max={hojeIso()} onChange={(e) => mudarData(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Juros</label>
                    <input inputMode="decimal" value={baixa.juros} onChange={(e) => setBaixa((b) => ({ ...b, juros: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Multa</label>
                    <input inputMode="decimal" value={baixa.multa} onChange={(e) => setBaixa((b) => ({ ...b, multa: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Desconto</label>
                    <input inputMode="decimal" value={baixa.desconto} onChange={(e) => setBaixa((b) => ({ ...b, desconto: e.target.value }))} placeholder="0,00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Recebido por</label>
                    <select value={baixa.forma} onChange={(e) => setBaixa((b) => ({ ...b, forma: e.target.value }))} className={inputCls}>
                      {FORMAS_RECEBIMENTO.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Conta / banco</label>
                    <input value={baixa.conta} onChange={(e) => setBaixa((b) => ({ ...b, conta: e.target.value }))} placeholder="ex.: Sicredi" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Observação</label>
                    <input value={baixa.obs} onChange={(e) => setBaixa((b) => ({ ...b, obs: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="flex-1">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">Valor recebido</p>
                    <p className="text-xl font-bold tabular-nums text-emerald-800">{fmtBRL(recebido)}</p>
                    <p className="text-[10.5px] text-gray-500">
                      Juros de {String(d.config.juros_mes_pct).replace('.', ',')}% ao mês e multa de {String(d.config.multa_pct).replace('.', ',')}% calculados pela data do pagamento. A baixa não tem estorno.
                    </p>
                  </div>
                  <div className="w-48">
                    <label className={labelCls}>Sua senha do HeadCoach</label>
                    <input type="password" autoComplete="off" value={baixa.senha} onChange={(e) => setBaixa((b) => ({ ...b, senha: e.target.value }))} className={inputCls} />
                  </div>
                  <button onClick={() => setBaixa(null)} disabled={busy} className={`${btnSec} h-10`}>
                    Voltar
                  </button>
                  <button onClick={confirmarBaixa} disabled={busy || !baixa.senha || recebido < 0} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                    {busy ? <Spinner size={15} className="animate-spin" /> : <CheckCircle size={15} weight="bold" />} CONFIRMAR BAIXA
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CONCILIAÇÃO D+1 ─────────────────────────────────────────────────────────
function Conciliacao({ empresas, podeFinanceiro, avisar }) {
  const [empresa, setEmpresa] = useState('');
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [valores, setValores] = useState({}); // chave → valor que caiu
  const [obs, setObs] = useState({});
  const [abertos, setAbertos] = useState({});
  const [busy, setBusy] = useState(null);
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const j = await apiJson(`${API}/conciliacao${empresa ? `?empresa=${empresa}` : ''}`);
      setDados(j.data);
      setValores(Object.fromEntries((j.data.grupos || []).map((g) => [g.chave, String(g.liquidoPrevisto.toFixed(2)).replace('.', ',')])));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [empresa]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const conciliar = async (g) => {
    setBusy(g.chave);
    try {
      const j = await apiJson(`${API}/conciliacao`, {
        method: 'POST',
        body: { empresa: g.empresa, dataLiquidacao: g.dataLiquidacao, forma: g.forma, portador: g.portador, valorRecebido: num(valores[g.chave]), observacao: obs[g.chave] || '' },
      });
      avisar('ok', j.message || 'Conciliado');
      await carregar();
    } catch (e) {
      avisar('erro', e.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="w-72">
          <label className={labelCls}>Empresa</label>
          <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {empresas.map((e) => (
              <option key={e.code} value={e.code}>
                {e.code} — {e.nome}
              </option>
            ))}
          </select>
        </div>
        <button onClick={carregar} disabled={carregando} className={btnSec}>
          <ArrowsClockwise size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
        <p className="flex-1 text-[11px] text-gray-500">
          Cartão e Pix nascem pagos com liquidação D+1: o que foi vendido ontem aparece hoje. Informe quanto caiu na conta — a diferença vira a taxa real, rateada pelos títulos.
        </p>
      </div>
      {erro && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>}
      {dados && dados.grupos.length === 0 && (
        <p className="rounded-xl bg-white px-3 py-10 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
          <CheckCircle size={20} className="mx-auto mb-1 text-emerald-500" weight="fill" />
          Nada a conciliar até {fmtData(dados.ate)}.
        </p>
      )}
      {(dados?.grupos || []).map((g) => {
        const recebido = num(valores[g.chave]);
        const taxa = round2(g.bruto - recebido);
        return (
          <div key={g.chave} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setAbertos((x) => ({ ...x, [g.chave]: !x[g.chave] }))} className="rounded p-0.5 text-gray-500 hover:bg-gray-100">
                {abertos[g.chave] ? <CaretDown size={14} /> : <CaretRight size={14} />}
              </button>
              <div className="min-w-[200px] flex-1">
                <p className="text-sm font-bold text-[#000638]">
                  {FORMAS[g.forma] || g.forma}
                  {g.portador && g.portador !== 'PIX' ? ` · ${g.portador}` : ''} · empresa {g.empresa}
                </p>
                <p className="text-[11px] text-gray-500">
                  Liquidação {fmtData(g.dataLiquidacao)} · {g.qtd} título(s) · vendido {fmtBRL(g.bruto)} · taxa prevista {fmtBRL(g.taxaPrevista)} · líquido previsto {fmtBRL(g.liquidoPrevisto)}
                </p>
              </div>
              <div className="w-36">
                <label className={labelCls}>Caiu na conta</label>
                <input inputMode="decimal" value={valores[g.chave] ?? ''} onChange={(e) => setValores((x) => ({ ...x, [g.chave]: e.target.value }))} disabled={!podeFinanceiro} className={inputCls} />
              </div>
              <div className="w-28 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Taxa real</p>
                <p className={`text-sm font-bold tabular-nums ${taxa < 0 ? 'text-rose-700' : 'text-gray-800'}`}>{fmtBRL(taxa)}</p>
                <p className="text-[10px] text-gray-400">{g.bruto > 0 ? `${((taxa / g.bruto) * 100).toFixed(2).replace('.', ',')}%` : ''}</p>
              </div>
              <div className="w-48">
                <label className={labelCls}>Observação</label>
                <input value={obs[g.chave] || ''} onChange={(e) => setObs((x) => ({ ...x, [g.chave]: e.target.value }))} disabled={!podeFinanceiro} className={inputCls} />
              </div>
              {podeFinanceiro && (
                <button onClick={() => conciliar(g)} disabled={busy === g.chave || taxa < 0 || valores[g.chave] === ''} className={btnPri}>
                  {busy === g.chave ? <Spinner size={15} className="animate-spin" /> : <LinkIcon size={15} weight="bold" />} CONCILIAR
                </button>
              )}
            </div>
            {abertos[g.chave] && (
              <table className="mt-2 w-full text-[11px]">
                <thead className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="py-1">Fatura</th>
                    <th className="py-1">Cliente</th>
                    <th className="py-1">Emissão</th>
                    <th className="py-1">Bandeira</th>
                    <th className="py-1">NSU</th>
                    <th className="py-1 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {g.titulos.map((t) => (
                    <tr key={t.id}>
                      <td className="py-1 tabular-nums">
                        {t.fatura}/{t.parcela}
                      </td>
                      <td className="py-1">{t.cliente_nome || 'Consumidor'}</td>
                      <td className="py-1">{fmtData(t.emissao)}</td>
                      <td className="py-1">
                        {t.bandeira || '—'}
                        {t.parcelas_cartao > 1 ? ` ${t.parcelas_cartao}x` : ''}
                      </td>
                      <td className="py-1">{t.nsu || '—'}</td>
                      <td className="py-1 text-right tabular-nums">{fmtBRL(t.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      {dados?.recentes?.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-gray-500">Últimas conciliações</p>
          <ul className="divide-y divide-gray-100 text-xs">
            {dados.recentes.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-2 py-1.5">
                <span className="w-28 tabular-nums text-gray-500">{fmtData(c.data_liquidacao)}</span>
                <span className="min-w-0 flex-1">
                  #{c.id} · empresa {c.empresa} · {FORMAS[c.forma] || c.forma}
                  {c.portador && c.portador !== 'PIX' ? ` · ${c.portador}` : ''} · {c.qtd_titulos} título(s) · vendido {fmtBRL(c.valor_bruto)} · caiu {fmtBRL(c.valor_recebido)}
                  {c.observacao ? ` · ${c.observacao}` : ''} · {c.por}
                </span>
                <span className="font-semibold tabular-nums">taxa {fmtBRL(c.taxa)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const CAMPOS_CONFIG = [
  { k: 'juros_mes_pct', label: 'Juros de mora (% ao mês)', grupo: 'Atraso' },
  { k: 'multa_pct', label: 'Multa por atraso (%)', grupo: 'Atraso' },
  { k: 'taxa_credito_pct', label: 'Crédito à vista (%)', grupo: 'Taxa da maquininha' },
  { k: 'taxa_credito_parc_pct', label: 'Crédito parcelado (%)', grupo: 'Taxa da maquininha' },
  { k: 'taxa_debito_pct', label: 'Débito (%)', grupo: 'Taxa da maquininha' },
  { k: 'taxa_pix_pct', label: 'Pix (%)', grupo: 'Taxa da maquininha' },
  { k: 'dias_liq_credito', label: 'Crédito (dias)', grupo: 'Liquidação' },
  { k: 'dias_liq_debito', label: 'Débito (dias)', grupo: 'Liquidação' },
  { k: 'dias_liq_pix', label: 'Pix (dias)', grupo: 'Liquidação' },
];
function Configuracao({ podeFinanceiro, admin, avisar }) {
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    try {
      const j = await apiJson(`${API}/config`);
      setCfg(j.data);
      setForm(Object.fromEntries(CAMPOS_CONFIG.map((c) => [c.k, String(j.data[c.k]).replace('.', ',')])));
    } catch (e) {
      setErro(e.message);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const salvar = async () => {
    setBusy(true);
    try {
      const body = Object.fromEntries(CAMPOS_CONFIG.map((c) => [c.k, String(form[c.k] ?? '').replace(',', '.')]));
      const j = await apiJson(`${API}/config`, { method: 'PUT', body });
      avisar('ok', j.message || 'Configuração salva');
      await carregar();
    } catch (e) {
      avisar('erro', e.message);
    } finally {
      setBusy(false);
    }
  };
  const gerar = async () => {
    setBusy(true);
    try {
      const j = await apiJson(`${API}/gerar`, { method: 'POST', body: { todas: true }, timeoutMs: 600000 });
      avisar('ok', j.message);
    } catch (e) {
      avisar('erro', e.message);
    } finally {
      setBusy(false);
    }
  };
  if (erro) return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{erro}</p>;
  if (!cfg)
    return (
      <div className="py-16 text-center text-gray-400">
        <Spinner size={22} className="mx-auto animate-spin" />
      </div>
    );
  const grupos = [...new Set(CAMPOS_CONFIG.map((c) => c.grupo))];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        {grupos.map((g) => (
          <div key={g} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#000638]">{g}</p>
            <div className="space-y-2">
              {CAMPOS_CONFIG.filter((c) => c.grupo === g).map((c) => (
                <div key={c.k}>
                  <label className={labelCls}>{c.label}</label>
                  <input inputMode="decimal" value={form[c.k] ?? ''} onChange={(e) => setForm((x) => ({ ...x, [c.k]: e.target.value }))} disabled={!podeFinanceiro} className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <p className="flex-1 text-[11px] text-gray-500">
          <Receipt size={12} className="mr-1 inline" />
          A taxa da maquininha é a estimada na emissão; a conciliação D+1 troca pela taxa real. Juros simples pro rata dia. Vale para os títulos novos (juros e multa valem também para os em aberto).
          {cfg.atualizado_por ? ` Última alteração: ${cfg.atualizado_por}, ${fmtDataHora(cfg.atualizado_em)}.` : ''}
        </p>
        {admin && (
          <button onClick={gerar} disabled={busy} className={btnSec} title="Gera os títulos de todas as vendas autorizadas que ainda não têm (a emissão já gera na hora)">
            <ArrowsClockwise size={14} /> Gerar títulos que faltam
          </button>
        )}
        {podeFinanceiro ? (
          <button onClick={salvar} disabled={busy} className={btnPri}>
            {busy ? <Spinner size={15} className="animate-spin" /> : <CheckCircle size={15} weight="bold" />} SALVAR
          </button>
        ) : (
          <p className="flex items-center gap-1 text-xs text-amber-700">
            <Warning size={13} weight="fill" /> Só owner, admin ou financeiro altera.
          </p>
        )}
      </div>
    </div>
  );
}
