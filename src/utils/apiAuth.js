// Chamadas autenticadas ao backend (apigestaocrosby) com a sessão do Supabase.
//
// O backend valida o JWT em middlewares/auth.js (requireAuth / requireRole).
// Uso:
//   import { apiFetch, apiJson, authHeaders } from '../utils/apiAuth';
//   const { data } = await apiJson('/api/erp/status');
//   await apiJson('/api/erp/config', { method: 'PUT', body: { modulo, modo } });
import { API_BASE_URL } from '../config/constants';
import { getSupabaseAuth } from '../lib/supabase';

export async function accessToken() {
  try {
    const { data } = await getSupabaseAuth().auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function authHeaders(extra = {}) {
  const token = await accessToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

export async function apiFetch(path, { method = 'GET', body, headers = {}, timeoutMs = 120000, ...rest } = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const h = await authHeaders({ ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers });
    return await fetch(url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctrl.signal, ...rest });
  } finally {
    clearTimeout(t);
  }
}

/** fetch + json; lança Error com a mensagem do backend quando !ok */
export async function apiJson(path, opts = {}) {
  const r = await apiFetch(path, opts);
  let j = null;
  try {
    j = await r.json();
  } catch {
    throw new Error(`Resposta inválida do servidor (HTTP ${r.status})`);
  }
  if (!r.ok || j?.success === false) {
    const msg = j?.message || j?.error || `HTTP ${r.status}`;
    const e = new Error(msg);
    e.status = r.status;
    e.body = j;
    throw e;
  }
  return j;
}
