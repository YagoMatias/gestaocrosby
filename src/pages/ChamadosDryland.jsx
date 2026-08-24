// Página: Tecnologia → Chamados Dryland
// Gestão dos chamados da rede Dryland DIRETO pelo HeadCoach.
// Fala com /api/dryland/chamados (ponte pro Supabase do Dryland) —
// mesmas RPCs que o site dryland-missao-separacao usa, sem tocar nele.
// Layout no padrão HeadCoach (LiberacaoPagamento / SolicitacoesCrosby).
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Ticket,
  Plus,
  ArrowClockwise,
  Funnel,
  MagnifyingGlass,
  Spinner,
  X,
  CaretDown,
  Camera,
  ChatCircleText,
  CheckCircle,
  XCircle,
  Clock,
  ClockCounterClockwise,
  PlayCircle,
  UserCircle,
  Storefront,
  Warning,
  Info,
  ClipboardText,
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
  FloppyDisk,
  Megaphone,
  Tray,
  UsersThree,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import Notification from '../components/ui/Notification';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';

const API = `${API_BASE_URL}/api/dryland`;

// setores que já vêm marcados ao abrir a página (o usuário pode trocar à vontade)
const SETORES_PADRAO = ['financeiro', 'fiscal', 'tecnologia'];

// ─── Tipografia única da página (tudo em caixa alta) ───────────
// Escala: 9px flags · 10px labels/badges/cabeçalhos · 11px corpo da tabela
//         12px botões/formulário · 20px números de KPI
const T = {
  label: 'text-[10px] font-bold uppercase tracking-wide text-gray-500',
  kpiLabel: 'text-[10px] font-bold uppercase tracking-wide',
  kpiValue: 'text-xl font-bold',
  th: 'px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide',
  td: 'px-2 py-2 text-[11px] uppercase tracking-wide',
  badge: 'text-[10px] font-bold uppercase tracking-wide',
  flag: 'text-[9px] font-bold uppercase tracking-wide',
  btn: 'text-xs font-bold uppercase tracking-wide',
};

// ── Config de status (espelha os status do Dryland, visual HeadCoach) ──
const STATUS_CONFIG = {
  aberto: { label: 'Aberto', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Tray },
  em_andamento: { label: 'Em andamento', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: PlayCircle },
  aguardando_solicitante: { label: 'Aguard. solicitante', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
  aguardando_responsavel: { label: 'Aguard. responsável', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: UserCircle },
  concluido: { label: 'Resolvido', color: 'bg-gray-200 text-gray-700 border-gray-300', icon: CheckCircle },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
};

const DIRECAO_CONFIG = {
  adm: { label: 'Cobrança', title: 'Adm cobra a loja', color: 'bg-red-100 text-red-700', icon: Megaphone },
  loja: { label: 'Pedido', title: 'Loja pede pro setor', color: 'bg-blue-100 text-blue-700', icon: Storefront },
};

const inputCls =
  'border border-gray-300 rounded px-2 py-1.5 text-xs uppercase tracking-wide bg-white focus:outline-none focus:ring-1 focus:ring-[#000638] h-[30px]';
// campos de formulário dentro dos modais (dialeto SolicitacoesCrosby)
const inpCls =
  'w-full border-2 border-gray-200 rounded-lg px-2.5 py-2 text-xs uppercase tracking-wide focus:outline-none focus:border-[#000638] transition-colors bg-white';
const ELabel = ({ children }) => <p className={`${T.label} mb-1`}>{children}</p>;

const fmtData = (d) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'sem prazo';
const fmtDataHora = (d) =>
  d
    ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';
const idadeDias = (c) =>
  Math.floor((Date.now() - new Date(c.criado_em).getTime()) / 86400000);

async function apiJson(url, options) {
  const r = await fetch(url, options);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.success) throw new Error(j?.message || `HTTP ${r.status}`);
  return j.data;
}

// ── Pedaços visuais reutilizados ──────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || {
    label: status || '?',
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    icon: Info,
  };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border whitespace-nowrap ${T.badge} ${cfg.color}`}>
      <Icon size={11} weight="bold" />
      {cfg.label}
    </span>
  );
}

function DirecaoBadge({ direcao }) {
  const cfg = DIRECAO_CONFIG[direcao] || DIRECAO_CONFIG.loja;
  const Icon = cfg.icon;
  return (
    <span title={cfg.title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded whitespace-nowrap ${T.badge} ${cfg.color}`}>
      <Icon size={11} weight="bold" />
      {cfg.label}
    </span>
  );
}

function PrazoBadge({ chamado }) {
  const atrasado = chamado.atrasado || chamado.vencido;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border whitespace-nowrap ${T.badge} ${
        atrasado ? 'bg-red-100 text-red-800 border-red-300' : 'bg-gray-100 text-gray-700 border-gray-300'
      }`}
    >
      <Clock size={11} weight="bold" />
      {fmtData(chamado.prazo)}
    </span>
  );
}

// flagra o chamado que teve o prazo empurrado (campo prazo_alteracoes do Dryland)
function PrazoAltBadge({ chamado, className = '' }) {
  const n = Number(chamado.prazo_alteracoes || 0);
  if (n < 1) return null;
  return (
    <span
      title={
        (chamado.prazo_justificativa ? `Motivo: "${chamado.prazo_justificativa}"` : 'Sem motivo registrado') +
        (chamado.prazo_alterado_em ? ` · última vez em ${fmtDataHora(chamado.prazo_alterado_em)}` : '')
      }
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 ${T.flag} ${className}`}
    >
      <ClockCounterClockwise size={9} weight="bold" />
      Prazo mudou {n}x
    </span>
  );
}

