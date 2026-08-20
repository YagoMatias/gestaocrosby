// Página: Tecnologia → Leitura de RFID
// Captura leituras do leitor RFID de mesa (.bat R9816) conectado via USB.
// O leitor usa um chip CP2102N (USB→Serial, driver Silicon Labs) e fala o
// protocolo Chafon/UHFReader18 a 57600 bps. Ele NÃO transmite sozinho: a
// página conecta via Web Serial API (Chrome/Edge) e faz polling do comando
// de inventário (0x01) a cada 400 ms, extraindo o EPC das tags respondidas.
// O modo teclado (HID) também segue ativo caso o leitor esteja nesse modo.
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Broadcast,
  Copy,
  CheckCircle,
  Trash,
  Plugs,
  PlugsConnected,
  Keyboard,
  ClockCounterClockwise,
  DownloadSimple,
} from '@phosphor-icons/react';
import PageTitle from '../components/ui/PageTitle';

// Gap máximo (ms) entre teclas pra considerar que ainda é a mesma leitura.
// Leitores HID digitam muito rápido; digitação humana fica acima disso.
const IDLE_COMMIT_MS = 300;
const MIN_TAG_LENGTH = 4;

// Protocolo Chafon/UHFReader18 (o do .bat R9816)
const SERIAL_BAUD = 57600;
const POLL_INTERVAL_MS = 400;
// Mesma tag lida em sequência dentro desta janela é ignorada (o polling
// relê a tag parada no leitor várias vezes por segundo)
const REREAD_COOLDOWN_MS = 2000;

// CRC16 do protocolo (poly 0x8408, preset 0xFFFF, LSB primeiro)
function crc16(bytes) {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >> 1) ^ 0x8408 : crc >> 1;
    }
  }
  return [crc & 0xff, (crc >> 8) & 0xff];
}

// Comando de inventário: Len Adr Cmd QValue Session + CRC
const INVENTORY_CMD = (() => {
  const body = [0x06, 0xff, 0x01, 0x04, 0x00];
  return new Uint8Array([...body, ...crc16(body)]);
})();

const toHex = (bytes) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

// Extrai EPCs dos frames de resposta acumulados no buffer.
// Frame: Len Adr reCmd Status [Ant Num (EPClen EPC... RSSI)*] CRC16
// Retorna { epcs: [...], rest: bytes ainda incompletos }
function parseFrames(buf) {
  const epcs = [];
  let i = 0;
  while (i < buf.length) {
    const len = buf[i];
    if (len < 4) {
      i += 1; // byte de lixo/ruído — descarta e tenta realinhar
      continue;
    }
    const total = len + 1;
    if (i + total > buf.length) break; // frame incompleto — espera mais bytes
    const frame = buf.slice(i, i + total);
    const [lsb, msb] = crc16(frame.slice(0, total - 2));
    const crcOk = frame[total - 2] === lsb && frame[total - 1] === msb;
    if (!crcOk) {
      i += 1; // CRC inválido — desalinhado, avança 1 byte
      continue;
    }
    const reCmd = frame[2];
    const status = frame[3];
    // Status 0x01..0x04 = inventário com leitura (completo/timeout/mais frames)
    if (reCmd === 0x01 && status >= 0x01 && status <= 0x04 && len > 6) {
      const num = frame[5]; // frame[4] = antena
      let p = 6;
      for (let t = 0; t < num && p < total - 2; t++) {
        const epcLen = frame[p];
        if (p + 1 + epcLen > total - 2) break;
        epcs.push(toHex(frame.slice(p + 1, p + 1 + epcLen)));
        p += 1 + epcLen + 1; // +1 do RSSI após o EPC
      }
    }
    i += total;
  }
  return { epcs, rest: buf.slice(i) };
}

const fmtHora = (d) =>
  d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

// Beep curto de confirmação a cada leitura (WebAudio, sem arquivo de som)
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
    osc.onended = () => ctx.close();
  } catch {
    // sem áudio disponível — segue sem beep
  }
}

