// Sub-aba "Conversão" — Reunião do Varejo
// 3 fontes de conversão consolidadas:
//   1) Fila da Vez  — atendimentos com venda / total atendimentos
//   2) CRM           — leads ClickUp fechados / total leads (canal varejo)
//   3) AlterVision   — câmeras (em breve)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Hourglass,
  ChatCircle,
  VideoCamera,
  ArrowsClockwise,
  CheckCircle,
  XCircle,
  ArrowSquareOut,
  TrendUp,
  Trophy,
  CaretRight,
  CalendarBlank,
  MagnifyingGlass,
} from 'phosphor-react';
import { API_BASE_URL } from '../../config/constants';
import ConversaoClientesModal from './ConversaoClientesModal';

const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`;
const fmtInt = (v) => Number(v || 0).toLocaleString('pt-BR');

function corNivel(pct) {
  if (pct >= 30) return { ring: 'stroke-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' };
  if (pct >= 15) return { ring: 'stroke-amber-500', text: 'text-amber-600', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' };
  return { ring: 'stroke-rose-500', text: 'text-rose-600', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700' };
}

const PRESETS = [
  { id: 'hoje',   label: 'Hoje',         dias: 0 },
  { id: '7d',     label: '7 dias',       dias: 6 },
  { id: '30d',    label: '30 dias',      dias: 29 },
  { id: 'mes',    label: 'Mês atual',    type: 'mes' },
];

// Donut SVG mais elegante
function DonutChart({ pct, color, sublabel }) {
  const safe = Math.max(0, Math.min(100, Number(pct) || 0));
  const RADIUS = 44;
  const CIRC = 2 * Math.PI * RADIUS;
  const dash = (safe / 100) * CIRC;
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg viewBox="0 0 110 110" className="w-36 h-36 -rotate-90">
        <circle cx="55" cy="55" r={RADIUS} fill="none" className="stroke-gray-100" strokeWidth="9" />
        <circle
          cx="55"
          cy="55"
          r={RADIUS}
          fill="none"
          className={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRC}`}
          style={{ transition: 'stroke-dasharray .8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold text-[#000638] leading-none tabular-nums">
          {safe.toFixed(1)}<span className="text-lg text-gray-500">%</span>
        </div>
        {sublabel && (
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{sublabel}</div>
        )}
      </div>
    </div>
  );
}

