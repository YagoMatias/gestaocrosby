import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dorztqiunewggydvkjnf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcnp0cWl1bmV3Z2d5ZHZram5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA3MTI4OCwiZXhwIjoyMDYyNjQ3Mjg4fQ.sk6z1v-MKAjiQK-IfIvPvxI-GdRyH_Biaj5a-8_Ksy8';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testUserFunctions() {
  try {
    console.log('🧪 Testando funções de gerenciamento de usuários...\n');

    // 1. Testar listUsers
    console.log('1️⃣ Testando listUsers...');
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError);
    } else {
      console.log(`✅ ListUsers funcionando! Encontrados ${users.users.length} usuários`);
      users.users.forEach(user => {
        console.log(`   - ${user.email} (${user.user_metadata?.role || 'sem role'})`);
      });
    }

    // 2. Testar createUser
    console.log('\n2️⃣ Testando createUser...');
    const testEmail = `teste-${Date.now()}@crosby.com`;
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'teste123',
      email_confirm: true,
      user_metadata: {
        name: 'Usuário Teste',
        role: 'user'
      }
    });

    if (createError) {
      console.error('❌ Erro ao criar usuário:', createError);
    } else {
      console.log(`✅ CreateUser funcionando! Usuário criado: ${newUser.user.email}`);
    }

    // 3. Testar updateUserById (se o usuário foi criado)
    if (newUser?.user?.id) {
      console.log('\n3️⃣ Testando updateUserById...');
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        newUser.user.id,
        {
          user_metadata: {
            name: 'Usuário Teste Atualizado',
            role: 'manager'
          }
        }
      );

      if (updateError) {
        console.error('❌ Erro ao atualizar usuário:', updateError);
      } else {
        console.log(`✅ UpdateUserById funcionando! Usuário atualizado: ${updatedUser.user.user_metadata?.name}`);
      }

      // 4. Testar deleteUser
      console.log('\n4️⃣ Testando deleteUser...');
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);

      if (deleteError) {
        console.error('❌ Erro ao deletar usuário:', deleteError);
      } else {
        console.log('✅ DeleteUser funcionando! Usuário deletado com sucesso');
      }
    }

    console.log('\n🎉 Teste concluído!');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

testUserFunctions();
