# Configuração do Supabase para Arquivos .RET

## 📋 Pré-requisitos

1. Acesso ao projeto Supabase
2. Permissões de administrador no projeto
3. URL e chaves de API do Supabase configuradas no projeto

## 🗄️ Criação da Tabela

### Passo 1: Acessar o SQL Editor
1. Faça login no [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **SQL Editor** no menu lateral

### Passo 2: Executar o Script SQL
1. Crie uma nova query
2. Copie e cole o conteúdo do arquivo `supabase_migration.sql`
3. Execute o script

### Passo 3: Verificar a Criação
Após executar o script, você deve ver:
- Tabela `retorno_bancario` criada
- Índices criados para performance
- Índice único para evitar duplicatas
- RLS (Row Level Security) habilitado
- Policies de segurança configuradas

## 🔐 Estrutura da Tabela

### Campos Principais:
- **id**: ID único do registro (BIGSERIAL)
- **nome_arquivo**: Nome original do arquivo .RET
- **data_upload**: Data e hora do upload
- **valor**: Valor do saldo (DECIMAL 15,2)
- **banco_nome**: Nome do banco
- **banco_codigo**: Código do banco
- **banco_layout**: Layout do arquivo
- **agencia**: Número da agência
- **conta**: Número da conta
- **saldo_formatado**: Saldo formatado em R$
- **data_processamento**: Data/hora do processamento
- **created_at**: Data de criação
- **updated_at**: Data de atualização

### Chaves Únicas:
- **Índice único composto**: `nome_arquivo + data_upload + valor`
- **Propósito**: Evitar duplicação de arquivos

## 🔒 Segurança (RLS)

### Policies Configuradas:
- ✅ **INSERT**: Apenas usuários autenticados
- ✅ **SELECT**: Apenas usuários autenticados  
- ✅ **UPDATE**: Apenas usuários autenticados
- ✅ **DELETE**: Apenas usuários autenticados

## 📊 Índices para Performance

### Índices Criados:
- `idx_retorno_bancario_nome_arquivo`
- `idx_retorno_bancario_data_upload`
- `idx_retorno_bancario_valor`
- `idx_retorno_bancario_banco_nome`
- `idx_retorno_bancario_created_at`
- `idx_retorno_bancario_unique_file` (único)

## 🧪 Teste da Configuração

### Verificar Tabela:
```sql
SELECT COUNT(*) FROM retorno_bancario;
```

### Verificar Policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'retorno_bancario';
```

### Verificar Índices:
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'retorno_bancario';
```

## 🚀 Funcionalidades Implementadas

### ✅ Salvamento Automático:
- Arquivos processados são salvos automaticamente
- Verificação de duplicatas antes do salvamento
- Tratamento de erros de salvamento

### ✅ Prevenção de Duplicatas:
- Verificação por nome do arquivo
- Verificação por data de upload
- Verificação por valor do saldo
- Índice único no banco de dados

### ✅ Interface de Feedback:
- Arquivos salvos com sucesso
- Arquivos duplicados identificados
- Erros de salvamento reportados
- Progresso do processamento

## 🔧 Configuração no Frontend

### Arquivos Modificados:
- `src/lib/retornoBancario.js` - Funções de CRUD
- `src/pages/ImportacaoRet.jsx` - Integração com Supabase
- `supabase_migration.sql` - Script de criação da tabela

### Funções Disponíveis:
- `verificarArquivoExistente()` - Verifica duplicatas
- `salvarRetornoBancario()` - Salva dados no Supabase
- `buscarRetornosBancarios()` - Busca registros
- `buscarEstatisticasRetornos()` - Estatísticas
- `removerRetornoBancario()` - Remove registro

## 📝 Notas Importantes

1. **Autenticação**: Certifique-se de que o usuário está autenticado
2. **Permissões**: Verifique se as policies estão funcionando
3. **Backup**: Faça backup antes de executar o script
4. **Monitoramento**: Monitore o uso da tabela
5. **Limpeza**: Considere implementar limpeza periódica de dados antigos

## 🆘 Solução de Problemas

### Erro de Permissão:
```sql
-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'retorno_bancario';
```

### Erro de Índice Único:
```sql
-- Verificar índices únicos
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'retorno_bancario' 
AND indexdef LIKE '%UNIQUE%';
```

### Erro de Conexão:
- Verifique as chaves de API no arquivo `src/lib/supabase.js`
- Confirme se a URL do projeto está correta
- Teste a conexão com uma query simples
