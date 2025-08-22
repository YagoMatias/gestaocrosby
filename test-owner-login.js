import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dorztqiunewggydvkjnf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzEyODgsImV4cCI6MjA2MjY0NzI4OH0.R95uT96OSGstBumZYRFOB38JAsK7U4b8mSXmT8MF0MQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testOwnerLogin() {
  try {
    console.log('🔐 Testando login do usuário owner...');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'owner@crosby.com',
      password: 'owner123'
    });

    if (error) {
      console.error('❌ Erro no login:', error);
      return;
    }

    console.log('✅ Login bem-sucedido!');
    console.log('📧 Email:', data.user.email);
    console.log('🎭 Role:', data.user.user_metadata?.role);
    console.log('👤 Nome:', data.user.user_metadata?.name);
    console.log('🆔 ID:', data.user.id);
    console.log('✅ Email confirmado:', data.user.email_confirmed_at ? 'Sim' : 'Não');
    
    // Testar se o role está correto
    if (data.user.user_metadata?.role === 'owner') {
      console.log('✅ Role "owner" confirmado!');
    } else {
      console.log('⚠️ Role não é "owner":', data.user.user_metadata?.role);
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

testOwnerLogin();
