# Migração para Sistema de Autenticação Auth.Users

## Visão Geral

Este documento explica como migrar do sistema de autenticação customizado (tabela `user_profiles_antiga`) para o sistema nativo do Supabase (`auth.users`) com perfis baseados em levels.

## Nova Estrutura

### 1. Tabela `auth.users` (Sistema nativo do Supabase)
- Gerencia autenticação, senhas e sessões
- Armazena metadata do usuário (nome, role)
- Sistema seguro e gerenciado pelo Supabase

### 2. Tabela `user_profiles` (Perfis baseados em levels)
```sql
create table public.user_profiles (
  id serial not null,
  name text not null,           -- Nome do perfil (ex: 'ADM', 'DIRETOR')
  label text not null,          -- Label para exibição (ex: 'Administrador')
  color text not null,          -- Cor do perfil
  description text null,        -- Descrição do perfil
  level integer not null,       -- Nível de acesso (1-99)
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
```

## Perfis Padrão

| Nome | Label | Level | Cor | Descrição |
|------|-------|-------|-----|-----------|
| FRANQUIA | Franquia | 1 | #3B82F6 | Usuário de franquia com acesso limitado |
| FINANCEIRO | Financeiro | 2 | #10B981 | Usuário financeiro com acesso a relatórios |
| DIRETOR | Diretor | 3 | #F59E0B | Diretor com acesso amplo ao sistema |
| ADM | Administrador | 4 | #EF4444 | Administrador com acesso total ao sistema |

## Como Usar

### 1. Acessar a página de teste
Navegue para `/auth-test` (apenas usuários ADM)

### 2. Criar perfis padrão
Clique em "Criar Perfis Padrão" para criar os 4 perfis básicos

### 3. Migrar usuários existentes
Clique em "Migrar Usuários" para migrar da tabela antiga para `auth.users`

### 4. Criar novos usuários
Use o formulário "Criar Novo Usuário" para adicionar usuários diretamente no `auth.users`

## Verificação de Permissões

### No código React:
```javascript
import { useAuth } from '../components/AuthContext';

const { hasRole, hasPermission, user } = useAuth();

// Verificar role específica
if (hasRole('ADM')) {
  // Apenas administradores
}

// Verificar permissão por level
if (hasPermission(3)) {
  // Usuários com level >= 3 (DIRETOR, ADM)
}
```

### Estrutura do usuário:
```javascript
{
  id: "uuid-do-usuario",
  email: "usuario@exemplo.com",
  name: "Nome do Usuário",
  role: "ADM",
  profile: {
    id: 4,
    name: "ADM",
    label: "Administrador",
    color: "#EF4444",
    level: 4,
    description: "Administrador com acesso total ao sistema"
  },
  active: true,
  emailConfirmed: true
}
```

## Migração de Dados

### Passo a passo:

1. **Criar perfis padrão**: Executa automaticamente na migração
2. **Migrar usuários**: Copia da tabela antiga para `auth.users`
3. **Atualizar metadata**: Adiciona role e nome nos metadados do usuário
4. **Verificar resultados**: Relatório detalhado de sucessos e erros

### Dados migrados:
- Email do usuário
- Nome do usuário
- Role/perfil
- Senha (se existir, senão usa 'senha123')

## Vantagens do Novo Sistema

1. **Segurança**: Sistema nativo do Supabase com criptografia
2. **Flexibilidade**: Perfis baseados em levels (1-99)
3. **Escalabilidade**: Suporte a milhões de usuários
4. **Manutenibilidade**: Código mais limpo e organizado
5. **Recursos avançados**: Reset de senha, confirmação de email, etc.

## Troubleshooting

### Erro: "Perfil não encontrado"
- Verifique se os perfis padrão foram criados
- Execute "Criar Perfis Padrão" novamente

### Erro: "Usuário já existe"
- O sistema atualiza automaticamente usuários existentes
- Verifique se o email está correto

### Erro: "Permissão negada"
- Verifique se o usuário tem level suficiente
- Use `hasPermission(level)` em vez de `hasRole()`

## Próximos Passos

1. Testar o sistema com usuários reais
2. Configurar políticas de segurança no Supabase
3. Implementar reset de senha
4. Adicionar confirmação de email
5. Configurar autenticação social (Google, etc.)

## Suporte

Para dúvidas ou problemas, consulte:
- Documentação do Supabase Auth
- Logs do console do navegador
- Relatórios de erro na página de teste
