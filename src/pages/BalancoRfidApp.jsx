// Balanço RFID — tela do APP ANDROID (coletor Urovo DT50 + pistola RFDT50).
//
// O app "Balanço RFID" é uma casca: abre esta página numa WebView (login
// normal do HeadCoach) e expõe window.HeadcoachRfid para falar com a pistola.
// Respostas chegam pelo evento "headcoach-rfid" em window:
//   { tipo: 'status' | 'tags' | 'gatilho' | 'potencia' | 'bluetooth', ... }
//
// Fluxo: escolher a loja → conectar o leitor → INICIAR → PAUSAR → FINALIZAR
// (salva "ARQUIVO BALANÇO LOJA X DATA HORA" em /balanco-rfid/arquivos).
// A contagem em andamento fica guardada no aparelho (localStorage) e sobrevive
// a fechar o app ou cair a internet.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Broadcast,
  Play,
  Pause,
  CheckCircle,
  Spinner,
  Warning,
  BatteryHigh,
  BatteryLow,
  BluetoothConnected,
  PlugsConnected,
  SignOut,
  ArrowsClockwise,
  Trash,
  DownloadSimple,
  Storefront,
} from '@phosphor-icons/react';
import { API_BASE_URL } from '../config/constants';
import { useAuth } from '../components/AuthContext';
import { getUserCompanies } from '../services/userCompaniesService';

const URL_APK = 'https://dorztqiunewggydvkjnf.supabase.co/storage/v1/object/public/pdv-updates/balanco-rfid/Balanco-RFID.apk';
const MODULO = { 0: 'encaixada', 1: 'separada', 2: 'ligando', 3: 'desligada' };

const ponte = () => (typeof window !== 'undefined' ? window.HeadcoachRfid : null);
const fmtTempo = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
const novoId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

let audioCtx = null;
function bip() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 2400;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.04);
  } catch {
    /* sem áudio */
  }
}

