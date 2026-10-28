// PROCURAR EPC (app Balanço RFID): localiza uma etiqueta pela força do sinal.
//
// Liga a leitura normal da pistola e só olha para o EPC procurado: o RSSI
// (dBm) de cada lote vira uma porcentagem de proximidade (-80 dBm = 0%,
// -30 dBm = 100%), suavizada, com bipe mais rápido e mais agudo quanto mais
// perto — tipo detector de metal. As leituras daqui NÃO entram no balanço
// (a página do balanço desvia os lotes enquanto a busca está aberta).
import React, { useEffect, useRef, useState } from 'react';
import { MagnifyingGlass, Play, Pause, X, SpeakerHigh, SpeakerSlash, Warning } from '@phosphor-icons/react';

const ponte = () => (typeof window !== 'undefined' ? window.HeadcoachRfid : null);

const RSSI_LONGE = -80;
const RSSI_PERTO = -30;
const SUMIU_MS = 1500; // sem ver a etiqueta por esse tempo → 0%

// Bluebird manda dBm com sinal ("-54.8"); por segurança aceita o valor sem
// sinal ou em décimos de dBm, que alguns SDKs usam.
function paraDbm(r) {
  let v = Number(r);
  if (!Number.isFinite(v) || v === 0) return null;
  if (Math.abs(v) > 200) v /= 10;
  return v > 0 ? -v : v;
}

const porcentagem = (dbm) => Math.round(Math.max(0, Math.min(1, (dbm - RSSI_LONGE) / (RSSI_PERTO - RSSI_LONGE))) * 100);

const limparEpc = (s) => String(s || '').toUpperCase().replace(/[^0-9A-F]/g, '');

let audioCtx = null;
function bipe(freq, ms) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.12;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + ms / 1000);
  } catch {
    /* sem áudio */
  }
}

function faixa(pct, visto) {
  if (!visto) return { texto: 'PROCURANDO…', cor: '#9ca3af', fundo: 'bg-gray-50' };
  if (pct >= 85) return { texto: 'MUITO PERTO', cor: '#059669', fundo: 'bg-emerald-50' };
  if (pct >= 60) return { texto: 'PERTO', cor: '#16a34a', fundo: 'bg-green-50' };
  if (pct >= 35) return { texto: 'CHEGANDO', cor: '#d97706', fundo: 'bg-amber-50' };
  return { texto: 'LONGE', cor: '#e11d48', fundo: 'bg-rose-50' };
}

