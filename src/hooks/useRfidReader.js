// Hook: leitor RFID de mesa. Dois modelos, mesma interface:
//
//  1) .bat R9816 — Web Serial. Chip CP2102N (USB→Serial), protocolo
//     Chafon/UHFReader18 a 57600 bps. Não transmite sozinho: o hook faz polling
//     do comando de inventário (0x01).
//
//  2) Chainway de mesa (série HR300…, VID 2047 / PID 0301) — WebHID. NÃO cria
//     porta COM: entra no Windows como HID (relatório 0, 64 bytes) e fala o
//     mesmo protocolo A5 5A dos portais UR4. Liga o inventário (0x82 00 00 →
//     0x83 00) e o leitor GUARDA as etiquetas; o hook pede o que ficou guardado
//     com 0xEB → 0xEC [n][(tam)(PC 2 + EPC + RSSI 2)]×n. Qualquer outro comando
//     no meio do inventário faz o leitor parar (0x8D 01). Validado no aparelho
//     real em 12/11/2026.
//
// Entrega os EPCs lidos via callback onRead e reconecta sozinho se o aparelho
// cair da USB (a permissão persiste no navegador / é dada pelo app PDV).
//
// POTÊNCIA DO LEITOR (Yago, 19/11/2026): de fábrica os leitores vêm na potência
// máxima e leem as peças em volta do balcão. O hook lê a potência ao ligar e
// deixa regular (`potencia`, `definirPotencia`), nos dois modelos:
//  • .bat: 0x21 (informações do leitor: o 7º byte dos dados é a potência) e
//    0x2F [dBm] (0 a 30) — manual do protocolo RRU98xx, seções 8.3.1 e 8.3.6.
//    O leitor ignora comando que chega no meio de um inventário, então a
//    consulta de etiquetas é suspensa enquanto o comando vai e volta.
//  • Chainway: 0x12 → 0x13 (ler) e 0x10 [02, antena, leitura×100, escrita×100]
//    → 0x11 [01] (gravar), os mesmos comandos do portal UR4; só aceita com o
//    inventário parado (0x8C), que é religado em seguida.
// A potência escolhida fica guardada neste computador (localStorage) e é
// reaplicada ao ligar o leitor, caso o aparelho volte com outro valor.
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

// Frame de comando do leitor .bat: Len (bytes depois dele) + Adr (FF = qualquer) + Cmd + dados + CRC
export function frameBat(cmd, data = []) {
  const corpo = [4 + data.length, 0xff, cmd, ...data];
  return new Uint8Array([...corpo, ...crc16(corpo)]);
}

// Potência do leitor: faixa de cada modelo (dBm) e onde a preferência fica guardada
export const POTENCIA_LEITOR = { bat: { min: 0, max: 30 }, chainway: { min: 1, max: 30 } };
const PREF_POTENCIA = 'rfid_leitor_potencia';
const lerPreferencia = () => {
  try {
    const v = window.localStorage.getItem(PREF_POTENCIA);
    return v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  } catch {
    return null;
  }
};
const guardarPreferencia = (v) => {
  try {
    window.localStorage.setItem(PREF_POTENCIA, String(v));
  } catch {
    /* sem localStorage: vale só até fechar */
  }
};
// resposta do 0x21 do leitor .bat: Version(2) Type Tr_Type dmaxfre dminfre Power …
export function potenciaDoInfoBat(data) {
  return data && data.length >= 7 ? data[6] : null;
}
// resposta do 0x13 do Chainway: 1 byte + registros [antena, leitura u16, escrita u16] (dBm × 100)
export function potenciaDoChainway(data) {
  return data && data.length >= 4 ? ((data[2] << 8) | data[3]) / 100 : null;
}
export function framePotenciaChainway(dbm) {
  const v = Math.round(dbm * 100);
  return frameChainway(0x10, [0x02, 0x01, (v >> 8) & 0xff, v & 0xff, (v >> 8) & 0xff, v & 0xff]);
}

const toHex = (bytes) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

// ─── Chainway de mesa (WebHID) ───────────────────────────────────────────────
export const CHAINWAY_HID = { vendorId: 0x2047, productId: 0x0301 };
const HID_POLL_MS = 150;
const HID_SILENCIO_MS = 2500; // sem resposta nesse tempo → religa o inventário

// Frame A5 5A: tamanho (frame inteiro) + comando + dados + XOR + 0D 0A
export function frameChainway(cmd, data = []) {
  const len = 8 + data.length;
  const corpo = [(len >> 8) & 0xff, len & 0xff, cmd, ...data];
  return new Uint8Array([0xa5, 0x5a, ...corpo, corpo.reduce((a, b) => a ^ b, 0), 0x0d, 0x0a]);
}

