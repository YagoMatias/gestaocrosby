import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dorztqiunewggydvkjnf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MTI4OCwiZXhwIjoyMDYyNjQ3Mjg4fQ.sk6z1v-MKAjiQK-IfIvPvxI-GdRyH_Biaj5a-8_Ksy8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUserProfiles() {
  try {
    console.log('🔍 Testando conexão com user_profiles...');
    
    // 1. Testar se a tabela existe
    console.log('📋 Verificando se a tabela existe...');
    const { data: tableTest, error: tableError } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Erro ao acessar tabela:', tableError);
      return;
    }
    
    console.log('✅ Tabela user_profiles existe');
    
    // 2. Listar todos os perfis
    console.log('📋 Listando todos os perfis...');
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*');
    
    if (profilesError) {
      console.error('❌ Erro ao listar perfis:', profilesError);
      return;
    }
    
    console.log('✅ Perfis encontrados:', profiles?.length || 0);
    if (profiles && profiles.length > 0) {
      profiles.forEach(profile => {
        console.log(`  - ${profile.name} (${profile.label}) - Level: ${profile.level}`);
      });
    }
    
    // 3. Testar busca específica por 'admin'
    console.log('🔍 Testando busca por "admin"...');
    const { data: adminProfile, error: adminError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('name', 'admin')
      .single();
    
    if (adminError) {
      console.error('❌ Erro ao buscar admin:', adminError);
    } else {
      console.log('✅ Perfil admin encontrado:', adminProfile);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testUserProfiles();
