// Página: Financeiro → Contas a Pagar → WhatsApp
// Controle da instância "CONTAS A PAGAR" da uazapi (techcrosby) pelo HeadCoach:
//   - Conexão: status, QR code / código de pareamento, desconectar (admin)
//   - Enviar: texto ou arquivo (PDF, imagem...) para um número ou grupo
//   - Conversas: lista de chats da instância e histórico de um chat, com resposta rápida
//   - Verificar: quais números têm WhatsApp
//   - Webhook (admin): eventos da instância → HeadCoach
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WhatsappLogo,
  ArrowsClockwise,
  Spinner,
  CheckCircle,
  XCircle,
  Warning,
  PaperPlaneTilt,
  Paperclip,
  ChatsCircle,
  MagnifyingGlass,
  QrCode,
  Plugs,
  PlugsConnected,
  UsersThree,
  User,
  DownloadSimple,
  WebhooksLogo as Webhook,
  Trash,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';
import { useAuth } from '../components/AuthContext';
import { apiJson } from '../utils/apiAuth';
import { API_BASE_URL } from '../config/constants';

const fmtDt = (v) => (v ? new Date(v).toLocaleString('pt-BR') : '—');
const fmtHora = (v) => (v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const btn = 'inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrim = `${btn} bg-[#000638] text-white hover:bg-[#1a2060]`;
const btnVerde = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;
const btnSec = `${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;
const btnPerigo = `${btn} border border-rose-300 bg-white text-rose-700 hover:bg-rose-50`;
const inputCls = 'h-8 px-2 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30';
const areaCls = 'w-full p-2 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#000638]/30';

const TABS = [
  { id: 'enviar', label: 'Enviar', icon: PaperPlaneTilt },
  { id: 'conversas', label: 'Conversas', icon: ChatsCircle },
  { id: 'verificar', label: 'Verificar número', icon: MagnifyingGlass },
  { id: 'webhook', label: 'Webhook', icon: Webhook, admin: true },
];

const STATUS_LABEL = {
  connected: { txt: 'Conectado', cor: 'emerald', Icon: CheckCircle },
  connecting: { txt: 'Conectando', cor: 'amber', Icon: Spinner },
  disconnected: { txt: 'Desconectado', cor: 'rose', Icon: XCircle },
  hibernated: { txt: 'Hibernada', cor: 'amber', Icon: Warning },
  nao_configurado: { txt: 'Não configurado', cor: 'gray', Icon: Warning },
};

function Card({ title, value, sub, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70">{title}</div>
      <div className="text-base font-bold leading-tight mt-0.5 truncate" title={typeof value === 'string' ? value : undefined}>{value}</div>
      {sub && <div className="text-[11px] opacity-70 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function qrSrc(qr) {
  if (!qr) return null;
  return qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
}

const fmtTelefone = (n) => {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith('55')) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return n || '—';
};

const lerArquivoBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    r.readAsDataURL(file);
  });

const tipoPorMime = (mime) => {
  if (!mime) return 'document';
  if (mime.startsWith('image/') && mime !== 'image/gif') return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
};

export default function WhatsAppContasPagar() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'owner'].includes(user?.role);
  const [tab, setTab] = useState('enviar');
  const [status, setStatus] = useState(null);
  const [erro, setErro] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [auto, setAuto] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiJson('/api/whatsapp-cp/status');
      setStatus(data);
      setErro(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // enquanto conectando (QR na tela) atualiza a cada 5 s; senão a cada 30 s
  useEffect(() => {
    if (!auto) return undefined;
    const ms = status?.status === 'connecting' || status?.qrcode ? 5000 : 30000;
    const t = setInterval(carregar, ms);
    return () => clearInterval(t);
  }, [auto, carregar, status?.status, status?.qrcode]);

  const aviso = (texto, tipo = 'ok') => {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(null), 6000);
  };

  const acao = async (fn, sucesso) => {
    try {
      const r = await fn();
      aviso(sucesso || r?.message || 'OK');
      carregar();
      return r;
    } catch (e) {
      aviso(e.message, 'erro');
      return null;
    }
  };

  const st = STATUS_LABEL[status?.status] || STATUS_LABEL.disconnected;
  const conectado = Boolean(status?.conectado);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4">
      <PageTitle
        title="WhatsApp Contas a Pagar"
        subtitle="Instância CONTAS A PAGAR (uazapi): conexão, envio de mensagens e arquivos, conversas e verificação de números"
        icon={WhatsappLogo}
        iconColor="text-emerald-600"
      />

      {msg && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-semibold ${msg.tipo === 'erro' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg.texto}
        </div>
      )}
      {erro && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
          <Warning size={14} /> {erro}
        </div>
      )}

      <ConexaoPainel status={status} st={st} isAdmin={isAdmin} loading={loading} auto={auto} setAuto={setAuto} carregar={carregar} acao={acao} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {TABS.filter((t) => !t.admin || isAdmin).map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`${btn} ${tab === t.id ? 'bg-[#000638] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'enviar' && <TabEnviar conectado={conectado} aviso={aviso} />}
      {tab === 'conversas' && <TabConversas conectado={conectado} aviso={aviso} />}
      {tab === 'verificar' && <TabVerificar aviso={aviso} />}
      {tab === 'webhook' && isAdmin && <TabWebhook aviso={aviso} />}
    </div>
  );
}

