// API do Portal RFID com descoberta automática do AGENTE LOCAL.
// Ordem: 1) agente na própria máquina (http://127.0.0.1:7070 — instalado pelo
// kit portal-agent, cada máquina com o IP do seu portal no config.json);
// 2) fallback: backend do HeadCoach (/api/portal-rfid — só funciona quando o
// backend roda na mesma rede do portal, ex.: dev na matriz).
// Navegadores permitem chamar http://127.0.0.1 a partir de páginas HTTPS
// (localhost é contexto seguro), então o agente funciona até na produção.
import { API_BASE_URL } from '../config/constants';

// O agente tenta estas portas em ordem (algumas máquinas têm a 7070
// reservada pelo Windows/Hyper-V) — a página procura em todas em paralelo.
const AGENT_PORTS = [7070, 7171, 27070];
let agentBase = null; // url do agente encontrado, ou false
let lastCheck = 0;

async function checkAgent() {
  const now = Date.now();
  // Revalida a cada 30s (agente pode subir/cair com a página aberta)
  if (agentBase !== null && now - lastCheck < 30000) return agentBase;
  lastCheck = now;
  const probes = AGENT_PORTS.map(async (p) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 800);
    try {
      const r = await fetch(`http://127.0.0.1:${p}/health`, {
        signal: ctl.signal,
      });
      clearTimeout(t);
      if (r.ok) return `http://127.0.0.1:${p}`;
    } catch {
      /* porta sem agente */
    }
    return null;
  });
  const results = await Promise.all(probes);
  agentBase = results.find(Boolean) || false;
  return agentBase;
}

async function base() {
  const agent = await checkAgent();
  return agent || `${API_BASE_URL}/api/portal-rfid`;
}

export async function portalUsandoAgente() {
  return Boolean(await checkAgent());
}

export async function portalConnect(body = {}) {
  const b = await base();
  const r = await fetch(`${b}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function portalDisconnect() {
  const b = await base();
  const r = await fetch(`${b}/disconnect`, { method: 'POST' });
  return r.json();
}

export async function portalTags() {
  const b = await base();
  const r = await fetch(`${b}/tags`);
  return r.json();
}

export async function portalClear() {
  const b = await base();
  const r = await fetch(`${b}/clear`, { method: 'POST' });
  return r.json();
}