// Remonta os frames dos relatórios HID. Um frame pode ocupar mais de um
// relatório de 64 bytes; o que sobra depois do fim do frame é lixo do buffer.
// `estado.pendente` guarda o frame incompleto entre um relatório e o próximo.
export function framesChainway(u8, estado) {
  const out = [];
  const fechar = (bytes) => {
    const len = bytes.length;
    if (bytes[len - 2] !== 0x0d || bytes[len - 1] !== 0x0a) return;
    let x = 0;
    for (let k = 2; k < len - 3; k++) x ^= bytes[k];
    if (x !== bytes[len - 3]) return;
    out.push({ cmd: bytes[4], data: Uint8Array.from(bytes.slice(5, len - 3)) });
  };
  let i = 0;
  if (estado.pendente) {
    const pega = Math.min(estado.pendente.falta, u8.length);
    for (let k = 0; k < pega; k++) estado.pendente.bytes.push(u8[k]);
    estado.pendente.falta -= pega;
    if (estado.pendente.falta > 0) return out;
    fechar(estado.pendente.bytes);
    estado.pendente = null;
    i = pega;
  }
  while (i + 4 <= u8.length && u8[i] === 0xa5 && u8[i + 1] === 0x5a) {
    const len = (u8[i + 2] << 8) | u8[i + 3];
    if (len < 8 || len > 2048) break;
    if (i + len > u8.length) {
      estado.pendente = { bytes: Array.from(u8.slice(i)), falta: i + len - u8.length };
      break;
    }
    fechar(Array.from(u8.slice(i, i + len)));
    i += len;
  }
  return out;
}

// Registro de etiqueta: PC (2 bytes) + EPC (tamanho vem do PC) + RSSI…
function epcDoRegistro(rec) {
  if (rec.length < 4) return null;
  const tam = (rec[0] >> 3) * 2;
  if (tam < 2 || 2 + tam > rec.length) return null;
  return toHex(rec.slice(2, 2 + tam));
}

// EPCs de um frame do leitor: 0xEC (lote guardado), 0x81 (leitura única) ou
// 0x83 (etiqueta direta, formato do portal)
export function epcsDoFrameChainway(f) {
  const d = f.data;
  const epcs = [];
  if (f.cmd === 0xec) {
    const n = d[0] || 0;
    let p = 1;
    for (let k = 0; k < n && p < d.length; k++) {
      const tam = d[p];
      if (p + 1 + tam > d.length) break;
      const epc = epcDoRegistro(d.slice(p + 1, p + 1 + tam));
      if (epc) epcs.push(epc);
      p += 1 + tam;
    }
  } else if ((f.cmd === 0x81 || f.cmd === 0x83) && d.length >= 8) {
    const epc = epcDoRegistro(d);
    if (epc) epcs.push(epc);
  }
  return epcs;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Extrai EPCs dos frames de resposta acumulados no buffer.
// Frame: Len Adr reCmd Status [Ant Num (EPClen EPC... RSSI)*] CRC16
export function parseFrames(buf) {
  const epcs = [];
  const outros = []; // respostas de comando: { reCmd, status, data }
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
    } else if (reCmd !== 0x01) {
      outros.push({ reCmd, status, data: frame.slice(4, total - 2) });
    }
    i += total;
  }
  return { epcs, outros, rest: buf.slice(i) };
}

/**
 * @param {(epc: string) => void} onRead — chamado a cada EPC novo lido
 * @returns {{ status, error, supported, connect, disconnect, potencia, lerPotencia, definirPotencia }}
 * status: 'desconectado' | 'conectado' | 'reconectando'
 * potencia: null (leitor desligado ou ainda não lida) ou
 *           { valor (dBm), min, max, modelo: 'bat' | 'chainway' }
 */
