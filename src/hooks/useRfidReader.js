// Hook: leitor RFID de mesa .bat R9816 via Web Serial API.
// O leitor usa chip CP2102N (USB→Serial) e fala o protocolo Chafon/UHFReader18
// a 57600 bps. Não transmite sozinho — o hook faz polling do comando de
// inventário (0x01) e entrega os EPCs lidos via callback onRead.
// Reconecta sozinho se o dispositivo cair da USB (a permissão da porta
// persiste no navegador).
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

const SERIAL_BAUD = 57600;
const POLL_INTERVAL_MS = 400;
// Mesma tag relida dentro desta janela é ignorada (tag parada no leitor)
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
function parseFrames(buf) {
  const epcs = [];
  let i = 0;
  while (i < buf.length) {
    const len = buf[i];
    if (len < 4) {
      i += 1;
      continue;
    }
    const total = len + 1;
    if (i + total > buf.length) break;
    const frame = buf.slice(i, i + total);
    const [lsb, msb] = crc16(frame.slice(0, total - 2));
    if (frame[total - 2] !== lsb || frame[total - 1] !== msb) {
      i += 1;
      continue;
    }
    const reCmd = frame[2];
    const status = frame[3];
    if (reCmd === 0x01 && status >= 0x01 && status <= 0x04 && len > 6) {
      const num = frame[5];
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

/**
 * @param {(epc: string) => void} onRead — chamado a cada EPC novo lido
 * @returns {{ status, error, supported, connect, disconnect }}
 * status: 'desconectado' | 'conectado' | 'reconectando'
 */
export default function useRfidReader(onRead) {
  const supported = useMemo(() => 'serial' in navigator, []);
  const [status, setStatus] = useState('desconectado');
  const [error, setError] = useState('');

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const pollTimerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const lastSeenRef = useRef({ code: '', ts: 0 });
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  const disconnect = useCallback(async () => {
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
    setStatus('desconectado');
  }, []);

  const emitEpc = useCallback((epc) => {
    const agora = Date.now();
    const { code, ts } = lastSeenRef.current;
    if (epc === code && agora - ts < REREAD_COOLDOWN_MS) {
      lastSeenRef.current.ts = agora;
      return;
    }
    lastSeenRef.current = { code: epc, ts: agora };
    onReadRef.current?.(epc);
  }, []);

  const runSession = useCallback(
    async (port) => {
      await port.open({ baudRate: SERIAL_BAUD });
      portRef.current = port;
      setStatus('conectado');
      setError('');

      try {
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
              epcs.forEach(emitEpc);
            }
            break; // stream fechado sem erro (cancel do disconnect)
          } finally {
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
    [emitEpc],
  );

  const connect = useCallback(async () => {
    setError('');
    let port;
    try {
      port = await navigator.serial.requestPort();
    } catch {
      return; // usuário fechou o seletor sem escolher
    }
    keepReadingRef.current = true;

    while (keepReadingRef.current) {
      try {
        await runSession(port);
      } catch (err) {
        if (keepReadingRef.current)
          setError(
            `Conexão perdida (${err.message}) — reconectando automaticamente…`,
          );
      }
      if (!keepReadingRef.current) break;

      setStatus('reconectando');
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) [port] = ports;
      } catch {
        /* tenta de novo com a mesma referência */
      }
    }
    setStatus('desconectado');
  }, [runSession]);

  // Desconecta ao desmontar a página
  useEffect(() => () => disconnect(), [disconnect]);

  return { status, error, supported, connect, disconnect };
}