const LeituraRFID = () => {
  const [ultimaLeitura, setUltimaLeitura] = useState(null); // { code, time }
  const [historico, setHistorico] = useState([]); // [{ code, time, count }]
  const [copiado, setCopiado] = useState(false);
  const [flash, setFlash] = useState(false);

  // Serial (leitor .bat via Web Serial)
  const serialSuportado = useMemo(() => 'serial' in navigator, []);
  // 'desconectado' | 'conectado' | 'reconectando'
  const [serialStatus, setSerialStatus] = useState('desconectado');
  const serialConectado = serialStatus !== 'desconectado';
  const [serialErro, setSerialErro] = useState('');
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const pollTimerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const lastSeenRef = useRef({ code: '', ts: 0 });

  // Buffer da leitura via teclado
  const bufferRef = useRef('');
  const idleTimerRef = useRef(null);

  const registrarLeitura = useCallback((codeRaw) => {
    const code = String(codeRaw).trim();
    if (code.length < MIN_TAG_LENGTH) return;
    const time = new Date();
    setUltimaLeitura({ code, time });
    setHistorico((prev) => {
      // Leitura repetida em sequência só incrementa o contador
      if (prev.length > 0 && prev[0].code === code) {
        const [first, ...rest] = prev;
        return [{ ...first, time, count: first.count + 1 }, ...rest];
      }
      return [{ code, time, count: 1 }, ...prev].slice(0, 200);
    });
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
    beep();
  }, []);

  // ---- Modo teclado (HID) — captura global, sem precisar de foco em input ----
  const commitBuffer = useCallback(() => {
    const value = bufferRef.current;
    bufferRef.current = '';
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (value) registrarLeitura(value);
  }, [registrarLeitura]);

  useEffect(() => {
    const onKeyDown = (e) => {
      // Não interceptar quando o usuário está digitando num campo de verdade
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable)
        return;

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (bufferRef.current) {
          e.preventDefault();
          commitBuffer();
        }
        return;
      }
      if (e.key.length !== 1) return; // ignora Shift, F5, setas etc.

      bufferRef.current += e.key;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(commitBuffer, IDLE_COMMIT_MS);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [commitBuffer]);

  // ---- Modo serial (Web Serial API + protocolo Chafon) ----
  const desconectarSerial = useCallback(async () => {
    keepReadingRef.current = false;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    try {
      writerRef.current?.releaseLock();
    } catch {
      /* writer já liberado */
    }
    try {
      await readerRef.current?.cancel();
    } catch {
      /* reader já fechado */
    }
    try {
      await portRef.current?.close();
    } catch {
      /* porta já fechada */
    }
    portRef.current = null;
    readerRef.current = null;
    writerRef.current = null;
    setSerialStatus('desconectado');
  }, []);

  // Registra EPC vindo do polling, ignorando releituras da mesma tag parada
  const registrarEpc = useCallback(
    (epc) => {
      const agora = Date.now();
      const { code, ts } = lastSeenRef.current;
      if (epc === code && agora - ts < REREAD_COOLDOWN_MS) {
        lastSeenRef.current.ts = agora; // renova a janela enquanto a tag está lá
        return;
      }
      lastSeenRef.current = { code: epc, ts: agora };
      registrarLeitura(epc);
    },
    [registrarLeitura],
  );

  // Uma sessão de leitura: abre a porta, faz polling e lê até cair/desconectar
  const rodarSessao = useCallback(
    async (port) => {
      await port.open({ baudRate: SERIAL_BAUD });
      portRef.current = port;
      setSerialStatus('conectado');
      setSerialErro('');

      try {
        // Envia o comando de inventário periodicamente — o leitor só
        // responde quando perguntado
        const writer = port.writable.getWriter();
        writerRef.current = writer;
        pollTimerRef.current = setInterval(() => {
          writer.write(INVENTORY_CMD).catch(() => {
            /* porta caiu — o loop de leitura encerra a sessão */
          });
        }, POLL_INTERVAL_MS);

        let pendente = new Uint8Array(0);
        while (keepReadingRef.current && port.readable) {
          const reader = port.readable.getReader();
          readerRef.current = reader;
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              const junto = new Uint8Array(pendente.length + value.length);
              junto.set(pendente);
              junto.set(value, pendente.length);
              const { epcs, rest } = parseFrames(junto);
              pendente = rest;
              epcs.forEach(registrarEpc);
            }
            break; // stream fechado sem erro (cancel do desconectar)
          } finally {
            // Erros ("device has been lost") sobem pro chamador reconectar
            reader.releaseLock();
          }
        }
      } finally {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        try {
          writerRef.current?.releaseLock();
        } catch {
          /* writer já liberado */
        }
        writerRef.current = null;
        readerRef.current = null;
        try {
          await port.close();
        } catch {
          /* porta já fechada */
        }
        portRef.current = null;
      }
    },
    [registrarEpc],
  );

  const conectarSerial = useCallback(async () => {
    setSerialErro('');
    let port;
    try {
      port = await navigator.serial.requestPort();
    } catch {
      return; // usuário fechou o seletor de porta sem escolher
    }
    keepReadingRef.current = true;

    // Loop de sessões: se o leitor cair da USB (pico de corrente, cabo),
    // espera re-enumerar e reconecta sozinho — a permissão da porta persiste.
    while (keepReadingRef.current) {
      try {
        await rodarSessao(port);
      } catch (err) {
        if (keepReadingRef.current)
          setSerialErro(
            `Conexão perdida (${err.message}) — reconectando automaticamente…`,
          );
      }
      if (!keepReadingRef.current) break;

      setSerialStatus('reconectando');
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) [port] = ports;
      } catch {
        /* tenta de novo com a mesma referência */
      }
    }
    setSerialStatus('desconectado');
  }, [rodarSessao]);

  useEffect(() => () => desconectarSerial(), [desconectarSerial]);

  const copiarUltima = useCallback(async () => {
    if (!ultimaLeitura) return;
    try {
      await navigator.clipboard.writeText(ultimaLeitura.code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  }, [ultimaLeitura]);

  const limparHistorico = useCallback(() => {
    setHistorico([]);
    setUltimaLeitura(null);
  }, []);

  const exportarCsv = useCallback(() => {
    if (historico.length === 0) return;
    const linhas = [
      'codigo;hora;leituras',
      ...historico.map((h) => `${h.code};${fmtHora(h.time)};${h.count}`),
    ];
    const blob = new Blob([linhas.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leituras-rfid.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [historico]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
      <div className="max-w-3xl mx-auto">
        <PageTitle
          title="Leitura de RFID"
          subtitle="Aproxime uma tag do leitor .bat para capturar o código automaticamente"
          icon={Broadcast}
        />

        {/* Área da última leitura */}
        <div
          className={`rounded-2xl border-2 bg-white shadow-sm p-8 text-center transition-colors duration-300 ${
            flash ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'
          }`}
        >
          {ultimaLeitura ? (
            <>
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                Última tag lida — {fmtHora(ultimaLeitura.time)}
              </p>
              <p className="font-mono text-3xl lg:text-4xl font-bold text-[#000638] break-all select-all">
                {ultimaLeitura.code}
              </p>
              <button
                onClick={copiarUltima}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#000638] text-white text-sm font-medium hover:bg-[#000638]/90 transition-colors"
              >
                {copiado ? (
                  <>
                    <CheckCircle size={18} weight="bold" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={18} /> Copiar código
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-3">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-700">
                Aguardando leitura…
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Deixe esta página aberta e aproxime a tag do leitor.
              </p>
            </>
          )}
        </div>

        {/* Conexão com o leitor */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
          {serialSuportado ? (
            <button
              onClick={serialConectado ? desconectarSerial : conectarSerial}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ring-1 font-medium transition-colors ${
                serialStatus === 'conectado'
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                  : serialStatus === 'reconectando'
                    ? 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100'
                    : 'bg-[#000638] text-white ring-[#000638] hover:bg-[#000638]/90'
              }`}
            >
              {serialStatus === 'conectado' ? (
                <>
                  <PlugsConnected size={18} /> Leitor conectado — desconectar
                </>
              ) : serialStatus === 'reconectando' ? (
                <>
                  <Plugs size={18} className="animate-pulse" /> Reconectando… —
                  cancelar
                </>
              ) : (
                <>
                  <Plugs size={18} /> Conectar leitor
                </>
              )}
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              Este navegador não suporta Web Serial — use Chrome ou Edge.
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">
            <Keyboard size={16} />
            Modo teclado também ativo
          </span>
        </div>
        {serialErro && (
          <p className="mt-2 text-center text-sm text-rose-600">{serialErro}</p>
        )}

        {/* Histórico */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <ClockCounterClockwise size={18} />
              Histórico ({historico.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={exportarCsv}
                disabled={historico.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <DownloadSimple size={16} /> Exportar CSV
              </button>
              <button
                onClick={limparHistorico}
                disabled={historico.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Trash size={16} /> Limpar
              </button>
            </div>
          </div>
          {historico.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">
              Nenhuma leitura ainda.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {historico.map((h, i) => (
                <li
                  key={`${h.code}-${i}`}
                  className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50"
                >
                  <span className="font-mono text-sm text-gray-800 break-all select-all">
                    {h.code}
                  </span>
                  <span className="flex items-center gap-3 shrink-0 ml-4">
                    {h.count > 1 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium ring-1 ring-blue-200">
                        {h.count}×
                      </span>
                    )}
                    <span className="text-xs text-gray-400 tabular-nums">
                      {fmtHora(h.time)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400 max-w-xl mx-auto">
          Clique em &quot;Conectar leitor&quot; e escolha a porta &quot;CP2102N
          USB to UART Bridge&quot; na janela do navegador. Depois é só
          aproximar as tags — a leitura acontece sozinha enquanto a página
          estiver aberta.
        </p>
      </div>
    </div>
  );
};

export default LeituraRFID;
