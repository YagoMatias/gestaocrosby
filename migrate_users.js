// Script para migrar usuários da tabela user_profiles para o Supabase Auth
// Execute este script no Node.js para criar contas no Supabase Auth

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dorztqiunewggydvkjnf.supabase.co";
const supabaseServiceKey = "SUA_SERVICE_ROLE_KEY_AQUI"; // Você precisa da service role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateUsers() {
  try {
    // 1. Buscar todos os usuários da tabela user_profiles
    const { data: users, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*');

    if (fetchError) {
      console.error('Erro ao buscar usuários:', fetchError);
      return;
    }

    console.log(`Encontrados ${users.length} usuários para migrar`);

    // 2. Para cada usuário, criar conta no Supabase Auth
    for (const user of users) {
      try {
        // Criar usuário no Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            name: user.name,
            role: user.role
          }
        });

        if (authError) {
          console.error(`Erro ao criar usuário ${user.email}:`, authError.message);
          continue;
        }

        // Atualizar o ID na tabela user_profiles para referenciar o auth.users
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ id: authUser.user.id })
          .eq('email', user.email);

        if (updateError) {
          console.error(`Erro ao atualizar ID do usuário ${user.email}:`, updateError);
        } else {
          console.log(`✅ Usuário ${user.email} migrado com sucesso`);
        }

      } catch (error) {
        console.error(`Erro ao processar usuário ${user.email}:`, error);
      }
    }

    console.log('Migração concluída!');

  } catch (error) {
    console.error('Erro geral na migração:', error);
  }
}

// Executar migração
migrateUsers(); 