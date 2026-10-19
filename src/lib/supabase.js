import { createClient } from '@supabase/supabase-js';

// ─── Configuração via env vars ───────────────────────────────────────────────
// VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (a anon key é pública por design).
// A service_role key NÃO existe mais no frontend (fase 0 do ERP, 17/10/2026):
// tudo que precisava dela passou a usar a sessão do usuário (policies para
// `authenticated` em apigestaocrosby/migrations/erp/0002) ou o backend
// (/api/erp/admin/usuarios para auth.admin).
const FALLBACK_URL = 'https://dorztqiunewggydvkjnf.supabase.co';
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzEyODgsImV4cCI6MjA2MjY0NzI4OH0.R95uT96OSGstBumZYRFOB38JAsK7U4b8mSXmT8MF0MQ';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL ou Anon Key não estão definidos');
}

// Adaptador de storage para sessionStorage
const sessionStorageAdapter = {
  getItem: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};

const STORAGE_KEY_LOCAL = 'sb-dorztqiunewggydvkjnf-auth-local';
const STORAGE_KEY_SESSION = 'sb-dorztqiunewggydvkjnf-auth-session';

// Cliente persistente (localStorage)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: STORAGE_KEY_LOCAL,
  },
  db: { schema: 'public' },
});

// Cliente de sessão da aba (sessionStorage)
export const supabaseSession = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: sessionStorageAdapter,
    storageKey: STORAGE_KEY_SESSION,
  },
  db: { schema: 'public' },
});

/**
 * Devolve o cliente anon que realmente carrega a sessão do usuário.
 *
 * O login usa `supabase` (localStorage) quando "lembrar-me" está marcado e
 * `supabaseSession` (sessionStorage) quando não está — ver AuthContext.login().
 * Quem escreve em tabela com RLS precisa usar o cliente certo: no outro o
 * request sai como `anon` e o Postgres devolve
 * "new row violates row-level security policy".
 *
 * Prefere a sessão da aba, que é a mais recente quando as duas existem.
 */
export const getSupabaseAuth = () => {
  try {
    if (sessionStorage.getItem(STORAGE_KEY_SESSION)) return supabaseSession;
  } catch {}
  return supabase;
};

/**
 * COMPATIBILIDADE: `supabaseAdmin` era o cliente com service_role no navegador.
 * Agora é um proxy para o cliente autenticado do usuário logado. As tabelas
 * que as telas antigas gravam têm policy para `authenticated`
 * (migrations/erp/0002_rls_legado_autenticado.sql no backend).
 * `supabaseAdmin.auth.admin.*` NÃO existe mais aqui — usar lib/userProfiles.js,
 * que chama o backend (/api/erp/admin/usuarios).
 * Telas novas devem importar `getSupabaseAuth()` diretamente.
 */
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_t, prop) {
      const cli = getSupabaseAuth();
      if (prop === 'auth') {
        return new Proxy(cli.auth, {
          get(auth, p) {
            if (p === 'admin') {
              throw new Error(
                'supabaseAdmin.auth.admin não está mais disponível no navegador — use lib/userProfiles.js (backend /api/erp/admin/usuarios).',
              );
            }
            const v = auth[p];
            return typeof v === 'function' ? v.bind(auth) : v;
          },
        });
      }
      const v = cli[prop];
      return typeof v === 'function' ? v.bind(cli) : v;
    },
  },
);

// Função para verificar se o Supabase está configurado corretamente
export const checkSupabaseConfig = () => {
  return {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: false,
    anonKeyLength: supabaseAnonKey?.length || 0,
    serviceKeyLength: 0,
  };
};