// ─── Conexão ───────────────────────────────────────────────────────────────
function ConexaoPainel({ status, st, isAdmin, loading, auto, setAuto, carregar, acao }) {
  const [phone, setPhone] = useState('');
  const [conectando, setConectando] = useState(false);
  const [resultadoConexao, setResultadoConexao] = useState(null);
  const StIcon = st.Icon;
  const qr = qrSrc(resultadoConexao?.qrcode || status?.qrcode);
  const paircode = resultadoConexao?.paircode || status?.paircode;

  useEffect(() => {
    if (status?.conectado) setResultadoConexao(null);
  }, [status?.conectado]);

  const conectar = async () => {
    setConectando(true);
    const r = await acao(() => apiJson('/api/whatsapp-cp/conectar', { method: 'POST', body: phone ? { phone } : {} }), phone ? 'Código de pareamento gerado' : 'QR code gerado — leia no celular');
    if (r?.data) setResultadoConexao(r.data);
    setConectando(false);
  };

  const desconectar = async () => {
    if (!window.confirm('Desconectar a instância CONTAS A PAGAR do WhatsApp? Será preciso ler o QR code de novo.')) return;
    await acao(() => apiJson('/api/whatsapp-cp/desconectar', { method: 'POST' }), 'Instância desconectada');
  };

  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Card
          title="Conexão"
          tone={st.cor}
          value={
            <span className="inline-flex items-center gap-1">
              <StIcon size={16} className={st.txt === 'Conectando' ? 'animate-spin' : ''} /> {st.txt}
            </span>
          }
          sub={status?.motivoDesconexao && !status?.conectado ? status.motivoDesconexao : status?.jid ? `jid ${status.jid}` : null}
        />
        <Card title="Número" value={fmtTelefone(status?.numero)} sub={status?.instancia?.plataform ? `aparelho ${status.instancia.plataform}` : null} tone="blue" />
        <Card title="Perfil" value={status?.nome || '—'} sub={status?.instancia?.isBusiness ? 'conta business' : 'conta comum'} />
        <Card title="Instância" value={status?.instancia?.name || status?.instancia || '—'} sub={status?.baseUrl ? status.baseUrl.replace(/^https?:\/\//, '') : null} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && !status?.conectado && status?.status !== 'nao_configurado' && (
          <>
            <input className={inputCls} placeholder="telefone p/ código (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: 200 }} />
            <button type="button" className={btnVerde} onClick={conectar} disabled={conectando}>
              {conectando ? <Spinner size={14} className="animate-spin" /> : <QrCode size={14} />} {phone ? 'Gerar código' : 'Gerar QR code'}
            </button>
          </>
        )}
        {isAdmin && status?.conectado && (
          <button type="button" className={btnPerigo} onClick={desconectar}>
            <Plugs size={14} /> Desconectar
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] text-gray-500 flex items-center gap-1">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> auto
          </label>
          <button type="button" onClick={carregar} className={btnSec} disabled={loading}>
            {loading ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />} Atualizar
          </button>
        </div>
      </div>

      {!status?.conectado && (qr || paircode) && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col md:flex-row items-center gap-4">
          {qr && <img src={qr} alt="QR code do WhatsApp" className="w-56 h-56 rounded-lg bg-white p-2 border" />}
          <div className="text-xs text-amber-900">
            {paircode && (
              <div className="mb-2">
                Código de pareamento: <span className="font-mono text-lg font-bold tracking-widest">{paircode}</span>
              </div>
            )}
            <div className="font-semibold mb-1">Como conectar</div>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>No celular do Contas a Pagar, abra o WhatsApp → Configurações → Aparelhos conectados.</li>
              <li>Toque em “Conectar um aparelho” {paircode ? 'e em “Conectar com número de telefone”' : 'e leia o QR code'}.</li>
              <li>A página atualiza sozinha quando a conexão concluir.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Enviar ────────────────────────────────────────────────────────────────
function TabEnviar({ conectado, aviso }) {
  const [number, setNumber] = useState('');
  const [text, setText] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [caption, setCaption] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [historico, setHistorico] = useState([]);
  const fileRef = useRef(null);

  const registrar = (item) => setHistorico((h) => [{ em: new Date().toISOString(), ...item }, ...h].slice(0, 20));

  const enviarTexto = async () => {
    setEnviando(true);
    try {
      await apiJson('/api/whatsapp-cp/enviar/texto', { method: 'POST', body: { number, text } });
      aviso('Mensagem enviada');
      registrar({ tipo: 'texto', number, resumo: text.slice(0, 80), ok: true });
      setText('');
    } catch (e) {
      aviso(e.message, 'erro');
      registrar({ tipo: 'texto', number, resumo: text.slice(0, 80), ok: false, erro: e.message });
    } finally {
      setEnviando(false);
    }
  };

  const enviarArquivo = async () => {
    if (!arquivo) return aviso('Escolha um arquivo', 'erro');
    if (arquivo.size > 40 * 1024 * 1024) return aviso('Arquivo acima de 40 MB', 'erro');
    setEnviando(true);
    try {
      const file = await lerArquivoBase64(arquivo);
      const type = tipoPorMime(arquivo.type);
      await apiJson('/api/whatsapp-cp/enviar/midia', {
        method: 'POST',
        body: { number, type, file, text: caption || undefined, docName: type === 'document' ? arquivo.name : undefined, mimetype: arquivo.type || undefined },
        timeoutMs: 180000,
      });
      aviso('Arquivo enviado');
      registrar({ tipo: type, number, resumo: arquivo.name, ok: true });
      setArquivo(null);
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      aviso(e.message, 'erro');
      registrar({ tipo: 'arquivo', number, resumo: arquivo.name, ok: false, erro: e.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        {!conectado && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 flex items-center gap-2">
            <Warning size={14} /> A instância não está conectada — os envios vão falhar até ler o QR code.
          </div>
        )}
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Destinatário (telefone com DDD ou id de grupo)</label>
          <input className={`${inputCls} w-full`} placeholder="84 99999-9999 ou 1203634...@g.us" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mensagem de texto</label>
          <textarea className={areaCls} rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite a mensagem…" />
          <div className="flex justify-end mt-2">
            <button type="button" className={btnPrim} onClick={enviarTexto} disabled={enviando || !number.trim() || !text.trim()}>
              {enviando ? <Spinner size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} />} Enviar texto
            </button>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-3">
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Arquivo (PDF, imagem, planilha… até 40 MB)</label>
          <input ref={fileRef} type="file" className="text-xs" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
          <input className={`${inputCls} w-full mt-2`} placeholder="legenda (opcional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
          <div className="flex justify-end mt-2">
            <button type="button" className={btnVerde} onClick={enviarArquivo} disabled={enviando || !number.trim() || !arquivo}>
              {enviando ? <Spinner size={14} className="animate-spin" /> : <Paperclip size={14} />} Enviar arquivo
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">Envios desta sessão</div>
        {historico.length === 0 && <div className="text-[11px] text-gray-400">Nenhum envio ainda.</div>}
        <ul className="space-y-2">
          {historico.map((h, i) => (
            <li key={i} className="text-[11px] border-b border-gray-100 pb-1">
              <div className="flex items-center gap-1">
                {h.ok ? <CheckCircle size={12} className="text-emerald-600" /> : <XCircle size={12} className="text-rose-600" />}
                <span className="font-semibold">{h.tipo}</span> → {h.number} <span className="text-gray-400 ml-auto">{fmtHora(h.em)}</span>
              </div>
              <div className="text-gray-600 truncate">{h.resumo}</div>
              {h.erro && <div className="text-rose-600 truncate">{h.erro}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Conversas ─────────────────────────────────────────────────────────────
function TabConversas({ conectado, aviso }) {
  const [chats, setChats] = useState([]);
  const [paginacao, setPaginacao] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [naoLidas, setNaoLidas] = useState(false);
  const [semGrupos, setSemGrupos] = useState(false);
  const [busca, setBusca] = useState('');
  const [chatSel, setChatSel] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef(null);

  const carregarChats = useCallback(
    async (offset = 0, acumular = false) => {
      setCarregando(true);
      try {
        const { data } = await apiJson(`/api/whatsapp-cp/chats?limit=50&offset=${offset}&naoLidas=${naoLidas}&grupos=${!semGrupos}`);
        setChats((prev) => (acumular ? [...prev, ...data.chats] : data.chats));
        setPaginacao(data.paginacao);
      } catch (e) {
        aviso(e.message, 'erro');
      } finally {
        setCarregando(false);
      }
    },
    [naoLidas, semGrupos, aviso],
  );

  useEffect(() => {
    carregarChats(0);
  }, [carregarChats]);

  const carregarMensagens = useCallback(
    async (chat) => {
      if (!chat) return;
      setCarregandoMsgs(true);
      try {
        const { data } = await apiJson(`/api/whatsapp-cp/mensagens?chatid=${encodeURIComponent(chat.chatid)}&limit=60`);
        setMensagens([...data.mensagens].reverse());
        setTimeout(() => fimRef.current?.scrollIntoView({ block: 'end' }), 50);
      } catch (e) {
        aviso(e.message, 'erro');
      } finally {
        setCarregandoMsgs(false);
      }
    },
    [aviso],
  );

  const selecionar = (chat) => {
    setChatSel(chat);
    setMensagens([]);
    carregarMensagens(chat);
  };

  const responder = async () => {
    if (!chatSel || !resposta.trim()) return;
    setEnviando(true);
    try {
      await apiJson('/api/whatsapp-cp/enviar/texto', { method: 'POST', body: { number: chatSel.chatid, text: resposta } });
      setResposta('');
      aviso('Mensagem enviada');
      setTimeout(() => carregarMensagens(chatSel), 1500);
    } catch (e) {
      aviso(e.message, 'erro');
    } finally {
      setEnviando(false);
    }
  };

  const baixar = async (m) => {
    try {
      if (m.arquivo) return window.open(m.arquivo, '_blank');
      const { data } = await apiJson('/api/whatsapp-cp/mensagens/download', { method: 'POST', body: { id: m.id } });
      if (data?.url) window.open(data.url, '_blank');
      else aviso('Arquivo indisponível', 'erro');
    } catch (e) {
      aviso(e.message, 'erro');
    }
    return null;
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => String(c.nome || '').toLowerCase().includes(q) || String(c.telefone || '').includes(q));
  }, [chats, busca]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 480 }}>
      <div className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <input className={`${inputCls} flex-1`} placeholder="buscar nome / telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button type="button" className={btnSec} onClick={() => carregarChats(0)} disabled={carregando} title="Atualizar">
            {carregando ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
          </button>
        </div>
        <div className="flex items-center gap-3 mb-2 text-[11px] text-gray-600">
          <label className="flex items-center gap-1"><input type="checkbox" checked={naoLidas} onChange={(e) => setNaoLidas(e.target.checked)} /> só não lidas</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={semGrupos} onChange={(e) => setSemGrupos(e.target.checked)} /> sem grupos</label>
          {paginacao?.totalRecords != null && <span className="ml-auto text-gray-400">{paginacao.totalRecords} chats</span>}
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-100" style={{ maxHeight: 520 }}>
          {filtrados.map((c) => (
            <li key={c.chatid}>
              <button type="button" onClick={() => selecionar(c)} className={`w-full text-left px-2 py-2 hover:bg-gray-50 ${chatSel?.chatid === c.chatid ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center gap-2">
                  {c.grupo ? <UsersThree size={16} className="text-gray-400 shrink-0" /> : <User size={16} className="text-gray-400 shrink-0" />}
                  <span className="text-xs font-semibold truncate flex-1">{c.nome}</span>
                  {c.naoLidas > 0 && <span className="text-[10px] bg-emerald-600 text-white rounded-full px-1.5 py-0.5 font-bold">{c.naoLidas}</span>}
                </div>
                <div className="flex items-center text-[11px] text-gray-500 mt-0.5">
                  <span className="truncate flex-1">{c.telefone ? fmtTelefone(c.telefone) : c.ultimaMensagemTipo || ''}</span>
                  <span className="ml-2 shrink-0">{c.ultimaMensagemEm ? fmtDt(c.ultimaMensagemEm) : ''}</span>
                </div>
              </button>
            </li>
          ))}
          {!carregando && filtrados.length === 0 && <li className="text-[11px] text-gray-400 px-2 py-4">Nenhuma conversa.</li>}
        </ul>
        {paginacao?.hasMore && (
          <button type="button" className={`${btnSec} mt-2 justify-center`} onClick={() => carregarChats(paginacao.nextOffset, true)} disabled={carregando}>
            carregar mais
          </button>
        )}
      </div>

      <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-3 flex flex-col">
        {!chatSel && <div className="text-[11px] text-gray-400 flex-1 flex items-center justify-center">Selecione uma conversa à esquerda.</div>}
        {chatSel && (
          <>
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-2">
              {chatSel.grupo ? <UsersThree size={18} className="text-gray-500" /> : <User size={18} className="text-gray-500" />}
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{chatSel.nome}</div>
                <div className="text-[11px] text-gray-500 truncate">{chatSel.chatid}</div>
              </div>
              <button type="button" className={`${btnSec} ml-auto`} onClick={() => carregarMensagens(chatSel)} disabled={carregandoMsgs}>
                {carregandoMsgs ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 px-1" style={{ maxHeight: 440 }}>
              {mensagens.map((m) => (
                <div key={m.id} className={`flex ${m.deMim ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs ${m.deMim ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-100 text-gray-800'}`}>
                    {!m.deMim && chatSel.grupo && m.remetente && <div className="text-[10px] font-semibold text-gray-500">{m.remetente}</div>}
                    {m.texto && <div className="whitespace-pre-wrap break-words">{m.texto}</div>}
                    {m.temMidia && (
                      <button type="button" onClick={() => baixar(m)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold underline">
                        <DownloadSimple size={12} /> {m.nomeArquivo || m.tipo || 'arquivo'}
                      </button>
                    )}
                    {!m.texto && !m.temMidia && <div className="italic text-gray-500">[{m.tipo || 'mensagem'}]</div>}
                    <div className="text-[10px] text-gray-500 text-right mt-0.5">{fmtDt(m.em)}{m.trackSource === 'headcoach' ? ' · via HeadCoach' : ''}</div>
                  </div>
                </div>
              ))}
              <div ref={fimRef} />
            </div>
            <div className="flex items-center gap-2 border-t border-gray-100 pt-2 mt-2">
              <input
                className={`${inputCls} flex-1`}
                placeholder={conectado ? 'Responder…' : 'instância desconectada'}
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    responder();
                  }
                }}
                disabled={!conectado}
              />
              <button type="button" className={btnPrim} onClick={responder} disabled={enviando || !resposta.trim() || !conectado}>
                {enviando ? <Spinner size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Verificar ─────────────────────────────────────────────────────────────
function TabVerificar({ aviso }) {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const verificar = async () => {
    const numbers = texto.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!numbers.length) return aviso('Informe ao menos um número', 'erro');
    setCarregando(true);
    try {
      const { data } = await apiJson('/api/whatsapp-cp/verificar', { method: 'POST', body: { numbers } });
      setResultado(data);
    } catch (e) {
      aviso(e.message, 'erro');
    } finally {
      setCarregando(false);
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Números (um por linha, até 50)</label>
        <textarea className={areaCls} rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'84 99999-9999\n85 98888-7777'} />
        <div className="flex justify-end mt-2">
          <button type="button" className={btnPrim} onClick={verificar} disabled={carregando}>
            {carregando ? <Spinner size={14} className="animate-spin" /> : <MagnifyingGlass size={14} />} Verificar
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[11px] text-gray-500 border-b">
              <th className="py-1">Número</th>
              <th className="py-1">WhatsApp</th>
              <th className="py-1">JID</th>
            </tr>
          </thead>
          <tbody>
            {resultado.map((r) => (
              <tr key={r.consulta} className="border-b border-gray-100">
                <td className="py-1">{fmtTelefone(r.consulta)}</td>
                <td className="py-1">
                  {r.noWhatsapp ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle size={12} /> sim</span> : <span className="inline-flex items-center gap-1 text-rose-700 font-semibold"><XCircle size={12} /> não</span>}
                </td>
                <td className="py-1 text-gray-500 font-mono text-[11px]">{r.jid || r.erro || '—'}</td>
              </tr>
            ))}
            {resultado.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-[11px] text-gray-400">Nenhuma verificação ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Webhook (admin) ───────────────────────────────────────────────────────
const EVENTOS_WEBHOOK = ['messages', 'messages_update', 'connection', 'presence', 'chats', 'contacts', 'groups', 'labels', 'leads', 'call', 'history'];

function TabWebhook({ aviso }) {
  const [lista, setLista] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [url, setUrl] = useState(`${API_BASE_URL}/api/whatsapp-cp/webhook/receber`);
  const [sel, setSel] = useState(['messages', 'connection']);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [w, e] = await Promise.all([apiJson('/api/whatsapp-cp/webhooks'), apiJson('/api/whatsapp-cp/eventos?limit=30')]);
      setLista(w.data || []);
      setEventos(e.data?.eventos || []);
    } catch (err) {
      aviso(err.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }, [aviso]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async () => {
    try {
      await apiJson('/api/whatsapp-cp/webhooks', { method: 'POST', body: { action: 'add', url, events: sel, enabled: true } });
      aviso('Webhook cadastrado');
      carregar();
    } catch (e) {
      aviso(e.message, 'erro');
    }
  };

  const remover = async (w) => {
    if (!window.confirm(`Remover o webhook ${w.url}?`)) return;
    try {
      await apiJson('/api/whatsapp-cp/webhooks', { method: 'POST', body: { action: 'delete', id: w.id } });
      aviso('Webhook removido');
      carregar();
    } catch (e) {
      aviso(e.message, 'erro');
    }
  };

  const alternar = (ev) => setSel((s) => (s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-700">Webhooks da instância</div>
          <button type="button" className={btnSec} onClick={carregar} disabled={carregando}>
            {carregando ? <Spinner size={14} className="animate-spin" /> : <ArrowsClockwise size={14} />}
          </button>
        </div>
        {lista.length === 0 && <div className="text-[11px] text-gray-400">Nenhum webhook cadastrado — a uazapi não envia eventos ao HeadCoach.</div>}
        <ul className="space-y-1">
          {lista.map((w) => (
            <li key={w.id} className="text-[11px] border border-gray-100 rounded-lg px-2 py-1 flex items-center gap-2">
              {w.enabled ? <PlugsConnected size={14} className="text-emerald-600" /> : <Plugs size={14} className="text-gray-400" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono">{w.url}</div>
                <div className="text-gray-500">{(w.events || []).join(', ') || 'todos os eventos'}</div>
              </div>
              <button type="button" className={btnPerigo} onClick={() => remover(w)} title="Remover"><Trash size={12} /></button>
            </li>
          ))}
        </ul>
        <div className="border-t border-gray-100 pt-3">
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Nova URL de destino</label>
          <input className={`${inputCls} w-full font-mono`} value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="flex flex-wrap gap-2 mt-2">
            {EVENTOS_WEBHOOK.map((ev) => (
              <label key={ev} className="text-[11px] flex items-center gap-1">
                <input type="checkbox" checked={sel.includes(ev)} onChange={() => alternar(ev)} /> {ev}
              </label>
            ))}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Se WHATSAPP_CP_WEBHOOK_SECRET estiver definido no backend, acrescente ?s=SEGREDO na URL.</div>
          <div className="flex justify-end mt-2">
            <button type="button" className={btnPrim} onClick={salvar} disabled={!url.trim()}><Webhook size={14} /> Cadastrar</button>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">Últimos eventos recebidos pelo HeadCoach</div>
        {eventos.length === 0 && <div className="text-[11px] text-gray-400">Nenhum evento ainda (buffer em memória do backend).</div>}
        <ul className="space-y-1 max-h-[480px] overflow-y-auto">
          {eventos.map((e, i) => (
            <li key={i} className="text-[11px] border-b border-gray-100 pb-1">
              <span className="font-semibold">{e.tipo}</span> <span className="text-gray-400">{fmtDt(e.recebidoEm)}</span>
              <pre className="text-[10px] text-gray-600 whitespace-pre-wrap break-all max-h-24 overflow-hidden">{JSON.stringify(e.payload).slice(0, 400)}</pre>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