export default function ProcurarEpcModal({ epcInicial = '', leitor, potencia, opcoesPotencia, temPonte, modoTeste, onFechar }) {
  const [texto, setTexto] = useState(limparEpc(epcInicial));
  const [alvo, setAlvo] = useState(null); // EPC (ou trecho) procurado, depois de LIGAR
  const [som, setSom] = useState(true);
  const [pct, setPct] = useState(0);
  const [dbm, setDbm] = useState(null);
  const [leituras, setLeituras] = useState(0);
  const [visto, setVisto] = useState(false);
  const [achados, setAchados] = useState([]); // EPCs que bateram com o trecho digitado
  const [erro, setErro] = useState(null);

  const sinal = useRef(null); // dBm suavizado
  const ultimoVisto = useRef(0);
  const alvoRef = useRef(null);
  const pctRef = useRef(0);
  const somRef = useRef(true);
  const achadosRef = useRef(new Set());
  const vibrouPerto = useRef(false);
  alvoRef.current = alvo;
  somRef.current = som;

  const ligado = modoTeste && !temPonte ? !!alvo : !!leitor.lendo && !!alvo;

  // lotes de etiquetas e gatilho
  useEffect(() => {
    const bate = (e) => {
      const a = alvoRef.current;
      if (!a) return false;
      return a.length >= 24 ? e === a : e.includes(a);
    };
    const ouvir = (ev) => {
      const d = ev.detail || {};
      if (d.tipo === 'tags') {
        let melhor = null;
        let n = 0;
        for (const t of d.tags || []) {
          if (!bate(t.e)) continue;
          n += t.c || 1;
          const v = paraDbm(t.r);
          if (v != null && (melhor == null || v > melhor)) melhor = v;
          if (!achadosRef.current.has(t.e)) {
            achadosRef.current.add(t.e);
            setAchados([...achadosRef.current]);
          }
        }
        if (!n) return;
        ultimoVisto.current = Date.now();
        setLeituras((x) => x + n);
        setVisto(true);
        if (melhor != null) {
          // sobe rápido, desce devagar: o número não fica pulando
          const s = sinal.current;
          sinal.current = s == null ? melhor : melhor > s ? s * 0.4 + melhor * 0.6 : s * 0.75 + melhor * 0.25;
          setDbm(Math.round(sinal.current));
        }
      } else if (d.tipo === 'gatilho' && d.apertado) {
        document.getElementById('procurar-epc-ligar')?.click();
      }
    };
    window.addEventListener('headcoach-rfid', ouvir);
    return () => window.removeEventListener('headcoach-rfid', ouvir);
  }, []);

  // porcentagem: segue o sinal e cai para 0 quando a etiqueta some
  useEffect(() => {
    if (!ligado) return undefined;
    const t = setInterval(() => {
      const sumiu = Date.now() - ultimoVisto.current > SUMIU_MS;
      let p = sinal.current == null ? 0 : porcentagem(sinal.current);
      if (sumiu) {
        p = Math.max(0, Math.round(pctRef.current * 0.8) - 1);
        if (p === 0) {
          sinal.current = null;
          setVisto(false);
          setDbm(null);
        }
      }
      pctRef.current = p;
      setPct(p);
      if (p >= 90 && !vibrouPerto.current) {
        vibrouPerto.current = true;
        ponte()?.vibrar?.(200);
      } else if (p < 70) vibrouPerto.current = false;
    }, 120);
    return () => clearInterval(t);
  }, [ligado]);

  // bipe: mais rápido e mais agudo quanto mais perto
  useEffect(() => {
    if (!ligado) return undefined;
    let vivo = true;
    let timer;
    const tocar = () => {
      if (!vivo) return;
      const p = pctRef.current;
      if (p > 0 && somRef.current) bipe(700 + p * 18, p >= 90 ? 70 : 45);
      timer = setTimeout(tocar, p > 0 ? Math.max(70, 900 - p * 8.3) : 300);
    };
    tocar();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [ligado]);

  // modo teste no navegador: etiqueta "andando" perto/longe
  useEffect(() => {
    if (!(modoTeste && !temPonte && alvo)) return undefined;
    let fase = 0;
    const t = setInterval(() => {
      fase += 0.15;
      const r = -55 + Math.sin(fase) * 25 + (Math.random() - 0.5) * 6;
      if (Math.sin(fase * 0.5) < -0.8) return; // some de vez em quando
      window.dispatchEvent(
        new CustomEvent('headcoach-rfid', {
          detail: { tipo: 'tags', tags: [{ e: alvo.length >= 24 ? alvo : '3035E1916400000000000000'.slice(0, 24 - alvo.length) + alvo, c: 3, r: Math.round(r) }] },
        }),
      );
    }, 300);
    return () => clearInterval(t);
  }, [modoTeste, temPonte, alvo]);

  const zerar = () => {
    sinal.current = null;
    ultimoVisto.current = 0;
    pctRef.current = 0;
    achadosRef.current = new Set();
    setAchados([]);
    setPct(0);
    setDbm(null);
    setLeituras(0);
    setVisto(false);
  };

  const ligar = () => {
    if (ligado) {
      if (temPonte) ponte()?.pausar();
      else setAlvo(null);
      return;
    }
    const e = limparEpc(texto);
    if (e.length < 4) return setErro('Digite o EPC (pelo menos os 4 últimos dígitos).');
    if (temPonte && !leitor.conectado) return setErro('Conecte o leitor antes de procurar.');
    if (!temPonte && !modoTeste) return setErro('Abra pelo app Balanço RFID para procurar.');
    setErro(null);
    if (e !== alvo) zerar();
    setAlvo(e);
    alvoRef.current = e;
    if (temPonte) ponte()?.iniciar();
    return null;
  };

  const trocarPotencia = (v) => {
    const p = ponte();
    if (!p) return;
    // a pistola não aceita mudar a potência lendo: pausa, ajusta e volta
    if (leitor.lendo) {
      p.pausar();
      p.definirPotencia(v);
      p.iniciar();
    } else p.definirPotencia(v);
  };

  const f = faixa(pct, visto);
  const raio = 88;
  const volta = 2 * Math.PI * raio;

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 overflow-y-auto">
      <div className="bg-[#000638] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <MagnifyingGlass size={22} weight="bold" />
        <p className="flex-1 font-bold">Procurar EPC</p>
        <button onClick={onFechar} className="p-2 rounded-lg hover:bg-white/10" title="Fechar">
          <X size={20} weight="bold" />
        </button>
      </div>

      <div className="max-w-md mx-auto px-3 pt-3 pb-8 space-y-3">
        <div className="bg-white rounded-xl ring-1 ring-gray-200 p-3">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Código EPC da etiqueta</label>
          <input
            value={texto}
            onChange={(e) => setTexto(limparEpc(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && !ligado && ligar()}
            disabled={ligado}
            placeholder="Ex.: 3035E191640CA3000000007B"
            maxLength={32}
            spellCheck={false}
            autoCapitalize="characters"
            className="w-full h-12 px-3 mb-0 rounded-lg border border-gray-300 font-mono text-base tracking-wide disabled:bg-gray-50"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            {texto.length}/24 · pode digitar só o final do código (mínimo 4 dígitos).
          </p>
          {erro && (
            <p className="mt-2 text-xs text-rose-700 bg-rose-50 rounded-lg p-2 ring-1 ring-rose-200">
              <Warning size={13} weight="bold" className="inline mr-1 -mt-0.5" />
              {erro}
            </p>
          )}
        </div>

        {/* medidor */}
        <div className={`rounded-xl ring-1 ring-gray-200 p-4 text-center ${f.fundo}`}>
          <div className="relative mx-auto w-[220px] h-[220px]">
            <svg viewBox="0 0 220 220" className="w-full h-full -rotate-90">
              <circle cx="110" cy="110" r={raio} fill="none" stroke="#e5e7eb" strokeWidth="18" />
              <circle
                cx="110"
                cy="110"
                r={raio}
                fill="none"
                stroke={f.cor}
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray={volta}
                strokeDashoffset={volta * (1 - pct / 100)}
                style={{ transition: 'stroke-dashoffset 120ms linear, stroke 200ms' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl font-black tabular-nums leading-none" style={{ color: ligado ? f.cor : '#9ca3af' }}>
                {pct}
                <span className="text-3xl">%</span>
              </span>
              <span className="mt-1 text-sm font-black tracking-wide" style={{ color: f.cor }}>
                {ligado ? f.texto : 'DESLIGADO'}
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 tabular-nums">
            {dbm != null ? `sinal ${dbm} dBm · ` : ''}
            {leituras.toLocaleString('pt-BR')} leitura(s) da etiqueta
          </p>
          {ligado && !visto && <p className="mt-1 text-xs text-gray-500">Ainda não achei. Ande devagar apontando a pistola para as araras e prateleiras.</p>}
        </div>

        {achados.length > 1 && (
          <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-800">
            <p className="font-semibold">{achados.length} etiquetas terminam com “{alvo}”. Digite mais dígitos para achar só uma:</p>
            <ul className="mt-1 space-y-0.5 font-mono">
              {achados.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          id="procurar-epc-ligar"
          onClick={ligar}
          className={`w-full h-16 rounded-xl text-white text-lg font-black inline-flex items-center justify-center gap-2 active:scale-[0.99] ${ligado ? 'bg-amber-500' : 'bg-emerald-600'}`}
        >
          {ligado ? <Pause size={24} weight="fill" /> : <Play size={22} weight="fill" />} {ligado ? 'DESLIGAR' : 'LIGAR'}
        </button>
        {temPonte && <p className="text-center text-[11px] text-gray-400">O gatilho da pistola também liga e desliga.</p>}

        <div className="bg-white rounded-xl ring-1 ring-gray-200 p-3 flex items-center gap-2">
          {temPonte && leitor.conectado && (
            <>
              <label className="text-xs text-gray-600">Potência</label>
              <select
                value={potencia.atual ?? ''}
                onChange={(e) => trocarPotencia(Number(e.target.value))}
                className="h-9 px-2 mb-0 rounded-lg border border-gray-300 bg-white text-sm w-auto"
              >
                {potencia.atual == null && <option value="">—</option>}
                {opcoesPotencia.map((p) => (
                  <option key={p} value={p}>
                    {p} dBm{p <= 12 ? ' (perto)' : p >= 26 ? ' (longe)' : ''}
                  </option>
                ))}
              </select>
            </>
          )}
          <button onClick={() => setSom((s) => !s)} className="ml-auto h-9 px-3 rounded-lg ring-1 ring-gray-300 text-xs font-semibold text-[#000638] inline-flex items-center gap-1.5">
            {som ? <SpeakerHigh size={16} /> : <SpeakerSlash size={16} />} {som ? 'Som ligado' : 'Sem som'}
          </button>
        </div>

        <p className="text-[11px] text-gray-500 leading-relaxed px-1">
          Dica: comece com a potência alta para achar a região. Passou de 80%? Baixe a potência (10–15 dBm) e passe a pistola peça por
          peça — a porcentagem só sobe na peça certa.
        </p>
      </div>
    </div>
  );
}
