import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dorztqiunewggydvkjnf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MTI4OCwiZXhwIjoyMDYyNjQ3Mjg4fQ.sk6z1v-MKAjiQK-IfIvPvxI-GdRyH_Biaj5a-8_Ksy8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createOwnerUser() {
  try {
    console.log('🏗️ Criando usuário owner...');
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'owner@crosby.com',
      password: 'owner123',
      email_confirm: true,
      user_metadata: {
        name: 'Proprietário',
        role: 'owner'  // Role owner com nível máximo de autoridade
      }
    });

    if (error) {
      console.error('❌ Erro:', error);
      return;
    }

    console.log('✅ Usuário owner criado com sucesso!');
    console.log('📧 Email: owner@crosby.com');
    console.log('🔑 Senha: owner123');
    console.log('🎭 Role: owner (nível 1 - máxima autoridade)');
    console.log('🆔 ID do usuário:', data.user.id);
    
    // Verificar se o usuário foi criado corretamente
    console.log('\n🔍 Verificando dados do usuário criado:');
    console.log('Nome:', data.user.user_metadata?.name);
    console.log('Role:', data.user.user_metadata?.role);
    console.log('Email confirmado:', data.user.email_confirmed_at ? 'Sim' : 'Não');
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

createOwnerUser();
