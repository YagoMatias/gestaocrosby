import { createClient } from '@supabase/supabase-js';

// ─── Configuração via env vars ───────────────────────────────────────────────
// Fallback para os valores anteriores garante que o app não quebre se .env não
// estiver configurado. Em produção, configure VITE_SUPABASE_* no provedor.
// ⚠️ A service_role key NÃO deveria estar no frontend. Migrar `supabaseAdmin`
// para o backend é trabalho prioritário (vide auditoria).
const FALLBACK_URL = 'https://dorztqiunewggydvkjnf.supabase.co';
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzEyODgsImV4cCI6MjA2MjY0NzI4OH0.R95uT96OSGstBumZYRFOB38JAsK7U4b8mSXmT8MF0MQ';
const FALLBACK_SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MTI4OCwiZXhwIjoyMDYyNjQ3Mjg4fQ.sk6z1v-MKAjiQK-IfIvPvxI-GdRyH_Biaj5a-8_Ksy8';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON;
const supabaseServiceKey =
  import.meta.env.VITE_SUPABASE_SERVICE_KEY || FALLBACK_SERVICE;

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

// Cliente persistente (localStorage)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sb-dorztqiunewggydvkjnf-auth-local',
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
    storageKey: 'sb-dorztqiunewggydvkjnf-auth-session',
  },
  db: { schema: 'public' },
});

// Cliente admin (para operações administrativas - NUNCA exponha no frontend!)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

// Função para verificar se o Supabase está configurado corretamente
export const checkSupabaseConfig = () => {
  return {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceKey,
    anonKeyLength: supabaseAnonKey?.length || 0,
    serviceKeyLength: supabaseServiceKey?.length || 0,
  };
};