function MiniBar({ done, total, color }) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full`}
        style={{ width: `${Math.min(100, pct)}%`, transition: 'width .6s ease' }}
      />
    </div>
  );
}

function CardConv({ icon: Icon, titulo, subtitulo, pct, vendas, totalLabel, total, color, badge, footer, status, accent }) {
  const cor = corNivel(pct);
  return (
    <div
      className={`relative bg-white rounded-2xl shadow-md border border-[#000638]/10 p-5 font-barlow overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5`}
    >
      {/* Decorativo: aro colorido no topo */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${accent || 'bg-[#000638]'}`} />

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-2 rounded-lg ${accent ? `${accent} bg-opacity-15` : 'bg-[#000638]/10'}`}>
            <Icon size={18} weight="bold" className={`${accent ? 'text-white' : 'text-[#000638]'}`}
              style={accent ? { color: 'inherit' } : undefined}
            />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[#000638] leading-tight truncate">{titulo}</h4>
            {subtitulo && <p className="text-[11px] text-gray-500 truncate">{subtitulo}</p>}
          </div>
        </div>
        {status && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${status.color}`}>
            {status.label}
          </span>
        )}
        {!status && pct > 0 && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${cor.badge}`}>
            {pct >= 30 ? 'BOA' : pct >= 15 ? 'REGULAR' : 'BAIXA'}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center justify-center py-3">
        <DonutChart pct={pct} color={cor.ring} sublabel={totalLabel || ''} />
      </div>

      {/* Métricas absolutas */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Convertidos</span>
          <span className={`font-bold ${cor.text}`}>{fmtInt(vendas)}</span>
        </div>
        <MiniBar done={vendas} total={total} color={cor.ring.replace('stroke-', 'bg-')} />
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Total base</span>
          <span className="font-semibold text-gray-700">{fmtInt(total)}</span>
        </div>
      </div>

      {footer && <div className="mt-3 pt-3 border-t border-gray-100 text-xs">{footer}</div>}
    </div>
  );
}

export default function VarejoConversao() {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [datemin, setDatemin] = useState(inicioMes);
  const [datemax, setDatemax] = useState(hoje);
  const [presetAtivo, setPresetAtivo] = useState('mes');
  const [filaData, setFilaData] = useState(null);
  const [crmData, setCrmData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [showClientesModal, setShowClientesModal] = useState(false);

  const aplicarPreset = (p) => {
    setPresetAtivo(p.id);
    const now = new Date();
    if (p.type === 'mes') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setDatemin(first.toISOString().slice(0, 10));
      setDatemax(hoje);
    } else {
      const inicio = new Date(now);
      inicio.setDate(inicio.getDate() - (p.dias || 0));
      setDatemin(inicio.toISOString().slice(0, 10));
      setDatemax(hoje);
    }
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [filaResp, crmResp] = await Promise.all([
        fetch(`${API_BASE_URL}/api/fila/dashboard?datemin=${datemin}&datemax=${datemax}`)
          .then((r) => r.json())
          .catch(() => ({ success: false })),
        fetch(`${API_BASE_URL}/api/crm/conversao-resumo?canal=varejo&datemin=${datemin}&datemax=${datemax}`)
          .then((r) => r.json())
          .catch(() => ({ success: false })),
      ]);
      setFilaData(filaResp?.data || null);
      setCrmData(crmResp?.data || null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [datemin, datemax]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Métricas computadas ──
  const fila = filaData?.resumo || {};
  const filaTotal = fila.total_atendimentos || 0;
  const filaVendas = fila.total_com_venda || 0;
  const filaSem = fila.total_sem_venda || 0;
  const filaPct = fila.taxa_conversao || 0;

  const crmTotal = crmData?.total_leads || 0;
  const crmFechados = crmData?.leads_fechados || 0;
  const crmPct = crmData?.conversao_pct || 0;
  const crmPerdidos = crmData?.leads_perdidos || 0;
  const crmFechadosStatus = crmData?.leads_fechados_status || 0;
  const crmValidadosNf = crmData?.leads_validados_nf || 0;
  const crmComMatch = crmData?.leads_com_match_telefone || 0;

  const alterStatus = { label: 'EM BREVE', color: 'bg-gray-200 text-gray-600' };

  // Comparativo: qual fonte teve melhor conversão
  const ranking = useMemo(() => {
    const items = [
      { id: 'fila', label: 'Fila da Vez', pct: filaPct, total: filaTotal },
      { id: 'crm', label: 'CRM', pct: crmPct, total: crmTotal },
    ].filter((i) => i.total > 0);
    items.sort((a, b) => b.pct - a.pct);
    return items;
  }, [filaPct, filaTotal, crmPct, crmTotal]);

  const fmtBR = (s) => {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}`;
  };

  return (
    <div className="space-y-4 font-barlow">
      {/* Header com filtros */}
      <div className="bg-gradient-to-r from-[#000638] to-[#0a1450] text-white p-4 rounded-2xl shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <TrendUp size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">Conversão Varejo</h3>
              <p className="text-[11px] text-white/70 flex items-center gap-1">
                <CalendarBlank size={11} />
                {fmtBR(datemin)} → {fmtBR(datemax)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => aplicarPreset(p)}
                className={`text-xs px-3 py-1.5 rounded-full transition ${
                  presetAtivo === p.id
                    ? 'bg-white text-[#000638] font-semibold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={carregar}
              disabled={loading}
              className="ml-1 inline-flex items-center gap-1 bg-white text-[#000638] text-xs px-3 py-1.5 rounded-full font-semibold hover:bg-white/90 disabled:opacity-50"
            >
              <ArrowsClockwise size={12} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>
        {/* Inputs de data custom (escondidos no preset normal) */}
        <div className="flex items-center gap-2 mt-3 text-xs text-white/80">
          <span>Personalizado:</span>
          <input
            type="date"
            value={datemin}
            onChange={(e) => { setDatemin(e.target.value); setPresetAtivo(''); }}
            className="px-2 py-1 bg-white/10 text-white rounded border border-white/20 [color-scheme:dark]"
          />
          <span>→</span>
          <input
            type="date"
            value={datemax}
            onChange={(e) => { setDatemax(e.target.value); setPresetAtivo(''); }}
            className="px-2 py-1 bg-white/10 text-white rounded border border-white/20 [color-scheme:dark]"
          />
        </div>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{erro}</div>}

      {/* 3 cards de conversão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardConv
          icon={Hourglass}
          titulo="Fila da Vez"
          subtitulo="Atendimentos com venda"
          pct={filaPct}
          vendas={filaVendas}
          total={filaTotal}
          totalLabel="conversão"
          accent="bg-gradient-to-r from-indigo-500 to-indigo-600"
          footer={
            <div className="flex items-center justify-between text-gray-500">
              <span className="inline-flex items-center gap-1">
                <CheckCircle size={11} weight="fill" className="text-emerald-500" /> {fmtInt(filaVendas)} venda(s)
              </span>
              <span className="inline-flex items-center gap-1">
                <XCircle size={11} weight="fill" className="text-rose-500" /> {fmtInt(filaSem)} sem venda
              </span>
            </div>
          }
        />

        <CardConv
          icon={ChatCircle}
          titulo="CRM (ClickUp)"
          subtitulo="Leads canal Varejo"
          pct={crmPct}
          vendas={crmFechados}
          total={crmTotal}
          totalLabel="conversão"
          accent="bg-gradient-to-r from-violet-500 to-violet-600"
          footer={
            <div className="space-y-1">
              <div className="flex items-center justify-between text-gray-500">
                <span className="inline-flex items-center gap-1" title="Marcados como fechado/comprou no ClickUp">
                  <CheckCircle size={11} weight="fill" className="text-emerald-500" />
                  {fmtInt(crmFechadosStatus)} por status
                </span>
                <span className="inline-flex items-center gap-1" title="Cliente do lead com NF Output em loja varejo no período">
                  <CheckCircle size={11} weight="fill" className="text-blue-500" />
                  {fmtInt(crmValidadosNf)} por NF
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-400 text-[10px]">
                <span title="Leads com telefone que casa em pes_pessoa">
                  {fmtInt(crmComMatch)} c/ match
                </span>
                <span className="inline-flex items-center gap-1">
                  <XCircle size={10} weight="fill" className="text-rose-500" />
                  {fmtInt(crmPerdidos)} perdidos
                </span>
              </div>
              <button
                onClick={() => setShowClientesModal(true)}
                className="mt-1 w-full inline-flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold py-1.5 rounded-lg transition"
              >
                <MagnifyingGlass size={12} weight="bold" /> Ver clientes e lojas
              </button>
            </div>
          }
        />

        <CardConv
          icon={VideoCamera}
          titulo="Câmeras (AlterVision)"
          subtitulo="Visitantes → vendas"
          pct={0}
          vendas={0}
          total={0}
          totalLabel="conversão"
          accent="bg-gradient-to-r from-cyan-500 to-cyan-600"
          status={alterStatus}
          footer={
            <a
              href="https://docs.painelalter.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-cyan-700 hover:underline font-semibold"
            >
              Ativar integração <ArrowSquareOut size={11} />
            </a>
          }
        />
      </div>

      {/* Ranking / destaque */}
      {ranking.length >= 1 && (
        <div className="bg-white rounded-2xl shadow-md border border-[#000638]/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} weight="fill" className="text-yellow-500" />
            <h4 className="text-sm font-bold text-[#000638]">Ranking de Conversão</h4>
          </div>
          <div className="space-y-2">
            {ranking.map((r, idx) => {
              const cor = corNivel(r.pct);
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    idx === 0 ? 'bg-yellow-100 text-yellow-800' : idx === 1 ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-32">{r.label}</span>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${cor.ring.replace('stroke-', 'bg-')} rounded-full`}
                        style={{ width: `${Math.min(100, r.pct)}%`, transition: 'width .6s ease' }}
                      />
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${cor.text} w-12 text-right`}>
                    {fmtPct(r.pct)}
                  </span>
                  <span className="text-xs text-gray-500 w-20 text-right">{fmtInt(r.total)} base</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Glossário */}
      <details className="bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
        <summary className="px-3 py-2 cursor-pointer hover:bg-gray-100 inline-flex items-center gap-1">
          <CaretRight size={12} /> O que cada métrica representa?
        </summary>
        <div className="px-3 pb-3 space-y-2 pt-1 text-gray-600">
          <p><strong className="text-indigo-700">Fila da Vez:</strong> Atendimentos registrados via tablet da loja (CRM → Varejo → Fila da Vez → Operação). Conversão = atendimentos com venda ÷ total de atendimentos.</p>
          <p><strong className="text-violet-700">CRM (ClickUp):</strong> Leads do CRM 26 com categoria Varejo. Conta como fechado o maior entre: (a) leads com status "comprou/fechado" no ClickUp, ou (b) leads cujo cliente (match por telefone com pes_pessoa) tem NF Output em loja varejo no período. Isso captura vendas onde o vendedor esqueceu de marcar o status.</p>
          <p><strong className="text-cyan-700">Câmeras (AlterVision):</strong> Visitantes detectados pelas câmeras × vendas no mesmo período. Integração ainda não ativada (aguardando credenciais).</p>
        </div>
      </details>

      {showClientesModal && (
        <ConversaoClientesModal
          canal="varejo"
          datemin={datemin}
          datemax={datemax}
          onClose={() => setShowClientesModal(false)}
        />
      )}
    </div>
  );
}