export default function useRfidReader(onRead) {
  const supported = useMemo(() => 'serial' in navigator || 'hid' in navigator, []);
  const [status, setStatus] = useState('desconectado');
  const [error, setError] = useState('');

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const pollTimerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const lastSeenRef = useRef(new Map()); // epc -> última vez visto
  const hidRef = useRef(null);
  const hidEncerrarRef = useRef(null);
  const hidPrimeiroRef = useRef(false); // navegador: próximo clique abre o seletor de HID antes do de porta
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  // potência: o que a sessão em curso sabe fazer ({ modelo, min, max, ler, definir })
  const [potencia, setPotencia] = useState(null);
  const leitorRef = useRef(null);

  // ao ligar: lê a potência do aparelho e, se este computador tem uma preferência
  // diferente guardada, regrava (o aparelho pode ter voltado ao valor de fábrica)
  const iniciarPotencia = useCallback(async () => {
    const l = leitorRef.current;
    if (!l) return;
    try {
      let valor = await l.ler();
      const pref = lerPreferencia();
      if (leitorRef.current !== l) return;
      if (pref != null && valor != null && pref !== valor && pref >= l.min && pref <= l.max) valor = await l.definir(pref);
      if (leitorRef.current === l && valor != null) setPotencia({ valor, min: l.min, max: l.max, modelo: l.modelo });
    } catch {
      /* leitor que não responde ao comando de potência: a tela só não mostra o regulador */
    }
  }, []);

  const lerPotencia = useCallback(async () => {
    const l = leitorRef.current;
    if (!l) throw new Error('Ligue o leitor para ver a potência');
    const valor = await l.ler();
    if (valor == null) throw new Error('O leitor não informou a potência');
    if (leitorRef.current === l) setPotencia({ valor, min: l.min, max: l.max, modelo: l.modelo });
    return valor;
  }, []);

  const definirPotencia = useCallback(async (dbm) => {
    const l = leitorRef.current;
    if (!l) throw new Error('Ligue o leitor para ajustar a potência');
    const n = Math.round(Number(dbm));
    if (!Number.isFinite(n) || n < l.min || n > l.max) throw new Error(`Potência fora da faixa deste leitor (${l.min} a ${l.max} dBm)`);
    const valor = await l.definir(n);
    guardarPreferencia(n);
    if (leitorRef.current === l && valor != null) setPotencia({ valor, min: l.min, max: l.max, modelo: l.modelo });
    return valor;
  }, []);

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    // leitor HID: encerra a sessão (ela mesma manda o parar e fecha o aparelho)
    try {
      hidEncerrarRef.current?.();
    } catch {
      /* sessão já encerrada */
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

  // Etiqueta parada em cima do leitor é relida várias vezes por segundo: só
  // avisa de novo depois de ela ficar REREAD_COOLDOWN_MS sem aparecer.
  const emitEpc = useCallback((epc) => {
    const agora = Date.now();
    const vistos = lastSeenRef.current;
    const ts = vistos.get(epc);
    vistos.set(epc, agora);
    if (ts != null && agora - ts < REREAD_COOLDOWN_MS) return;
    if (vistos.size > 500) {
      for (const [k, t] of vistos) if (agora - t > REREAD_COOLDOWN_MS) vistos.delete(k);
    }
    onReadRef.current?.(epc);
  }, []);

  // ─── Sessão do leitor Chainway (WebHID) ────────────────────────────────────
  const runHidSession = useCallback(
    async (device) => {
      if (!device.opened) await device.open();
      hidRef.current = device;
      setStatus('conectado');
      setError('');

      // id e tamanho do relatório de saída (no aparelho real: 0 / 64 bytes)
      let reportId = 0;
      let tamanho = 64;
      for (const c of device.collections || []) {
        const r = (c.outputReports || [])[0];
        if (!r) continue;
        reportId = r.reportId || 0;
        const bits = (r.items || []).reduce((soma, i) => soma + (i.reportSize || 0) * (i.reportCount || 0), 0);
        if (bits >= 64) tamanho = Math.ceil(bits / 8);
        break;
      }
      const enviar = (bytes) => {
        const buf = new Uint8Array(Math.max(tamanho, bytes.length));
        buf.set(bytes);
        return device.sendReport(reportId, buf);
      };
      const PARAR = frameChainway(0x8c);
      const LIGAR = frameChainway(0x82, [0x00, 0x00]);
      const PEDIR = frameChainway(0xeb);

      const estado = { pendente: null };
      let ultimaResposta = Date.now();
      let ligadoEm = 0;
      let religando = false;
      let emComando = false; // conversa de potência em curso: o inventário está parado de propósito
      const esperas = []; // { cmd, resolve } — respostas de comando aguardadas
      let encerrar = null;
      const fim = new Promise((resolve) => {
        encerrar = resolve;
      });
      hidEncerrarRef.current = () => encerrar(null);

      const ligar = async () => {
        if (religando) return;
        religando = true;
        try {
          await enviar(PARAR);
          await dormir(200);
          await enviar(LIGAR);
          ligadoEm = Date.now();
          ultimaResposta = Date.now();
        } finally {
          religando = false;
        }
      };

      const onReport = (e) => {
        const u8 = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
        for (const f of framesChainway(u8, estado)) {
          if (f.cmd === 0xec) ultimaResposta = Date.now();
          const k = esperas.findIndex((e) => e.cmd === f.cmd);
          if (k >= 0) {
            esperas.splice(k, 1)[0].resolve(f.data);
            continue;
          }
          // 0x8D fora de hora = o inventário parou sozinho → liga de novo
          if (f.cmd === 0x8d) {
            if (!emComando && ligadoEm && Date.now() - ligadoEm > 600 && !religando) ligar().catch((err) => encerrar(err));
            continue;
          }
          epcsDoFrameChainway(f).forEach(emitEpc);
        }
      };
      const onDisconnect = (e) => {
        if (e.device === device) encerrar(new Error('leitor desconectado da USB'));
      };
      device.addEventListener('inputreport', onReport);
      navigator.hid.addEventListener('disconnect', onDisconnect);

      // Potência: o leitor só aceita com o inventário parado. Uma conversa por vez:
      // para (0x8C), manda os comandos, religa o inventário.
      const pedir = (cmd, data, respCmd) =>
        new Promise((resolve, reject) => {
          const e = { cmd: respCmd, resolve };
          esperas.push(e);
          setTimeout(() => {
            const k = esperas.indexOf(e);
            if (k >= 0) {
              esperas.splice(k, 1);
              reject(new Error('o leitor não respondeu ao comando de potência'));
            }
          }, 1500);
          enviar(frameChainway(cmd, data)).catch(reject);
        });
      let fila = Promise.resolve();
      const conversar = (fn) => {
        const vez = fila.then(async () => {
          emComando = true;
          try {
            await enviar(PARAR);
            await dormir(250);
            return await fn();
          } finally {
            emComando = false;
            await ligar().catch(() => {});
          }
        });
        fila = vez.catch(() => {});
        return vez;
      };
      const lerHid = async () => potenciaDoChainway(await pedir(0x12, [], 0x13));
      leitorRef.current = {
        modelo: 'chainway',
        ...POTENCIA_LEITOR.chainway,
        ler: () => conversar(lerHid),
        definir: (dbm) =>
          conversar(async () => {
            const v = Math.round(dbm * 100);
            const resp = await pedir(0x10, [0x02, 0x01, (v >> 8) & 0xff, v & 0xff, (v >> 8) & 0xff, v & 0xff], 0x11);
            if (resp[0] !== 0x01) throw new Error(`o leitor recusou a potência (código ${resp[0]})`);
            return lerHid();
          }),
      };

      try {
        await ligar();
        iniciarPotencia();
        pollTimerRef.current = setInterval(() => {
          if (religando || emComando) return;
          if (Date.now() - ultimaResposta > HID_SILENCIO_MS) {
            ligar().catch((err) => encerrar(err));
            return;
          }
          enviar(PEDIR).catch((err) => encerrar(err));
        }, HID_POLL_MS);
        const motivo = await fim;
        if (motivo) throw motivo;
      } finally {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        device.removeEventListener('inputreport', onReport);
        navigator.hid.removeEventListener('disconnect', onDisconnect);
        hidEncerrarRef.current = null;
        leitorRef.current = null;
        setPotencia(null);
        try {
          await enviar(PARAR);
          await dormir(120);
        } catch {
          /* aparelho já saiu da USB */
        }
        try {
          await device.close();
        } catch {
          /* já fechado */
        }
        hidRef.current = null;
      }
    },
    [emitEpc, iniciarPotencia],
  );

  // Procura o leitor Chainway: primeiro entre os já autorizados; se `pedir`,
  // abre o seletor (no app PDV quem escolhe é o processo principal, sem janela).
  const acharHid = useCallback(async (pedir) => {
    if (!('hid' in navigator)) return null;
    const ehChainway = (d) => d.vendorId === CHAINWAY_HID.vendorId && d.productId === CHAINWAY_HID.productId;
    try {
      const ja = (await navigator.hid.getDevices()).find(ehChainway);
      if (ja) return ja;
    } catch {
      /* segue para o seletor */
    }
    if (!pedir) return null;
    try {
      const [escolhido] = await navigator.hid.requestDevice({ filters: [CHAINWAY_HID] });
      return escolhido || null;
    } catch {
      return null; // sem leitor HID ou seletor fechado
    }
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
        let pausado = false; // comando de potência em curso: suspende a consulta de etiquetas
        const esperas = []; // { reCmd, resolve }
        pollTimerRef.current = setInterval(() => {
          if (pausado) return;
          writer.write(INVENTORY_CMD).catch(() => {
            /* porta caiu — o loop de leitura encerra a sessão */
          });
        }, POLL_INTERVAL_MS);

        // Comando de configuração: o leitor ignora o que chega durante um inventário,
        // então espera o que estava no ar terminar e tenta de novo se não vier resposta.
        let fila = Promise.resolve();
        const comando = (cmd, data = []) => {
          const vez = fila.then(async () => {
            pausado = true;
            try {
              await dormir(POLL_INTERVAL_MS + 150);
              const frame = frameBat(cmd, data);
              for (let t = 0; t < 4; t += 1) {
                const resp = await new Promise((resolve) => {
                  const e = { reCmd: cmd, resolve };
                  esperas.push(e);
                  setTimeout(() => {
                    const k = esperas.indexOf(e);
                    if (k >= 0) {
                      esperas.splice(k, 1);
                      resolve(null);
                    }
                  }, 900);
                  writer.write(frame).catch(() => resolve(null));
                });
                if (resp) return resp;
              }
              throw new Error('o leitor não respondeu ao comando de potência');
            } finally {
              pausado = false;
            }
          });
          fila = vez.catch(() => {});
          return vez;
        };
        const lerBat = async () => {
          const r = await comando(0x21);
          if (r.status !== 0x00) throw new Error(`o leitor não informou a potência (código ${r.status.toString(16)})`);
          return potenciaDoInfoBat(r.data);
        };
        leitorRef.current = {
          modelo: 'bat',
          ...POTENCIA_LEITOR.bat,
          ler: lerBat,
          definir: async (dbm) => {
            const r = await comando(0x2f, [dbm & 0xff]);
            if (r.status === 0x14) throw new Error('o leitor não deixa ajustar a potência agora — desligue e ligue o leitor e tente de novo');
            if (r.status === 0xff) throw new Error(`este leitor não aceita ${dbm} dBm — tente um valor menor`);
            if (r.status !== 0x00) throw new Error(`o leitor recusou a potência (código ${r.status.toString(16)})`);
            return lerBat();
          },
        };
        iniciarPotencia();

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
              const { epcs, outros, rest } = parseFrames(junto);
              pendente = rest;
              epcs.forEach(emitEpc);
              for (const f of outros) {
                const k = esperas.findIndex((e) => e.reCmd === f.reCmd);
                if (k >= 0) esperas.splice(k, 1)[0].resolve(f);
              }
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
        leitorRef.current = null;
        setPotencia(null);
        try {
          await port.close();
        } catch {
          /* porta já fechada */
        }
        portRef.current = null;
      }
    },
    [emitEpc, iniciarPotencia],
  );

  const connect = useCallback(async () => {
    setError('');

    // 1) Leitor Chainway (USB HID). No app PDV a escolha é automática (sem
    //    janela), então pergunta sempre; no navegador só abre o seletor de HID
    //    quando não existe Web Serial ou o seletor de porta foi fechado.
    const noApp = typeof window !== 'undefined' && !!window.pdv;
    let hid = await acharHid(noApp || !('serial' in navigator) || hidPrimeiroRef.current);
    hidPrimeiroRef.current = false;

    let port = null;
    if (!hid) {
      if ('serial' in navigator) {
        try {
          port = await navigator.serial.requestPort();
        } catch {
          port = null; // seletor fechado / nenhuma porta
        }
      }
      if (!port) hid = await acharHid(true);
      if (!port && !hid) {
        // No navegador o segundo seletor pode não abrir (o clique já "venceu"):
        // o próximo clique vai direto ao seletor do leitor Chainway.
        if (!noApp && 'hid' in navigator) {
          hidPrimeiroRef.current = true;
          setError('Leitor Chainway (sem porta COM)? Clique em conectar de novo e escolha o aparelho "Chainway".');
        }
        return; // nada escolhido
      }
    }

    keepReadingRef.current = true;

    if (hid) {
      while (keepReadingRef.current) {
        try {
          await runHidSession(hid);
        } catch (err) {
          if (keepReadingRef.current)
            setError(`Conexão perdida (${err.message}) — reconectando automaticamente…`);
        }
        if (!keepReadingRef.current) break;
        setStatus('reconectando');
        await dormir(1500);
        const deNovo = await acharHid(false);
        if (deNovo) hid = deNovo;
      }
      setStatus('desconectado');
      return;
    }

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
  }, [runSession, runHidSession, acharHid]);

  // Desconecta ao desmontar a página
  useEffect(() => () => disconnect(), [disconnect]);

  return { status, error, supported, connect, disconnect, potencia, lerPotencia, definirPotencia };
}