export default function BalancoRfidApp() {
  const { user, logout } = useAuth();
  const temPonte = !!ponte();
  const modoTeste = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('teste');
  const chave = `balanco_rfid_rascunho_${user?.id || 'anon'}`;

  // lojas do usuário
  const [lojas, setLojas] = useState([]);
  const [empresa, setEmpresa] = useState('');

  // leitor
  const [leitor, setLeitor] = useState({ conectado: false, conectando: false, lendo: false });
  const [potencia, setPotencia] = useState({ atual: null, max: null });
  const [bt, setBt] = useState(null); // { dispositivos, erro } | null

  // contagem
  const mapa = useRef(new Map()); // epc -> leituras
  const [qtd, setQtd] = useState(0);
  const [leituras, setLeituras] = useState(0);
  const [ultimas, setUltimas] = useState([]);
  const [iniciadoEm, setIniciadoEm] = useState(null);
  const [acumuladoMs, setAcumuladoMs] = useState(0);
  const inicioTrecho = useRef(null);
  const [agora, setAgora] = useState(Date.now());
  const clientId = useRef(null);

  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(null);
  const [msg, setMsg] = useState(null);
  const ultimoBip = useRef(0);

  const lendo = !!leitor.lendo;
  const tempoMs = acumuladoMs + (lendo && inicioTrecho.current ? agora - inicioTrecho.current : 0);
  const lojaSel = lojas.find((l) => String(l.cd_empresa) === String(empresa));

  // ─── rascunho no aparelho ──────────────────────────────────────────────
  const salvarRascunho = useCallback(() => {
    try {
      localStorage.setItem(
        chave,
        JSON.stringify({
          empresa,
          epcs: Object.fromEntries(mapa.current),
          leituras,
          iniciadoEm,
          acumuladoMs: acumuladoMs + (inicioTrecho.current ? Date.now() - inicioTrecho.current : 0),
          clientId: clientId.current,
        }),
      );
    } catch {
      /* armazenamento cheio/indisponível */
    }
  }, [chave, empresa, leituras, iniciadoEm, acumuladoMs]);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(chave) || 'null');
      if (r && r.epcs && Object.keys(r.epcs).length) {
        mapa.current = new Map(Object.entries(r.epcs));
        setQtd(mapa.current.size);
        setLeituras(r.leituras || mapa.current.size);
        setIniciadoEm(r.iniciadoEm || null);
        setAcumuladoMs(r.acumuladoMs || 0);
        clientId.current = r.clientId || novoId();
        if (r.empresa) setEmpresa(String(r.empresa));
        setMsg({ tipo: 'ok', texto: `Contagem anterior recuperada: ${mapa.current.size} peça(s). Toque em INICIAR para continuar.` });
      }
    } catch {
      /* rascunho inválido */
    }
  }, [chave]);

  // grava a cada 3 s enquanto lê
  useEffect(() => {
    if (!lendo) return undefined;
    const t = setInterval(() => {
      setAgora(Date.now());
    }, 1000);
    const s = setInterval(salvarRascunho, 3000);
    return () => {
      clearInterval(t);
      clearInterval(s);
    };
  }, [lendo, salvarRascunho]);

  // ─── lojas ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [rb, emp] = await Promise.all([
          fetch(`${API_BASE_URL}/api/totvs/branches`).then((r) => r.json()),
          ['owner', 'admin'].includes(user?.role) || !user?.id ? Promise.resolve({ data: null }) : getUserCompanies(user.id),
        ]);
        let lista = (rb?.data?.data || []).filter((b) => b.cd_empresa);
        const permitidas = (emp?.data || []).map(String);
        if (permitidas.length) lista = lista.filter((b) => permitidas.includes(String(b.cd_empresa)));
        setLojas(lista);
        setEmpresa((atual) => {
          if (atual && lista.some((l) => String(l.cd_empresa) === String(atual))) return atual;
          return lista.length === 1 ? String(lista[0].cd_empresa) : localStorage.getItem('balanco_rfid_loja') || '';
        });
      } catch {
        setMsg({ tipo: 'erro', texto: 'Não consegui carregar as lojas. Confira a internet.' });
      }
    })();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (empresa) localStorage.setItem('balanco_rfid_loja', empresa);
  }, [empresa]);

  // ─── eventos do app ────────────────────────────────────────────────────
  const iniciar = useCallback(() => {
    if (!empresa) return setMsg({ tipo: 'erro', texto: 'Escolha a loja antes de iniciar.' });
    if (!clientId.current) clientId.current = novoId();
    if (!iniciadoEm) setIniciadoEm(new Date().toISOString());
    setSalvo(null);
    setMsg(null);
    ponte()?.iniciar();
    return null;
  }, [empresa, iniciadoEm]);

  const pausar = useCallback(() => {
    ponte()?.pausar();
  }, []);

  const leitorRef = useRef(leitor);
  leitorRef.current = leitor;
  const iniciarRef = useRef(iniciar);
  iniciarRef.current = iniciar;

  const receberTags = useCallback((tags) => {
    let novas = 0;
    let soma = 0;
    const novasEpcs = [];
    for (const t of tags) {
      const atual = mapa.current.get(t.e);
      if (atual == null) {
        novas++;
        novasEpcs.push(t.e);
      }
      mapa.current.set(t.e, (atual || 0) + (t.c || 1));
      soma += t.c || 1;
    }
    setLeituras((l) => l + soma);
    if (novas) {
      setQtd(mapa.current.size);
      setUltimas((u) => [...novasEpcs.reverse(), ...u].slice(0, 15));
      const agoraMs = Date.now();
      if (agoraMs - ultimoBip.current > 120) {
        ultimoBip.current = agoraMs;
        bip();
      }
    }
  }, []);

  useEffect(() => {
    const ouvir = (ev) => {
      const d = ev.detail || {};
      if (d.tipo === 'tags') receberTags(d.tags || []);
      else if (d.tipo === 'status' || d.tipo === 'potencia') {
        setLeitor((prev) => {
          // início/fim de um trecho de leitura → cronômetro
          if (d.lendo && !prev.lendo) inicioTrecho.current = Date.now();
          if (!d.lendo && prev.lendo && inicioTrecho.current) {
            const trecho = Date.now() - inicioTrecho.current;
            inicioTrecho.current = null;
            setAcumuladoMs((a) => a + trecho);
          }
          return { ...prev, ...d };
        });
        if (d.potencia != null) setPotencia({ atual: d.potencia, max: d.potenciaMax ?? null });
      } else if (d.tipo === 'gatilho') {
        if (d.apertado) {
          // gatilho alterna iniciar / pausar
          if (leitorRef.current.lendo) ponte()?.pausar();
          else iniciarRef.current();
        }
      } else if (d.tipo === 'bluetooth') setBt({ dispositivos: d.dispositivos || [], erro: d.erro || null });
    };
    window.addEventListener('headcoach-rfid', ouvir);
    return () => window.removeEventListener('headcoach-rfid', ouvir);
  }, [receberTags]);

  // estado inicial do app + conecta sozinho na pistola encaixada
  useEffect(() => {
    const p = ponte();
    if (!p) return;
    try {
      setLeitor((prev) => ({ ...prev, ...JSON.parse(p.info()) }));
    } catch {
      /* versão antiga do app */
    }
    p.conectar();
  }, []);

  useEffect(() => {
    if (leitor.conectado) ponte()?.potencia();
  }, [leitor.conectado]);

  // pausou → grava o rascunho
  useEffect(() => {
    if (!lendo && qtd) salvarRascunho();
  }, [lendo, qtd, salvarRascunho]);

  // ─── finalizar ─────────────────────────────────────────────────────────
  const finalizar = async () => {
    if (lendo) return;
    if (!qtd) return setMsg({ tipo: 'erro', texto: 'Nenhuma peça lida.' });
    if (!window.confirm(`Finalizar o balanço da loja ${empresa} com ${qtd} peça(s)?`)) return null;
    setSalvando(true);
    setMsg(null);
    try {
      const corpo = {
        clientId: clientId.current || novoId(),
        empresa: Number(empresa),
        empresaNome: lojaSel?.nm_grupoempresa || null,
        usuario: { id: user?.id || null, nome: user?.name || null, email: user?.email || null },
        iniciadoEm,
        finalizadoEm: new Date().toISOString(),
        duracaoSeg: Math.round(tempoMs / 1000),
        epcs: [...mapa.current.keys()],
        qtdLeituras: leituras,
        dispositivo: {
          modelo: leitor.modelo || null,
          app: leitor.versao || null,
          sdk: leitor.sdk || null,
          modo: leitor.modo || null,
          potencia: potencia.atual,
        },
      };
      const r = await fetch(`${API_BASE_URL}/api/balanco-rfid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.message || 'Falha ao salvar');
      setSalvo(j.data);
      ponte()?.vibrar?.(120);
      // zera a contagem
      localStorage.removeItem(chave);
      mapa.current = new Map();
      clientId.current = null;
      setQtd(0);
      setLeituras(0);
      setUltimas([]);
      setIniciadoEm(null);
      setAcumuladoMs(0);
    } catch (e) {
      setMsg({ tipo: 'erro', texto: `Não salvou (${e.message}). A contagem continua guardada no aparelho — tente de novo.` });
    } finally {
      setSalvando(false);
    }
    return null;
  };

  const descartar = () => {
    if (lendo || !qtd) return;
    if (!window.confirm(`Descartar a contagem atual (${qtd} peça(s))? Isso não pode ser desfeito.`)) return;
    localStorage.removeItem(chave);
    mapa.current = new Map();
    clientId.current = null;
    setQtd(0);
    setLeituras(0);
    setUltimas([]);
    setIniciadoEm(null);
    setAcumuladoMs(0);
    setMsg(null);
  };

  // modo teste (navegador, ?teste=1): simula leituras
  const simular = () => {
    const tags = Array.from({ length: 25 }, () => ({
      e: `3035E1916400${Math.floor(Math.random() * 0xfffff).toString(16).toUpperCase().padStart(5, '0')}${Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(7, '0')}`.slice(0, 24),
      c: 1 + Math.floor(Math.random() * 3),
    }));
    if (!clientId.current) clientId.current = novoId();
    if (!iniciadoEm) setIniciadoEm(new Date().toISOString());
    receberTags(tags);
  };

  const statusLeitor = useMemo(() => {
    if (!temPonte) return { cor: 'bg-gray-100 text-gray-600 ring-gray-200', texto: 'Sem leitor (navegador)' };
    if (leitor.conectando) return { cor: 'bg-amber-50 text-amber-700 ring-amber-200', texto: 'Conectando…' };
    if (leitor.lendo) return { cor: 'bg-emerald-50 text-emerald-700 ring-emerald-200', texto: 'Lendo' };
    if (leitor.conectado) return { cor: 'bg-blue-50 text-blue-700 ring-blue-200', texto: 'Conectado' };
    return { cor: 'bg-rose-50 text-rose-700 ring-rose-200', texto: 'Desconectado' };
  }, [temPonte, leitor]);

  const opcoesPotencia = useMemo(() => {
    const max = Number(potencia.max) || 30;
    const lista = [];
    for (let p = 5; p <= max; p += 1) lista.push(p);
    return lista;
  }, [potencia.max]);

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      {/* topo */}
      <div className="bg-[#000638] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Broadcast size={22} weight="bold" />
        <div className="flex-1 min-w-0">
          <p className="font-bold leading-tight">Balanço RFID</p>
          <p className="text-[11px] text-white/70 truncate">{user?.name || user?.email}</p>
        </div>
        <button onClick={() => logout?.()} className="p-2 rounded-lg hover:bg-white/10" title="Sair">
          <SignOut size={20} />
        </button>
      </div>

      <div className="max-w-md mx-auto px-3 pt-3 space-y-3">
        {!temPonte && (
          <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-sm text-amber-800">
            <p className="font-semibold">Abra esta tela pelo app Balanço RFID no coletor Urovo.</p>
            <a href={URL_APK} className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-amber-600 text-white text-xs font-bold">
              <DownloadSimple size={14} weight="bold" /> Baixar o app (Android)
            </a>
          </div>
        )}

        {/* loja */}
        <div className="bg-white rounded-xl ring-1 ring-gray-200 p-3">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Loja do balanço</label>
          <div className="relative">
            <Storefront size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              disabled={lendo || qtd > 0}
              className="w-full h-12 pl-10 pr-2 mb-0 rounded-lg border border-gray-300 bg-white text-base disabled:bg-gray-50"
            >
              <option value="">Selecione a loja…</option>
              {lojas.map((l) => (
                <option key={l.cd_empresa} value={l.cd_empresa}>
                  {l.cd_empresa} — {l.nm_grupoempresa}
                </option>
              ))}
            </select>
          </div>
          {qtd > 0 && !lendo && <p className="mt-1 text-[11px] text-gray-400">Para trocar de loja, finalize ou descarte a contagem atual.</p>}
        </div>

        {/* leitor */}
        <div className="bg-white rounded-xl ring-1 ring-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Leitor RFID</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 text-xs font-semibold ${statusLeitor.cor}`}>
              {leitor.conectando ? <Spinner size={12} className="animate-spin" /> : null}
              {statusLeitor.texto}
            </span>
          </div>
          {temPonte && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
              {leitor.modo && <span>{leitor.modo === 'bluetooth' ? 'via Bluetooth' : 'pistola encaixada'}</span>}
              {leitor.moduloStatus >= 0 && <span>pistola {MODULO[leitor.moduloStatus] || leitor.moduloStatus}</span>}
              {leitor.bateria >= 0 && (
                <span className="inline-flex items-center gap-1">
                  {leitor.bateria < 20 ? <BatteryLow size={14} className="text-rose-600" /> : <BatteryHigh size={14} className="text-emerald-600" />}
                  {leitor.bateria}%{leitor.carregando ? ' (carregando)' : ''}
                </span>
              )}
            </div>
          )}
          {leitor.erro && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg p-2 ring-1 ring-rose-200">{leitor.erro}</p>}
          {temPonte && !leitor.conectado && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => ponte()?.conectar()} disabled={leitor.conectando} className="h-11 rounded-lg bg-[#000638] text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                <PlugsConnected size={16} weight="bold" /> Conectar
              </button>
              <button onClick={() => ponte()?.listarBluetooth()} disabled={leitor.conectando} className="h-11 rounded-lg ring-1 ring-gray-300 text-[#000638] text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                <BluetoothConnected size={16} /> Bluetooth
              </button>
            </div>
          )}
          {bt && !leitor.conectado && (
            <div className="rounded-lg ring-1 ring-gray-200 divide-y divide-gray-100">
              {bt.erro && <p className="p-2 text-xs text-rose-700">{bt.erro}</p>}
              {!bt.erro && bt.dispositivos.length === 0 && <p className="p-2 text-xs text-gray-500">Nenhum aparelho pareado. Pareie a pistola nas configurações de Bluetooth do coletor.</p>}
              {bt.dispositivos.map((d) => (
                <button key={d.mac} onClick={() => ponte()?.conectarBluetooth(d.mac)} className="w-full text-left p-2.5 text-sm hover:bg-gray-50">
                  <span className="font-semibold text-[#000638]">{d.nome}</span> <span className="text-xs text-gray-400 font-mono">{d.mac}</span>
                </button>
              ))}
            </div>
          )}
          {temPonte && leitor.conectado && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Potência</label>
              <select
                value={potencia.atual ?? ''}
                onChange={(e) => ponte()?.definirPotencia(Number(e.target.value))}
                disabled={lendo}
                className="h-9 px-2 mb-0 rounded-lg border border-gray-300 bg-white text-sm w-auto"
              >
                {potencia.atual == null && <option value="">—</option>}
                {opcoesPotencia.map((p) => (
                  <option key={p} value={p}>
                    {p} dBm{p <= 12 ? ' (perto)' : p >= 26 ? ' (longe)' : ''}
                  </option>
                ))}
              </select>
              <button onClick={() => ponte()?.desconectar()} disabled={lendo} className="ml-auto text-xs text-gray-500 underline disabled:opacity-40">
                desconectar
              </button>
            </div>
          )}
        </div>

        {/* contador */}
        <div className="bg-white rounded-xl ring-1 ring-gray-200 p-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Peças lidas</p>
          <p className={`text-6xl font-black tabular-nums leading-none mt-1 ${lendo ? 'text-emerald-600' : 'text-[#000638]'}`}>{qtd.toLocaleString('pt-BR')}</p>
          <p className="mt-2 text-xs text-gray-500 tabular-nums">
            {leituras.toLocaleString('pt-BR')} leituras · {fmtTempo(tempoMs)}
            {lendo && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse align-middle" />}
          </p>
        </div>

        {/* botões */}
        <div className="grid grid-cols-2 gap-2">
          {lendo ? (
            <button onClick={pausar} className="col-span-2 h-16 rounded-xl bg-amber-500 text-white text-lg font-black inline-flex items-center justify-center gap-2 active:scale-[0.99]">
              <Pause size={24} weight="fill" /> PAUSAR
            </button>
          ) : (
            <>
              <button
                onClick={iniciar}
                disabled={!empresa || (temPonte && !leitor.conectado) || salvando}
                className="h-16 rounded-xl bg-emerald-600 text-white text-lg font-black inline-flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99]"
              >
                <Play size={22} weight="fill" /> {qtd ? 'CONTINUAR' : 'INICIAR'}
              </button>
              <button
                onClick={finalizar}
                disabled={!qtd || salvando}
                className="h-16 rounded-xl bg-[#000638] text-white text-lg font-black inline-flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99]"
              >
                {salvando ? <Spinner size={22} className="animate-spin" /> : <CheckCircle size={22} weight="fill" />} FINALIZAR
              </button>
            </>
          )}
        </div>
        {temPonte && <p className="text-center text-[11px] text-gray-400">O gatilho da pistola também inicia e pausa.</p>}
        {modoTeste && !temPonte && (
          <button onClick={simular} className="w-full h-10 rounded-lg ring-1 ring-dashed ring-gray-400 text-xs text-gray-600">
            Simular 25 leituras (modo teste)
          </button>
        )}

        {msg && (
          <p className={`text-sm rounded-xl p-3 ring-1 ${msg.tipo === 'erro' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
            {msg.tipo === 'erro' && <Warning size={14} weight="bold" className="inline mr-1 -mt-0.5" />}
            {msg.texto}
          </p>
        )}

        {salvo && (
          <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-center">
            <CheckCircle size={36} weight="fill" className="mx-auto text-emerald-500" />
            <p className="mt-1 font-bold text-emerald-800">Balanço salvo!</p>
            <p className="text-sm text-emerald-800">{salvo.nome}</p>
            <p className="text-xs text-emerald-700">{salvo.qtd_epcs?.toLocaleString('pt-BR')} peça(s) · disponível em HeadCoach → Balanço RFID</p>
          </div>
        )}

        {/* últimas peças */}
        {ultimas.length > 0 && (
          <div className="bg-white rounded-xl ring-1 ring-gray-200 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Últimas peças</p>
            <ul className="space-y-0.5">
              {ultimas.map((e) => (
                <li key={e} className="font-mono text-[11px] text-gray-600 truncate">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {qtd > 0 && !lendo && (
          <button onClick={descartar} className="w-full text-xs text-rose-600 inline-flex items-center justify-center gap-1 py-2">
            <Trash size={13} /> Descartar contagem
          </button>
        )}

        <div className="flex items-center justify-center gap-3 text-[11px] text-gray-400 pt-2">
          <span>{temPonte ? `app ${leitor.versao || '?'}${leitor.sdk ? ` · SDK ${leitor.sdk}` : ''}` : 'navegador'}</span>
          {temPonte && (
            <button onClick={() => ponte()?.verificarAtualizacao()} className="inline-flex items-center gap-1 underline">
              <ArrowsClockwise size={11} /> verificar atualização
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
