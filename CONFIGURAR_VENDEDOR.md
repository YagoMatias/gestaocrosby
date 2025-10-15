# Configuração do Perfil "Vendedor"

## 📋 Resumo das Alterações

Foi criado um novo nível de acesso chamado **"Vendedor"** que terá acesso **APENAS** à página **Crosby Bot**.

### Arquivos Modificados:

1. ✅ **`src/hooks/usePermissions.js`**

   - Adicionado método `isVendedor()`
   - Adicionado método `canAccessCrosbyBot()`
   - Incluído `vendedor` no mapa de níveis de permissão (nível 6)

2. ✅ **`src/App.jsx`**

   - Adicionado `'vendedor'` aos roles permitidos na rota `/crosby-bot`

3. ✅ **`src/components/Sidebar.jsx`**
   - Modificado para mostrar apenas **Home** e **Crosby Bot** para usuários com role `vendedor`
   - Todos os outros menus são ocultados automaticamente

---

## 🗄️ Configuração no Supabase

### Passo 1: Criar o Perfil "Vendedor" na tabela `user_profiles`

Execute o seguinte SQL no **SQL Editor** do Supabase:

```sql
-- Inserir o perfil "Vendedor" na tabela user_profiles
INSERT INTO user_profiles (name, label, color, description, level)
VALUES (
  'vendedor',                                    -- nome interno (usado no código)
  'Vendedor',                                    -- label exibido na interface
  '#10b981',                                     -- cor verde (ou escolha outra)
  'Acesso apenas ao Crosby Bot para envio de mensagens WhatsApp',
  60                                             -- nível de acesso (menor que guest=50)
);
```

**Nota sobre o `level`:**

- Owner: 1
- Admin: 2
- Manager: 3
- User: 4
- Guest: 5
- **Vendedor: 60** (mais baixo, acesso mais restrito)

---

### Passo 2: Criar/Atribuir o Role "vendedor" a um Usuário

Existem duas formas de criar/atribuir o role:

#### ⭐ Opção A: Pelo Painel Admin da Aplicação (RECOMENDADO)

**Para criar um novo usuário vendedor:**

1. Faça login como `owner`
2. Acesse `/painel-admin`
3. Clique no botão **"+ Novo Usuário"**
4. Preencha os dados:
   - **Nome**: Nome do vendedor
   - **Email**: Email do vendedor
   - **Senha**: Senha inicial (usuário poderá alterar depois)
   - **Perfil**: Selecione **"Vendedor"** no dropdown
   - **Status**: Deixe **"Ativo"** marcado
5. Clique em **"Salvar"**
6. O usuário poderá fazer login imediatamente com o email e senha cadastrados

**Para alterar o role de um usuário existente:**

1. Acesse `/painel-admin` (requer login como `owner`)
2. Localize o usuário desejado na lista
3. Clique no botão de **editar** (ícone de lápis)
4. Altere o **Perfil** para **"Vendedor"**
5. Clique em **"Salvar"**

#### Opção B: Diretamente no Supabase (SQL)

```sql
-- Atualizar o role de um usuário específico
-- Substitua 'email@exemplo.com' pelo email real do usuário
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"vendedor"'
)
WHERE email = 'email@exemplo.com';
```

**Exemplo prático:**

```sql
-- Tornar o usuário joao@crosby.com.br um vendedor
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"vendedor"'
)
WHERE email = 'joao@crosby.com.br';
```

---

### Passo 3: Verificar a Configuração

```sql
-- Listar todos os perfis cadastrados
SELECT * FROM user_profiles ORDER BY level;

-- Verificar o role de um usuário específico
SELECT
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'name' as name
FROM auth.users
WHERE email = 'email@exemplo.com';
```

---

## 🔐 Permissões do Vendedor

### O que o Vendedor **PODE** acessar:

- ✅ **Home** (`/home`)
- ✅ **Crosby Bot** (`/crosby-bot`)
  - Criar fluxos de mensagens
  - Importar contatos via Excel/CSV
  - Enviar mensagens em massa para WhatsApp

### O que o Vendedor **NÃO PODE** acessar:

- ❌ Financeiro (Contas a Pagar, Contas a Receber, Fluxo de Caixa, DRE)
- ❌ CMV (Custo de Mercadoria Vendida)
- ❌ Dashboards (Varejo, Multimarcas, Franquias, Revenda)
- ❌ Vendas e Faturamento
- ❌ Clientes
- ❌ Auditoria de Transações
- ❌ Ranking Faturamento
- ❌ Painel Admin
- ❌ Vigia
- ❌ Qualquer outra funcionalidade administrativa

---

## 🧪 Testar a Configuração

1. **Criar um usuário de teste:**

```sql
-- No Supabase SQL Editor (cuidado: isso cria um usuário real)
-- Ou use o painel de Authentication do Supabase
```

2. **Atribuir role vendedor:**

```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"vendedor"'
)
WHERE email = 'teste.vendedor@crosby.com.br';
```

3. **Fazer login com esse usuário** e verificar:
   - Sidebar deve mostrar apenas "Home" e "Crosby Bot"
   - Tentativa de acessar outras rotas deve redirecionar ou negar acesso

---

## 📝 Notas Importantes

### Sobre o Schema `bank` (Erro de Permissão)

Se você ainda estiver enfrentando o erro `permission denied for schema bank` ao enviar mensagens do Crosby Bot, isso é um problema **separado** relacionado à tabela `envio_em_massa`.

**Soluções possíveis:**

1. **Verificar triggers/funções** que acessam o schema `bank`:

```sql
-- Listar triggers na tabela envio_em_massa
SELECT tgname, tgtype::int, tgfoid::regprocedure
FROM pg_trigger
WHERE tgrelid = 'public.envio_em_massa'::regclass
  AND NOT tgisinternal;
```

2. **Criar policy RLS** para permitir INSERT:

```sql
-- Permitir INSERT para usuários autenticados
CREATE POLICY insert_envio_em_massa_auth
ON public.envio_em_massa
FOR INSERT
TO authenticated
WITH CHECK ( auth.uid() IS NOT NULL );
```

3. **Ou usar SECURITY DEFINER** na função do trigger (se houver):

```sql
-- Exemplo (substitua pela função real)
ALTER FUNCTION nome_da_funcao() SECURITY DEFINER;
```

---

## 🎯 Próximos Passos

1. ✅ Execute o SQL para criar o perfil `vendedor` no Supabase
2. ✅ Atribua o role `vendedor` aos usuários desejados
3. ✅ Teste o login com um usuário vendedor
4. ✅ Verifique que apenas Home e Crosby Bot aparecem no menu
5. ✅ Corrija o erro de permissão do `schema bank` (se necessário)

---

## 🔄 Reverter Alterações

Se precisar remover o perfil vendedor:

```sql
-- Remover o perfil da tabela
DELETE FROM user_profiles WHERE name = 'vendedor';

-- Alterar usuários de volta para outro role
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{role}',
  '"guest"'
)
WHERE raw_user_meta_data->>'role' = 'vendedor';
```

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do navegador (Console)
2. Verifique os logs do Supabase
3. Confirme que o perfil foi criado corretamente: `SELECT * FROM user_profiles WHERE name = 'vendedor'`
4. Confirme que o usuário tem o role correto: `SELECT email, raw_user_meta_data->>'role' FROM auth.users WHERE email = 'seu@email.com'`

---

**Implementado com sucesso! 🎉**
