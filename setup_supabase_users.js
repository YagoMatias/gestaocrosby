// Script para configurar usuários no Supabase
// Execute este script uma vez para criar os usuários no Supabase

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dorztqiunewggydvkjnf.supabase.co";
const supabaseServiceKey = "SUA_SERVICE_ROLE_KEY_AQUI"; // Você precisa da service role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const users = [
  {
    email: 'admin@crosby.com',
    password: 'admin123',
    name: 'Administrador',
    role: 'ADM'
  },
  {
    email: 'diretor@crosby.com',
    password: 'diretor123',
    name: 'Diretor Exemplo',
    role: 'DIRETOR'
  },
  {
    email: 'financeiro@crosby.com',
    password: 'fin123',
    name: 'Financeiro Exemplo',
    role: 'FINANCEIRO'
  },
  {
    email: 'franquia@crosby.com',
    password: 'fran123',
    name: 'Franquia Exemplo',
    role: 'FRANQUIA'
  }
];

async function setupUsers() {
  console.log('Iniciando configuração dos usuários...');

  for (const userData of users) {
    try {
      // Criar usuário no sistema de autenticação do Supabase
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true
      });

      if (authError) {
        console.error(`Erro ao criar usuário ${userData.email}:`, authError);
        continue;
      }

      // Criar perfil do usuário na tabela user_profiles
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          active: true
        })
        .select()
        .single();

      if (profileError) {
        console.error(`Erro ao criar perfil para ${userData.email}:`, profileError);
        // Tentar deletar o usuário criado se falhar ao criar o perfil
        await supabase.auth.admin.deleteUser(authData.user.id);
        continue;
      }

      console.log(`✅ Usuário ${userData.email} criado com sucesso!`);
      console.log(`   ID: ${authData.user.id}`);
      console.log(`   Role: ${userData.role}`);

    } catch (error) {
      console.error(`Erro geral ao criar usuário ${userData.email}:`, error);
    }
  }

  console.log('\n🎉 Configuração concluída!');
  console.log('\nCredenciais para teste:');
  console.log('- Admin: admin@crosby.com / admin123');
  console.log('- Diretor: diretor@crosby.com / diretor123');
  console.log('- Financeiro: financeiro@crosby.com / fin123');
  console.log('- Franquia: franquia@crosby.com / fran123');
}

// Executar o script
setupUsers().catch(console.error); 