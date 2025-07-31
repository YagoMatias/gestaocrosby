import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://dorztqiunewggydvkjnf.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzEyODgsImV4cCI6MjA2MjY0NzI4OH0.R95uT96OSGstBumZYRFOB38JAsK7U4b8mSXmT8MF0MQ"

// ⚠️ IMPORTANTE: Substitua pela sua Service Role Key do Supabase Dashboard
// Settings > API > service_role key (não o anon key!)
// O Service Role Key começa com "eyJ..." e é diferente do anon key
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MTI4OCwiZXhwIjoyMDYyNjQ3Mjg4fQ.EXEMPLO_DE_SERVICE_ROLE_KEY_AQUI"

// Cliente normal (para frontend)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente admin (para operações administrativas - NUNCA exponha no frontend!)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) 