const CardStat = ({ label, value, cor, Icon, ativo, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 min-w-[150px] bg-white rounded-xl shadow border ${cor} p-3 text-left hover:shadow-md transition-shadow ${
      ativo ? 'ring-2 ring-[#000638]' : ''
    }`}
  >
    <div className="flex items-center gap-2 mb-1">
      <Icon size={16} weight="bold" />
      <span className={T.kpiLabel}>{label}</span>
    </div>
    <div className={T.kpiValue}>{value}</div>
  </button>
);

const ThSortable = ({ label, coluna, ordenacao, onSort, className = '' }) => {
  const ativo = ordenacao.coluna === coluna;
  return (
    <th className={`${T.th} cursor-pointer select-none group ${className}`} onClick={() => onSort(coluna)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${ativo ? 'opacity-100' : 'opacity-30 group-hover:opacity-70'}`}>
          {ativo ? (
            ordenacao.dir === 'asc' ? <ArrowUp size={10} weight="bold" /> : <ArrowDown size={10} weight="bold" />
          ) : (
            <ArrowsDownUp size={10} weight="bold" />
          )}
        </span>
      </span>
    </th>
  );
};

// Multi-seleção de setores (mesmo padrão do filtro de despesas do /liberacao-pagamento)
const MultiSelectSetores = ({ opcoes, selecionadas, onChange }) => {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id) =>
    onChange(selecionadas.includes(id) ? selecionadas.filter((s) => s !== id) : [...selecionadas, id]);

  const nomeDe = (id) => opcoes.find((o) => o.id === id)?.nome || id;
  const labelBtn =
    selecionadas.length === 0
      ? 'Todos'
      : selecionadas.length === 1
        ? nomeDe(selecionadas[0])
        : `${selecionadas.length} setores`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((p) => !p)}
        className={`w-full flex items-center justify-between border rounded px-2 py-1.5 h-[30px] bg-white text-xs uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-[#000638] ${
          selecionadas.length > 0 ? 'border-[#000638] text-[#000638] font-bold' : 'border-gray-300 text-gray-500'
        }`}
      >
        <span className="truncate mr-1">{labelBtn}</span>
        <CaretDown size={10} weight="bold" className="shrink-0" />
      </button>
      {aberto && (
        <div className="absolute z-50 top-full mt-1 left-0 w-60 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100">
            <button
              type="button"
              onClick={() => onChange(opcoes.map((o) => o.id))}
              className={`px-3 py-1.5 ${T.flag} text-[#000638] hover:bg-blue-50`}
            >
              Marcar todos
            </button>
            {selecionadas.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className={`px-3 py-1.5 ${T.flag} text-red-500 hover:bg-red-50`}
              >
                Limpar
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {opcoes.map((op) => (
              <label
                key={op.id}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-gray-700 hover:bg-blue-50 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={selecionadas.includes(op.id)}
                  onChange={() => toggle(op.id)}
                  className="accent-[#000638] shrink-0 w-3.5 h-3.5"
                />
                <span className="flex-1 min-w-0 leading-snug break-words">{op.nome}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="bg-gray-50/60 border rounded-lg p-3">
    <p className={`${T.label} mb-2`}>{title}</p>
    <div className="space-y-1">{children}</div>
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-3 text-[11px] uppercase tracking-wide">
    <span className="text-gray-500">{label}</span>
    <span className="text-[#000638] text-right font-bold">{value || '--'}</span>
  </div>
);

// ──────────────────────────────────────────────
// Modal: detalhe do chamado (responder / encaminhar / concluir)
// ──────────────────────────────────────────────
function ChamadoModal({ id, meta, operador, onClose, onChanged, notify }) {
  const [detalhe, setDetalhe] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [prazoOrig, setPrazoOrig] = useState('');
  const [form, setForm] = useState({
    setor: '',
    prazo: '',
    prazo_justificativa: '',
    responsavel_nome: '',
    comentario: '',
    status: '',
  });

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const d = await apiJson(`${API}/chamados/${id}`);
      setDetalhe(d);
      const c = d.chamado;
      const prazoISO = c.prazo
        ? new Date(new Date(c.prazo).getTime() - new Date(c.prazo).getTimezoneOffset() * 60000).toISOString().slice(0, 10)
        : '';
      setPrazoOrig(prazoISO);
      setForm({
        setor: c.setor || '',
        prazo: prazoISO,
        prazo_justificativa: '',
        // sem responsável definido? já entra preenchido com quem a regra indica
        // (só é gravado quando o usuário salvar)
        responsavel_nome: c.responsavel_nome || c.responsavel_sugerido || '',
        comentario: '',
        status: '',
      });
    } catch (e) {
      setErro(e.message);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const enviar = async (patch, { reabrir = false, msg = 'Chamado atualizado' } = {}) => {
    setSalvando(true);
    setErro('');
    try {
      await apiJson(`${API}/chamados/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, por: operador }),
      });
      onChanged?.();
      notify?.('success', msg);
      if (reabrir) await carregar();
      else onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const prazoMudou = !!form.prazo && form.prazo !== prazoOrig;

  const salvar = () => {
    // o Dryland só aceita mudança de prazo com motivo (mín. 5 letras) — a loja lê
    // essa justificativa no chamado, então validamos aqui antes de mandar
    if (prazoMudou && form.prazo_justificativa.trim().length < 5) {
      setErro('Você está mudando o prazo: explique o motivo (mínimo 5 letras). A loja vê essa justificativa.');
      return;
    }
    const patch = { setor: form.setor, responsavel_nome: form.responsavel_nome || null };
    if (form.prazo) patch.prazo = form.prazo;
    if (prazoMudou) patch.prazo_justificativa = form.prazo_justificativa.trim();
    if (form.comentario.trim()) patch.comentario = form.comentario.trim();
    if (form.status) patch.status = form.status;
    enviar(patch, { msg: 'Alterações salvas' });
  };

  const comentar = () => {
    if (!form.comentario.trim() && !form.status) {
      setErro('Escreva um comentário ou escolha um status.');
      return;
    }
    const patch = {};
    if (form.comentario.trim()) patch.comentario = form.comentario.trim();
    if (form.status) patch.status = form.status;
    enviar(patch, { reabrir: true, msg: 'Comentário registrado' });
    setForm((f) => ({ ...f, comentario: '', status: '' }));
  };

  const concluir = () => enviar({ status: 'concluido' }, { msg: 'Chamado concluído' });

  const anexar = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      setSalvando(true);
      setErro('');
      try {
        const base64 = await new Promise((resolve, reject) => {
          const rd = new FileReader();
          rd.onload = () => resolve(rd.result);
          rd.onerror = reject;
          rd.readAsDataURL(f);
        });
        await apiJson(`${API}/chamados/${id}/anexo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64,
            content_type: f.type || 'image/jpeg',
            ext: (f.name.split('.').pop() || 'jpg').toLowerCase(),
            por: operador,
          }),
        });
        onChanged?.();
        notify?.('success', 'Foto anexada');
        await carregar();
      } catch (e) {
        setErro(e.message);
      } finally {
        setSalvando(false);
      }
    };
    inp.click();
  };

  const c = detalhe?.chamado;
  const setorInfo = (sid) => meta.setores.find((s) => s.id === sid);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center z-10">
          <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Ticket size={18} weight="bold" />
            {c ? `Chamado #${c.numero}` : 'Chamado'}
            {c && <span className="text-[10px] font-bold text-gray-300">· {c.loja_nome}</span>}
          </h3>
          <button onClick={onClose} className="text-white hover:text-red-300">
            <X size={22} weight="bold" />
          </button>
        </div>

        {!c ? (
          <div className="flex items-center justify-center py-20">
            {erro ? (
              <span className={`${T.btn} text-red-600 flex items-center gap-2`}>
                <Warning size={16} /> {erro}
              </span>
            ) : (
              <>
                <Spinner size={32} className="animate-spin text-[#000638]" />
                <span className={`ml-3 ${T.label}`}>Carregando chamado...</span>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-gray-800">{c.assunto}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={c.status} />
                  <DirecaoBadge direcao={c.direcao} />
                  <PrazoBadge chamado={c} />
                  <PrazoAltBadge chamado={c} />
                  {c.prazo_contestado && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-orange-300 bg-orange-100 text-orange-700 ${T.badge}`}>
                      <Warning size={11} weight="bold" /> Loja reclamou do prazo
                    </span>
                  )}
                </div>
              </div>

              {Number(c.prazo_alteracoes || 0) > 0 && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ClockCounterClockwise size={15} weight="bold" className="text-amber-700" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                      Prazo alterado {c.prazo_alteracoes}
                      {Number(c.prazo_alteracoes) > 1 ? ' vezes' : ' vez'}
                    </span>
                    {c.prazo_visto_loja === false && (
                      <span className={`px-2 py-0.5 rounded-full bg-red-600 text-white ${T.flag}`}>Loja ainda não viu</span>
                    )}
                    {c.prazo_alterado_em && (
                      <span className={`ml-auto ${T.flag} text-amber-700`}>
                        Última vez em {fmtDataHora(c.prazo_alterado_em)}
                      </span>
                    )}
                  </div>
                  {c.prazo_justificativa && (
                    <div className="mt-2 rounded border border-amber-200 bg-white px-3 py-2 text-[11px] uppercase tracking-wide text-amber-900">
                      <span className="font-bold">Motivo:</span> "{c.prazo_justificativa}"
                    </div>
                  )}
                </div>
              )}

              {c.prazo_contestado && (
                <div className="p-3 bg-orange-50 border-l-4 border-orange-400 text-orange-800 text-[11px] uppercase tracking-wide rounded">
                  A loja reclamou do prazo
                  {c.prazo_contestado_motivo ? `: "${c.prazo_contestado_motivo}"` : ''}. Defina um novo prazo abaixo e salve.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Section title="Informações">
                  <Row label="Loja" value={c.loja_nome} />
                  <Row label="Setor" value={setorInfo(c.setor)?.nome || c.setor} />
                  <Row label="Responsável" value={c.responsavel_nome} />
                  <Row label="Aberto por" value={c.aberto_por} />
                </Section>
                <Section title="Datas">
                  <Row label="Criado em" value={fmtDataHora(c.criado_em)} />
                  <Row label="Prazo" value={c.prazo ? fmtDataHora(c.prazo) : 'sem prazo'} />
                  <Row label="Idade" value={`${idadeDias(c)} dia(s)`} />
                </Section>
              </div>

              {c.texto && (
                <div className="border-2 border-gray-200 rounded-lg p-3">
                  <p className={`${T.label} mb-1`}>Descrição</p>
                  <p className="text-[11px] uppercase tracking-wide text-gray-700 whitespace-pre-wrap">{c.texto}</p>
                </div>
              )}

              {detalhe.anexos.length > 0 && (
                <div>
                  <p className={`${T.label} mb-1.5`}>Fotos anexadas ({detalhe.anexos.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {detalhe.anexos.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" title={a.por || ''}>
                        <img
                          src={a.url}
                          alt=""
                          className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:ring-2 hover:ring-[#000638] transition-shadow"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Responder / Encaminhar</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <ELabel>Encaminhar pro setor</ELabel>
                    <select value={form.setor} onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))} className={inpCls}>
                      {meta.setores.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <ELabel>Prazo</ELabel>
                    <input
                      type="date"
                      value={form.prazo}
                      onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                      className={`${inpCls} ${prazoMudou ? 'border-amber-400 bg-amber-50' : ''}`}
                    />
                  </div>
                  <div>
                    <ELabel>Responsável</ELabel>
                    <input
                      value={form.responsavel_nome}
                      onChange={(e) => setForm((f) => ({ ...f, responsavel_nome: e.target.value }))}
                      placeholder="quem vai resolver"
                      className={`${inpCls} ${c.responsavel_sugerido ? 'border-blue-300 bg-blue-50' : ''}`}
                    />
                    {c.responsavel_sugerido && (
                      <p className={`${T.flag} text-blue-600 mt-1`}>
                        Preenchido pela regra automática — salve para aplicar
                      </p>
                    )}
                  </div>
                  <div>
                    <ELabel>Status</ELabel>
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inpCls}>
                      <option value="">Manter ({STATUS_CONFIG[c.status]?.label || c.status})</option>
                      {meta.status.map((s) => (
                        <option key={s.id} value={s.id}>{STATUS_CONFIG[s.id]?.label || s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {prazoMudou && (
                  <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Warning size={13} weight="bold" className="text-amber-700" />
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                        Motivo da mudança de prazo (obrigatório)
                      </p>
                    </div>
                    <textarea
                      rows={2}
                      value={form.prazo_justificativa}
                      onChange={(e) => setForm((f) => ({ ...f, prazo_justificativa: e.target.value }))}
                      placeholder="por que o prazo mudou? (mínimo 5 letras)"
                      className={`${inpCls} resize-y border-amber-300`}
                    />
                    <p className={`${T.flag} text-amber-700 mt-1`}>
                      A loja lê esse motivo no chamado. Sem ele o Dryland não deixa mudar o prazo.
                    </p>
                  </div>
                )}

                <div>
                  <ELabel>Comentário / resposta (fica no histórico)</ELabel>
                  <textarea
                    rows={2}
                    value={form.comentario}
                    onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))}
                    placeholder="escreva uma atualização ou recado pra loja/setor"
                    className={`${inpCls} resize-y`}
                  />
                </div>
              </div>

              {erro && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-[11px] uppercase tracking-wide flex items-center gap-2 rounded">
                  <Warning size={16} /> {erro}
                </div>
              )}

              {detalhe.eventos.length > 0 && (
                <div>
                  <p className={`${T.label} mb-2`}>Histórico</p>
                  <div className="relative pl-5 space-y-3 max-h-64 overflow-y-auto border-l-2 border-gray-200 ml-1.5">
                    {detalhe.eventos.map((e, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[27px] mt-1 w-3 h-3 rounded-full border-2 border-white bg-[#000638]" />
                        <p className="text-[11px] uppercase tracking-wide text-gray-800 whitespace-pre-wrap">{e.texto || e.tipo || '--'}</p>
                        <p className={`${T.flag} text-gray-400`}>
                          {e.por || '--'} · {fmtDataHora(e.criado_em)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 border-t px-5 py-4 bg-gray-50 rounded-b-xl flex flex-wrap gap-2 justify-end items-center">
              <span className={`mr-auto ${T.flag} text-gray-400`}>
                registrando como <span className="text-gray-600">{operador}</span>
              </span>
              <button
                onClick={anexar}
                disabled={salvando}
                className={`flex items-center gap-1.5 px-3 py-1.5 ${T.btn} text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors`}
              >
                <Camera size={14} weight="bold" /> Anexar foto
              </button>
              <button
                onClick={comentar}
                disabled={salvando}
                className={`flex items-center gap-1.5 px-3 py-1.5 ${T.btn} text-[#000638] bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors`}
              >
                <ChatCircleText size={14} weight="bold" /> Comentar
              </button>
              <button
                onClick={concluir}
                disabled={salvando}
                className={`flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white ${T.btn} px-3 py-1.5 rounded-lg transition-colors`}
              >
                <CheckCircle size={14} weight="bold" /> Concluir
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className={`flex items-center gap-1.5 px-4 py-2 ${T.btn} bg-[#000638] text-white hover:bg-[#001060] disabled:opacity-60 rounded-lg transition-colors`}
              >
                {salvando ? <Spinner size={13} className="animate-spin" /> : <FloppyDisk size={13} weight="bold" />}
                Salvar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Modal: abrir chamado novo
// ──────────────────────────────────────────────
function NovoChamadoModal({ meta, operador, onClose, onCreated, notify }) {
  const setoresReais = meta.setores.filter((s) => s.id !== 'loja');
  const [form, setForm] = useState({
    loja_cd: String(meta.lojas[0]?.cd || ''),
    assunto: '',
    texto: '',
    setor: setoresReais.find((s) => s.id === 'tecnologia')?.id || setoresReais[0]?.id || 'tecnologia',
    direcao: 'loja',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    if (!form.assunto.trim()) {
      setErro('Dê um assunto ao chamado.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const r = await apiJson(`${API}/chamados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loja_cd: Number(form.loja_cd),
          assunto: form.assunto.trim(),
          texto: form.texto.trim() || null,
          setor: form.setor,
          direcao: form.direcao,
          por: operador,
        }),
      });
      notify?.(
        r?.aviso ? 'warning' : 'success',
        r?.aviso ||
          (r?.responsavel_aplicado
            ? `Chamado aberto · responsável: ${r.responsavel_aplicado}`
            : 'Chamado aberto'),
      );
      onCreated?.();
      onClose();
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center z-10">
          <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Plus size={18} weight="bold" />
            Abrir chamado
          </h3>
          <button onClick={onClose} className="text-white hover:text-red-300">
            <X size={22} weight="bold" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <ELabel>Loja</ELabel>
            <select value={form.loja_cd} onChange={(e) => setForm((f) => ({ ...f, loja_cd: e.target.value }))} className={inpCls}>
              {meta.lojas.map((l) => (
                <option key={l.cd} value={l.cd}>{l.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <ELabel>Assunto</ELabel>
            <input
              value={form.assunto}
              onChange={(e) => setForm((f) => ({ ...f, assunto: e.target.value }))}
              placeholder="ex: trocar lâmpada da vitrine"
              className={inpCls}
            />
          </div>
          <div>
            <ELabel>Detalhe</ELabel>
            <textarea
              rows={3}
              value={form.texto}
              onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
              className={`${inpCls} resize-y`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <ELabel>Setor que vai resolver</ELabel>
              <select value={form.setor} onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))} className={inpCls}>
                {setoresReais.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <ELabel>Direção</ELabel>
              <select value={form.direcao} onChange={(e) => setForm((f) => ({ ...f, direcao: e.target.value }))} className={inpCls}>
                <option value="adm">Cobrança (a loja tem que fazer)</option>
                <option value="loja">Pedido (o setor resolve)</option>
              </select>
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center gap-1.5">
              <UsersThree size={13} weight="bold" className="text-blue-700" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800">Responsável automático</p>
            </div>
            <p className={`${T.flag} text-blue-700 mt-1`}>
              Tecnologia vai pro Yago · Fiscal pra Niziany · Financeiro sobre depósito/caixa pro João
            </p>
          </div>
          {erro && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-[11px] uppercase tracking-wide flex items-center gap-2 rounded">
              <Warning size={16} /> {erro}
            </div>
          )}
        </div>
        <div className="border-t px-5 py-4 bg-gray-50 rounded-b-xl flex gap-2 justify-end">
          <button
            onClick={onClose}
            className={`px-3 py-1.5 ${T.btn} text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors`}
          >
            Cancelar
          </button>
          <button
            onClick={criar}
            disabled={salvando}
            className={`flex items-center gap-1.5 px-4 py-2 ${T.btn} bg-[#000638] text-white hover:bg-[#001060] disabled:opacity-60 rounded-lg transition-colors`}
          >
            {salvando ? <Spinner size={13} className="animate-spin" /> : <Plus size={13} weight="bold" />}
            Abrir chamado
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Modal: confirmar aplicação da regra nos chamados que já existem
// (escrita em lote no Dryland — sempre mostra o que vai mudar antes)
// ──────────────────────────────────────────────
function AplicarResponsaveisModal({ previa, operador, onClose, onAplicado, notify }) {
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState('');

  const aplicar = async () => {
    setAplicando(true);
    setErro('');
    try {
      const r = await apiJson(`${API}/chamados/aplicar-responsaveis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: false, por: operador }),
      });
      notify?.(
        r.falhas?.length ? 'warning' : 'success',
        `${r.aplicados?.length || 0} chamado(s) atualizados${r.falhas?.length ? ` · ${r.falhas.length} falharam` : ''}`,
      );
      onAplicado?.();
      onClose();
    } catch (e) {
      setErro(e.message);
      setAplicando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#000638] text-white p-4 rounded-t-xl flex justify-between items-center z-10">
          <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <UsersThree size={18} weight="bold" />
            Aplicar responsáveis
          </h3>
          <button onClick={onClose} className="text-white hover:text-red-300">
            <X size={22} weight="bold" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {previa.total === 0 ? (
            <p className="text-[11px] uppercase tracking-wide text-gray-600">
              Nenhum chamado em aberto está sem responsável. Não há nada para aplicar.
            </p>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wide text-gray-700">
                Vou definir o responsável em <b>{previa.total}</b> chamado(s) em aberto que hoje estão sem ninguém:
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(previa.por_responsavel || {}).map(([nome, qtd]) => (
                  <span key={nome} className={`px-2 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 ${T.badge}`}>
                    {nome}: {qtd}
                  </span>
                ))}
              </div>
              <div className="border-2 border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
                {(previa.chamados || []).map((c) => (
                  <div key={c.id} className="px-3 py-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wide">
                    <span className="font-bold text-[#000638]">#{c.numero}</span>
                    <span className="flex-1 min-w-0 truncate text-gray-700">{c.assunto}</span>
                    <span className={`px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 ${T.flag}`}>{c.responsavel}</span>
                  </div>
                ))}
              </div>
              <p className={`${T.flag} text-gray-500`}>
                Não mexe em chamado concluído, cancelado, nem em quem já tem responsável definido.
              </p>
            </>
          )}
          {erro && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-[11px] uppercase tracking-wide flex items-center gap-2 rounded">
              <Warning size={16} /> {erro}
            </div>
          )}
        </div>
        <div className="border-t px-5 py-4 bg-gray-50 rounded-b-xl flex gap-2 justify-end">
          <button onClick={onClose} className={`px-3 py-1.5 ${T.btn} text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors`}>
            {previa.total === 0 ? 'Fechar' : 'Cancelar'}
          </button>
          {previa.total > 0 && (
            <button
              onClick={aplicar}
              disabled={aplicando}
              className={`flex items-center gap-1.5 px-4 py-2 ${T.btn} bg-[#000638] text-white hover:bg-[#001060] disabled:opacity-60 rounded-lg transition-colors`}
            >
              {aplicando ? <Spinner size={13} className="animate-spin" /> : <CheckCircle size={13} weight="bold" />}
              Aplicar nos {previa.total}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────
export default function ChamadosDryland() {
  const { user } = useAuth() || {};
  const operador = user?.name || user?.email || 'headcoach';

  const [meta, setMeta] = useState(null);
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [notification, setNotification] = useState(null);
  const notify = useCallback((type, message) => setNotification({ type, message }), []);

  const [fLoja, setFLoja] = useState('');
  const [fSetores, setFSetores] = useState(SETORES_PADRAO);
  const [fStatus, setFStatus] = useState('abertos'); // abertos | todos | <status>
  const [fDirecao, setFDirecao] = useState('');
  const [fVenc, setFVenc] = useState(false);
  const [fRec, setFRec] = useState(false);
  const [fPrazoAlt, setFPrazoAlt] = useState(false);
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState({ coluna: 'prazo', dir: 'asc' });

  const [detalheId, setDetalheId] = useState(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [previaResp, setPreviaResp] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);

  // simula primeiro (não grava): o modal mostra exatamente o que vai mudar
  const abrirAplicarResponsaveis = async () => {
    setCarregandoPrevia(true);
    try {
      const previa = await apiJson(`${API}/chamados/aplicar-responsaveis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true }),
      });
      setPreviaResp(previa);
    } catch (e) {
      setNotification({ type: 'error', message: e.message });
    } finally {
      setCarregandoPrevia(false);
    }
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [m, lista] = await Promise.all([
        apiJson(`${API}/chamados/meta`),
        apiJson(`${API}/chamados`),
      ]);
      setMeta(m);
      setChamados(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const setorNome = useCallback(
    (id) => meta?.setores?.find((x) => x.id === id)?.nome || id || '?',
    [meta],
  );

  const temFiltroExtra =
    fLoja ||
    fDirecao ||
    fVenc ||
    fRec ||
    fPrazoAlt ||
    busca ||
    fStatus !== 'abertos' ||
    fSetores.length !== SETORES_PADRAO.length ||
    !SETORES_PADRAO.every((s) => fSetores.includes(s));

  const limparFiltros = () => {
    setFLoja('');
    setFSetores(SETORES_PADRAO);
    setFDirecao('');
    setFVenc(false);
    setFRec(false);
    setFPrazoAlt(false);
    setBusca('');
    setFStatus('abertos');
  };

  const ordenar = (coluna) =>
    setOrdenacao((o) => ({ coluna, dir: o.coluna === coluna && o.dir === 'asc' ? 'desc' : 'asc' }));

  // setor entra em TODA conta (KPI e tabela) — igual ao Dryland, que calcula os
  // cards em cima da lista já filtrada por setor
  const base = useMemo(
    () => (fSetores.length ? chamados.filter((c) => fSetores.includes(c.setor)) : chamados),
    [chamados, fSetores],
  );

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    const lista = base.filter((c) => {
      if (fStatus === 'abertos' && (c.status === 'concluido' || c.status === 'cancelado')) return false;
      if (fStatus !== 'abertos' && fStatus !== 'todos' && c.status !== fStatus) return false;
      if (fLoja && String(c.loja_cd) !== fLoja) return false;
      if (fDirecao && c.direcao !== fDirecao) return false;
      if (fVenc && !c.atrasado) return false;
      if (fRec && !c.prazo_contestado) return false;
      // mesma regra do card do Dryland: teve prazo empurrado e ainda não foi concluído
      if (fPrazoAlt && !(Number(c.prazo_alteracoes || 0) > 0 && c.status !== 'concluido')) return false;
      if (q && !`${c.assunto || ''} ${c.loja_nome || ''} ${c.responsavel_nome || ''} #${c.numero}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const { coluna, dir } = ordenacao;
    const mult = dir === 'asc' ? 1 : -1;
    const val = (c) => {
      switch (coluna) {
        case 'numero': return c.numero || 0;
        case 'loja': return c.loja_nome || '';
        case 'setor': return c.setor || '';
        case 'idade': return new Date(c.criado_em).getTime();
        case 'prazo':
        default: return new Date(c.prazo || '2099-01-01').getTime();
      }
    };
    return lista.sort((a, b) => {
      // vencidos sempre primeiro quando ordenado por prazo asc (padrão)
      if (coluna === 'prazo' && dir === 'asc') {
        const dv = (b.atrasado ? 1 : 0) - (a.atrasado ? 1 : 0);
        if (dv !== 0) return dv;
      }
      const va = val(a);
      const vb = val(b);
      if (typeof va === 'string') return va.localeCompare(vb) * mult;
      return (va - vb) * mult;
    });
  }, [base, fLoja, fStatus, fDirecao, fVenc, fRec, fPrazoAlt, busca, ordenacao]);

  const kpis = useMemo(() => {
    const ab = base.filter((c) => c.status !== 'concluido' && c.status !== 'cancelado');
    const lim = Date.now() - 7 * 86400000;
    return {
      abertos: ab.length,
      // igual ao card do Dryland: conta atrasado sem olhar status (inclui cancelados)
      vencidos: base.filter((c) => c.atrasado).length,
      reclamados: ab.filter((c) => c.prazo_contestado).length,
      // mesma fórmula do card "Prazo alterado" do Dryland: já teve o prazo
      // empurrado e ainda não foi concluído
      prazoAlterado: base.filter(
        (c) => Number(c.prazo_alteracoes || 0) > 0 && c.status !== 'concluido',
      ).length,
      concluidos7: base.filter(
        (c) => c.status === 'concluido' && new Date(c.atualizado_em || c.criado_em).getTime() >= lim,
      ).length,
    };
  }, [base]);

  const escopo =
    !meta || !fSetores.length
      ? 'Todos os setores'
      : fSetores.map((s) => setorNome(s)).join(' · ');

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <PageTitle
        title="CHAMADOS DRYLAND"
        subtitle="CHAMADOS DA REDE DE LOJAS EM TEMPO REAL — RESPONDA, ENCAMINHE, DÊ PRAZO E CONCLUA PELO HEADCOACH"
        icon={Ticket}
        iconColor="text-[#000638]"
      />

      {/* KPIs */}
      <div className="flex flex-wrap gap-3 mb-1.5">
        <CardStat
          label="Em aberto"
          value={kpis.abertos}
          cor="border-blue-200 text-blue-700"
          Icon={Tray}
          ativo={fStatus === 'abertos' && !fVenc && !fRec && !fPrazoAlt}
          onClick={() => { setFStatus('abertos'); setFVenc(false); setFRec(false); setFPrazoAlt(false); }}
        />
        <CardStat
          label="Vencidos"
          value={kpis.vencidos}
          cor="border-red-200 text-red-700"
          Icon={Clock}
          ativo={fVenc}
          onClick={() => {
            // liga o filtro em cima de TODOS os status pra tabela bater com o número do card
            if (fVenc) { setFVenc(false); setFStatus('abertos'); }
            else { setFVenc(true); setFStatus('todos'); setFRec(false); setFPrazoAlt(false); }
          }}
        />
        <CardStat
          label="Reclamados"
          value={kpis.reclamados}
          cor="border-orange-200 text-orange-700"
          Icon={Warning}
          ativo={fRec}
          onClick={() => { setFStatus('abertos'); setFRec((v) => !v); setFVenc(false); setFPrazoAlt(false); }}
        />
        <CardStat
          label="Prazo alterado"
          value={kpis.prazoAlterado}
          cor="border-amber-200 text-amber-700"
          Icon={ClockCounterClockwise}
          ativo={fPrazoAlt}
          onClick={() => {
            // 'todos' + o predicado do filtro (exclui concluídos) faz a tabela bater com o card
            if (fPrazoAlt) { setFPrazoAlt(false); setFStatus('abertos'); }
            else { setFPrazoAlt(true); setFStatus('todos'); setFVenc(false); setFRec(false); }
          }}
        />
        <CardStat
          label="Concluídos (7 dias)"
          value={kpis.concluidos7}
          cor="border-green-200 text-green-700"
          Icon={CheckCircle}
          ativo={fStatus === 'concluido'}
          onClick={() => { setFStatus('concluido'); setFVenc(false); setFRec(false); setFPrazoAlt(false); }}
        />
      </div>
      <p className={`${T.flag} text-gray-400 mb-4 px-1`}>
        Números do escopo: {escopo}
      </p>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Funnel size={14} weight="bold" className="text-[#000638]" />
            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">Filtros</span>
            {temFiltroExtra && (
              <span className={`bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ${T.flag}`}>Ativos</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {temFiltroExtra && (
              <button
                onClick={limparFiltros}
                className={`flex items-center gap-1 ${T.flag} text-red-500 hover:text-red-700`}
              >
                <X size={11} weight="bold" /> Limpar filtros
              </button>
            )}
            <button
              onClick={abrirAplicarResponsaveis}
              disabled={carregandoPrevia}
              title="Define o responsável automático nos chamados em aberto que estão sem ninguém"
              className={`flex items-center gap-1 px-3 py-1.5 ${T.btn} text-[#000638] bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors`}
            >
              {carregandoPrevia ? <Spinner size={14} className="animate-spin" /> : <UsersThree size={14} weight="bold" />}
              Aplicar responsáveis
            </button>
            <button
              onClick={carregar}
              className={`flex items-center gap-1 px-3 py-1.5 ${T.btn} text-[#000638] bg-white border rounded-lg hover:bg-gray-50 transition-colors`}
            >
              <ArrowClockwise size={14} weight="bold" />
              Atualizar
            </button>
            <button
              onClick={() => setNovoAberto(true)}
              className={`flex items-center gap-1.5 bg-[#000638] hover:bg-[#001060] text-white ${T.btn} px-4 py-2 rounded-lg transition-colors`}
            >
              <Plus size={14} weight="bold" />
              Abrir chamado
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="flex flex-col gap-1">
            <label className={T.label}>
              Setores
              {fSetores.length > 0 && (
                <span className="ml-1 text-[9px] bg-[#000638] text-white px-1 py-0.5 rounded-full">{fSetores.length}</span>
              )}
            </label>
            <MultiSelectSetores opcoes={meta?.setores || []} selecionadas={fSetores} onChange={setFSetores} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={T.label}>Loja</label>
            <select value={fLoja} onChange={(e) => setFLoja(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {(meta?.lojas || []).map((l) => (
                <option key={l.cd} value={l.cd}>{l.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={T.label}>Status</label>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={inputCls}>
              <option value="abertos">Em aberto (todos)</option>
              <option value="todos">Todos (inclui resolvidos)</option>
              {(meta?.status || []).map((s) => (
                <option key={s.id} value={s.id}>{STATUS_CONFIG[s.id]?.label || s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={T.label}>Direção</label>
            <select value={fDirecao} onChange={(e) => setFDirecao(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              <option value="adm">Cobrança (adm cobra a loja)</option>
              <option value="loja">Pedido (loja pede)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <label className={T.label}>Busca</label>
            <div className="relative">
              <MagnifyingGlass size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="assunto, loja, responsável ou número"
                className={`${inputCls} w-full pl-7`}
              />
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-4">
          <label className={`flex items-center gap-1.5 ${T.flag} text-gray-600 cursor-pointer`}>
            <input type="checkbox" checked={fVenc} onChange={(e) => setFVenc(e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#000638]" />
            Só vencidos
          </label>
          <label className={`flex items-center gap-1.5 ${T.flag} text-gray-600 cursor-pointer`}>
            <input type="checkbox" checked={fRec} onChange={(e) => setFRec(e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#000638]" />
            Só com reclamação de prazo
          </label>
          <label className={`flex items-center gap-1.5 ${T.flag} text-gray-600 cursor-pointer`}>
            <input type="checkbox" checked={fPrazoAlt} onChange={(e) => setFPrazoAlt(e.target.checked)} className="w-3.5 h-3.5 cursor-pointer accent-[#000638]" />
            Só com prazo alterado
          </label>
          <span className={`ml-auto ${T.flag} text-gray-400`}>
            {filtrados.length} chamado(s) encontrado(s)
          </span>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size={32} className="animate-spin text-[#000638]" />
            <span className={`ml-3 ${T.label}`}>Carregando chamados...</span>
          </div>
        ) : erro ? (
          <div className="p-5 bg-red-50 border-l-4 border-red-500 text-red-700 text-[11px] uppercase tracking-wide flex items-center gap-2">
            <Warning size={16} /> {erro}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ClipboardText size={48} className="mx-auto mb-3" />
            <p className={T.btn}>Nenhum chamado encontrado</p>
            <p className={`${T.flag} mt-1`}>Ajuste os filtros ou clique em atualizar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#000638] text-white sticky top-0">
                <tr>
                  <ThSortable label="Nº" coluna="numero" ordenacao={ordenacao} onSort={ordenar} className="w-16" />
                  <th className={`${T.th} w-24`}>Direção</th>
                  <th className={T.th}>Assunto</th>
                  <ThSortable label="Loja" coluna="loja" ordenacao={ordenacao} onSort={ordenar} className="w-32" />
                  <ThSortable label="Setor" coluna="setor" ordenacao={ordenacao} onSort={ordenar} className="w-32" />
                  <th className={`${T.th} w-32`}>Responsável</th>
                  <th className={`${T.th} w-36`}>Status</th>
                  <ThSortable label="Prazo" coluna="prazo" ordenacao={ordenacao} onSort={ordenar} className="w-24" />
                  <ThSortable label="Idade" coluna="idade" ordenacao={ordenacao} onSort={ordenar} className="w-16" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setDetalheId(c.id)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      c.atrasado
                        ? 'border-l-2 border-l-red-500 bg-red-50/60 hover:bg-red-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className={`${T.td} font-bold text-[#000638]`}>#{c.numero}</td>
                    <td className="px-2 py-2"><DirecaoBadge direcao={c.direcao} /></td>
                    <td className={`${T.td} font-bold text-gray-800`}>
                      {c.assunto}
                      {c.prazo_contestado && (
                        <span className={`ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300 ${T.flag}`}>
                          <Warning size={8} weight="bold" /> Reclamou
                        </span>
                      )}
                      <PrazoAltBadge chamado={c} className="ml-1.5" />
                    </td>
                    <td className={`${T.td} whitespace-nowrap`}>{c.loja_nome}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 ${T.badge}`}>
                        {setorNome(c.setor)}
                      </span>
                    </td>
                    <td className={`${T.td} whitespace-nowrap`}>
                      {c.responsavel_nome ? (
                        c.responsavel_nome
                      ) : c.responsavel_sugerido ? (
                        <span
                          title="Sugerido pela regra automática — abra o chamado e salve para aplicar"
                          className="text-gray-400 italic"
                        >
                          {c.responsavel_sugerido} (sugerido)
                        </span>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap"><StatusBadge status={c.status} /></td>
                    <td className="px-2 py-2 whitespace-nowrap"><PrazoBadge chamado={c} /></td>
                    <td className={`${T.td} whitespace-nowrap text-gray-500`}>{idadeDias(c)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detalheId && meta && (
        <ChamadoModal
          id={detalheId}
          meta={meta}
          operador={operador}
          onClose={() => setDetalheId(null)}
          onChanged={carregar}
          notify={notify}
        />
      )}
      {novoAberto && meta && (
        <NovoChamadoModal
          meta={meta}
          operador={operador}
          onClose={() => setNovoAberto(false)}
          onCreated={carregar}
          notify={notify}
        />
      )}
      {previaResp && (
        <AplicarResponsaveisModal
          previa={previaResp}
          operador={operador}
          onClose={() => setPreviaResp(null)}
          onAplicado={carregar}
          notify={notify}
        />
      )}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
