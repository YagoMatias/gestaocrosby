# 🔧 Solução para Erro de RLS (Row Level Security)

## ❌ Problema Identificado

O erro `42501: new row violates row-level security policy` indica que as políticas de segurança do Supabase estão bloqueando o acesso à tabela.

## ✅ Soluções Disponíveis

### **Opção 1: Desabilitar RLS (Recomendado para Teste)**

Execute o script `supabase_migration_fix.sql` no SQL Editor do Supabase:

```sql
-- Desabilitar RLS temporariamente
ALTER TABLE retorno_bancario DISABLE ROW LEVEL SECURITY;
```

### **Opção 2: Criar Políticas Permissivas**

Se preferir manter RLS habilitado, execute:

```sql
-- Habilitar RLS
ALTER TABLE retorno_bancario ENABLE ROW LEVEL SECURITY;

-- Criar políticas que permitem acesso público
CREATE POLICY "Permitir acesso público para inserção" ON retorno_bancario
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir acesso público para leitura" ON retorno_bancario
    FOR SELECT USING (true);

CREATE POLICY "Permitir acesso público para atualização" ON retorno_bancario
    FOR UPDATE USING (true);

CREATE POLICY "Permitir acesso público para exclusão" ON retorno_bancario
    FOR DELETE USING (true);
```

## 🚀 Passos para Resolver

### **Passo 1: Acessar Supabase Dashboard**
1. Vá para [app.supabase.com](https://app.supabase.com)
2. Selecione seu projeto
3. Clique em **SQL Editor**

### **Passo 2: Executar Script de Correção**
1. Crie uma nova query
2. Copie e cole o conteúdo de `supabase_migration_fix.sql`
3. Execute o script

### **Passo 3: Verificar Configuração**
Execute esta query para verificar se RLS está desabilitado:

```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'retorno_bancario';
```

**Resultado esperado:**
- `rowsecurity` deve ser `false`

### **Passo 4: Testar Inserção**
Execute esta query para testar se a inserção funciona:

```sql
INSERT INTO retorno_bancario (
    nome_arquivo,
    data_upload,
    valor,
    banco_nome,
    banco_codigo,
    banco_layout,
    agencia,
    conta,
    saldo_formatado,
    data_processamento
) VALUES (
    'teste.RET',
    NOW(),
    1000.00,
    'Banco Teste',
    '001',
    'CNAB400',
    '0001',
    '123456',
    'R$ 1.000,00',
    NOW()
);
```

### **Passo 5: Limpar Dados de Teste**
```sql
DELETE FROM retorno_bancario WHERE nome_arquivo = 'teste.RET';
```

## 🔍 Verificações Adicionais

### **Verificar Estrutura da Tabela:**
```sql
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'retorno_bancario' 
ORDER BY ordinal_position;
```

### **Verificar Índices:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'retorno_bancario';
```

### **Verificar Políticas (se RLS estiver habilitado):**
```sql
SELECT * FROM pg_policies WHERE tablename = 'retorno_bancario';
```

## 🛡️ Segurança

### **Para Produção:**
Se você planeja usar em produção, considere:

1. **Manter RLS habilitado** com políticas específicas
2. **Implementar autenticação** adequada
3. **Criar políticas baseadas em usuário** se necessário

### **Para Desenvolvimento/Teste:**
- Desabilitar RLS é aceitável
- Facilita o desenvolvimento e testes
- Pode ser reabilitado posteriormente

## 🔄 Código Atualizado

O arquivo `src/lib/retornoBancario.js` foi atualizado para:

- ✅ **Tratar erros de RLS** graciosamente
- ✅ **Detectar duplicatas** pelo banco de dados
- ✅ **Fornecer mensagens** de erro mais claras
- ✅ **Fallback** para permitir inserção em caso de erro

## 📝 Próximos Passos

1. **Execute o script** `supabase_migration_fix.sql`
2. **Teste o upload** de arquivos .RET
3. **Verifique se os dados** estão sendo salvos
4. **Monitore os logs** para erros

## 🆘 Se o Problema Persistir

### **Verificar Conexão:**
```javascript
// Teste no console do navegador
import { supabase } from './src/lib/supabase.js';

// Teste simples
const { data, error } = await supabase
  .from('retorno_bancario')
  .select('*')
  .limit(1);

console.log('Teste de conexão:', { data, error });
```

### **Verificar Configuração:**
- URL do Supabase está correta?
- Chave anônima está configurada?
- Tabela existe no projeto correto?

### **Contato:**
Se o problema persistir, verifique:
1. Logs do Supabase Dashboard
2. Console do navegador
3. Network tab do DevTools
