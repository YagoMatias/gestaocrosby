// Página: Fiscal → Impostos
// Painel de impostos a pagar por filial e mês. v1: ICMS.
//   - Provisão: estimativa pelas notas do TOTVS (ICMS saídas − entradas)
//   - Realizado: importação do SPED EFD ICMS/IPI (registro E110)
// Mesmo padrão visual das páginas de Contas a Pagar / Receber / Liberação.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Scales,
  ArrowsClockwise,
  Spinner,
  UploadSimple,
  Calculator,
  Info,
  CheckCircle,
  Warning,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson, apiFetch, authHeaders } from '../utils/apiAuth';
import { API_BASE_URL } from '../config/constants';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const btn = 'inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrim = `${btn} bg-[#000638] text-white hover:bg-[#1a2060]`;
const btnSec = `${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;
const inputCls = 'h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

const fmtMoeda = (v) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMoedaCurta = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (n === 0) return 'R$ 0';
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return fmtMoeda(n);
};

function Card({ title, value, sub, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70">{title}</div>
      <div className="text-lg font-bold leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[11px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

// célula do grid
function Celula({ cell, onInfo }) {
  if (!cell) return <td className="px-2 py-1 text-center text-gray-300">—</td>;
  const realizado = cell.origem === 'realizado';
  return (
    <td className="px-2 py-1 text-right whitespace-nowrap">
      <button
        type="button"
        onClick={() => onInfo(cell)}
        className={`inline-flex flex-col items-end leading-tight ${realizado ? 'text-emerald-700' : 'text-amber-700'} hover:underline`}
        title={realizado ? 'Realizado (SPED)' : 'Provisão (estimativa pelas notas)'}
      >
        <span className="font-semibold">{fmtMoedaCurta(cell.valor)}</span>
        <span className="text-[9px] uppercase tracking-wide opacity-70">{realizado ? 'realizado' : 'provisão'}</span>
      </button>
    </td>
  );
}

export default function ImpostosFiscal() {
  const { user } = useAuth();
  const podeEscrever = ['owner', 'admin', 'manager', 'user'].includes(user?.role);
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(2026);
  const [painel, setPainel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);
  const [mesCalc, setMesCalc] = useState(new Date().getMonth() + 1);
  const [calculando, setCalculando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const fileRef = useRef(null);

  const aviso = (texto, tipo = 'ok') => {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(null), 6000);
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiJson(`/api/fiscal-impostos/painel?ano=${ano}&imposto=ICMS`);
      setPainel(data);
      setErro(null);
    } catch (e) {
      setErro(e.message);
      setPainel(null);
    } finally {
      setLoading(false);
    }
  }, [ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const calcularMes = async () => {
    if (!window.confirm(`Calcular a provisão de ICMS de ${MESES[mesCalc - 1]}/${ano} para todas as filiais? Isso consulta as notas no TOTVS e pode levar alguns minutos.`)) return;
    setCalculando(true);
    try {
      const { data } = await apiJson('/api/fiscal-impostos/provisao/calcular-mes', {
        method: 'POST',
        body: { ano, mes: mesCalc },
        timeoutMs: 600000,
      });
      const ok = data.filiais.filter((f) => f.ok).length;
      aviso(`Provisão calculada: ${ok}/${data.filiais.length} filiais em ${MESES[mesCalc - 1]}/${ano}`);
      carregar();
    } catch (e) {
      aviso(e.message, 'erro');
    } finally {
      setCalculando(false);
    }
  };

  const importarSped = async (file) => {
    if (!file) return;
    setImportando(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const headers = await authHeaders();
      const resp = await fetch(`${API_BASE_URL}/api/fiscal-impostos/sped/importar`, { method: 'POST', headers, body: fd });
      const j = await resp.json();
      if (!resp.ok || j.success === false) throw new Error(j.message || `HTTP ${resp.status}`);
      const ok = j.data.resultados.filter((r) => r.ok).length;
      const falhas = j.data.resultados.filter((r) => !r.ok);
      aviso(`SPED importado: ${ok}/${j.data.periodos} períodos como realizado${falhas.length ? ` (${falhas.length} ignorados)` : ''}`);
      if (falhas.length) console.warn('SPED — períodos ignorados:', falhas);
      carregar();
    } catch (e) {
      aviso(e.message, 'erro');
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const resumo = useMemo(() => {
    if (!painel) return { realizado: 0, provisao: 0, filiais: 0 };
    let realizado = 0;
    let provisao = 0;
    for (const l of painel.linhas) {
      for (let m = 1; m <= 12; m++) {
        const c = l.meses[m];
        if (!c) continue;
        if (c.origem === 'realizado') realizado += c.valor;
        else provisao += c.valor;
      }
    }
    return { realizado, provisao, filiais: painel.linhas.length };
  }, [painel]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-4">
      <PageTitle
        title="Impostos"
        subtitle="Impostos a pagar por filial e mês. Provisão estimada pelas notas e realizado pelo SPED fiscal. v1: ICMS."
        icon={Scales}
        iconColor="text-amber-600"
      />

      {msg && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-semibold ${msg.tipo === 'erro' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.texto}
        </div>
      )}

      {/* barra de controles */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Imposto</label>
          <select className={inputCls} value="ICMS" disabled>
            <option>ICMS</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Ano</label>
          <select className={inputCls} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[anoAtual + 1, anoAtual, 2026, 2025].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <button type="button" className={btnSec} onClick={carregar} disabled={loading}>
          {loading ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />} Atualizar
        </button>

        {podeEscrever && (
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Provisão do mês</label>
              <div className="flex items-center gap-1">
                <select className={inputCls} value={mesCalc} onChange={(e) => setMesCalc(Number(e.target.value))}>
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <button type="button" className={btnSec} onClick={calcularMes} disabled={calculando}>
                  {calculando ? <Spinner size={14} className="animate-spin" /> : <Calculator size={14} />} Calcular
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">SPED (realizado)</label>
              <button type="button" className={btnPrim} onClick={() => fileRef.current?.click()} disabled={importando}>
                {importando ? <Spinner size={14} className="animate-spin" /> : <UploadSimple size={14} />} Importar SPED
              </button>
              <input ref={fileRef} type="file" accept=".txt,.sped,.efd" className="hidden" onChange={(e) => importarSped(e.target.files?.[0])} />
            </div>
          </div>
        )}
      </div>

      {/* cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card title="Filiais" value={resumo.filiais} sub="no painel" />
        <Card title={`Realizado ${ano}`} value={fmtMoeda(resumo.realizado)} sub="do SPED fiscal" tone="emerald" />
        <Card title={`Provisão ${ano}`} value={fmtMoeda(resumo.provisao)} sub="estimativa pelas notas" tone="amber" />
        <Card title={`Total ${ano}`} value={fmtMoeda(painel?.totalGeral)} sub="ICMS a recolher" tone="blue" />
      </div>

      {/* aviso metodológico */}
      <div className="mb-3 rounded-lg px-3 py-2 text-[11px] bg-blue-50 text-blue-800 border border-blue-200 flex items-start gap-2">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          <b>Provisão</b> = estimativa pelas notas do TOTVS (ICMS das saídas − das entradas). <b>Realizado</b> = valor oficial do SPED EFD ICMS/IPI (registro E110). O realizado sempre prevalece sobre a provisão do mesmo mês.
        </span>
      </div>

      {erro && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
          <Warning size={14} /> {erro}
        </div>
      )}

      {/* grid */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#000638] text-white">
              <th className="px-3 py-2 text-left sticky left-0 bg-[#000638] z-10">Filial</th>
              {MESES.map((m) => <th key={m} className="px-2 py-2 text-right">{m}</th>)}
              <th className="px-3 py-2 text-right">Total {ano}</th>
            </tr>
          </thead>
          <tbody>
            {painel?.linhas.map((l, idx) => (
              <tr key={l.cd_empresa} className={idx % 2 ? 'bg-gray-50/60' : ''}>
                <td className="px-3 py-1 text-left sticky left-0 bg-inherit font-semibold text-gray-700 whitespace-nowrap" title={l.cnpj || ''}>
                  <span className="text-gray-400 mr-1">{l.cd_empresa}</span>{l.nm_empresa}
                </td>
                {Array.from({ length: 12 }, (_, i) => (
                  <Celula key={i} cell={l.meses[i + 1]} onInfo={(c) => setDetalhe({ ...c, filial: l.nm_empresa, mes: i + 1 })} />
                ))}
                <td className="px-3 py-1 text-right font-bold text-[#000638] whitespace-nowrap">{fmtMoedaCurta(l.total)}</td>
              </tr>
            ))}
            {!loading && painel && painel.linhas.length === 0 && (
              <tr><td colSpan={14} className="px-3 py-6 text-center text-gray-400">Nenhuma filial encontrada.</td></tr>
            )}
            {loading && !painel && (
              <tr><td colSpan={14} className="px-3 py-6 text-center text-gray-400"><Spinner size={18} className="animate-spin inline" /> carregando…</td></tr>
            )}
          </tbody>
          {painel && painel.linhas.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-bold text-gray-800">
                <td className="px-3 py-2 text-left sticky left-0 bg-gray-100">Total</td>
                {Array.from({ length: 12 }, (_, i) => (
                  <td key={i} className="px-2 py-2 text-right whitespace-nowrap">{fmtMoedaCurta(painel.totaisMes[i + 1])}</td>
                ))}
                <td className="px-3 py-2 text-right text-[#000638] whitespace-nowrap">{fmtMoedaCurta(painel.totalGeral)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* modal detalhe da célula */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-white rounded-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              {detalhe.origem === 'realizado' ? <CheckCircle size={18} className="text-emerald-600" /> : <Calculator size={18} className="text-amber-600" />}
              <div>
                <div className="font-bold text-sm">{detalhe.filial}</div>
                <div className="text-[11px] text-gray-500">ICMS {MESES[detalhe.mes - 1]}/{ano} — {detalhe.origem === 'realizado' ? 'Realizado (SPED)' : 'Provisão (notas)'}</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-[#000638] mb-3">{fmtMoeda(detalhe.valor)}</div>
            {detalhe.detalhe && (
              <div className="text-xs text-gray-600 space-y-1 border-t border-gray-100 pt-2">
                {detalhe.origem === 'provisao' ? (
                  <>
                    <div className="flex justify-between"><span>Débito (ICMS saídas)</span><span className="font-semibold">{fmtMoeda(detalhe.detalhe.debito)}</span></div>
                    <div className="flex justify-between"><span>Crédito (ICMS entradas)</span><span className="font-semibold">{fmtMoeda(detalhe.detalhe.credito)}</span></div>
                    <div className="flex justify-between border-t border-gray-100 pt-1"><span>Saldo a recolher</span><span className="font-bold">{fmtMoeda(detalhe.detalhe.saldo)}</span></div>
                    <div className="text-[10px] text-gray-400 pt-1">{detalhe.detalhe.notas} notas consideradas</div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between"><span>Total de débitos</span><span className="font-semibold">{fmtMoeda(detalhe.detalhe.sped?.total_debitos)}</span></div>
                    <div className="flex justify-between"><span>Total de créditos</span><span className="font-semibold">{fmtMoeda(detalhe.detalhe.sped?.total_creditos)}</span></div>
                    <div className="flex justify-between"><span>Saldo apurado</span><span className="font-semibold">{fmtMoeda(detalhe.detalhe.sped?.saldo_apurado)}</span></div>
                    <div className="flex justify-between border-t border-gray-100 pt-1"><span>ICMS a recolher</span><span className="font-bold">{fmtMoeda(detalhe.detalhe.sped?.icms_recolher)}</span></div>
                    {detalhe.detalhe.arquivo && <div className="text-[10px] text-gray-400 pt-1">Arquivo: {detalhe.detalhe.arquivo}</div>}
                  </>
                )}
                {detalhe.atualizado_em && <div className="text-[10px] text-gray-400">Atualizado em {new Date(detalhe.atualizado_em).toLocaleString('pt-BR')}</div>}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button type="button" className={btnSec} onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
